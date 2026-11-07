#!/usr/bin/env node
/**
 * Virgo Portals — local print agent.
 *
 * Runs on a device inside the restaurant's network (a small always-on machine
 * such as a Raspberry Pi, mini PC or the venue's back-office computer). It
 * polls the Virgo print queue, renders each ticket as a plain-text 80 mm
 * receipt, and sends it to the department's Wi-Fi/LAN printer over a raw TCP
 * socket (default port 9100). No Host login is required.
 *
 * Setup:
 *   1. npm install (this file has no dependencies beyond Node.js >= 18)
 *   2. Set environment variables:
 *        VIRGO_URL        e.g. https://<project>.supabase.co
 *        VIRGO_SERVICE_KEY  service-role key
 *        VIRGO_DEPARTMENT_IDS  optional comma-separated department IDs to
 *                          serve (omit to claim jobs for every department)
 *        VIRGO_POLL_SECONDS    poll interval, default 5
 *   3. node print-agent.mjs
 *
 * Reliability:
 *   - Jobs are claimed atomically (status pending -> printing).
 *   - Delivery failures are reported to the queue and retried with a delay,
 *     up to five attempts, then marked failed. Orders are never lost: the
 *     order row is independent of print delivery.
 *   - Jobs stuck in 'printing' (agent crash) are requeued automatically after
 *     five minutes by the print queue service.
 *   - The unique constraint on order_id prevents duplicate printing.
 */

import net from 'node:net';

const VIRGO_URL = (process.env.VIRGO_URL ?? '').replace(/\/$/, '');
const VIRGO_SERVICE_KEY = process.env.VIRGO_SERVICE_KEY ?? '';
const DEPARTMENT_IDS = (process.env.VIRGO_DEPARTMENT_IDS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const POLL_SECONDS = Number(process.env.VIRGO_POLL_SECONDS ?? '5');
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 30_000;

if (!VIRGO_URL || !VIRGO_SERVICE_KEY) {
  console.error('[print-agent] VIRGO_URL and VIRGO_SERVICE_KEY are required.');
  process.exit(1);
}

const failedAt = new Map();

async function queueCall(action, extra = {}) {
  const res = await fetch(`${VIRGO_URL}/functions/v1/print-queue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VIRGO_SERVICE_KEY}`,
      apikey: VIRGO_SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Queue call failed (${res.status})`);
  return body;
}

function escLine(s) {
  return s.replace(/[^\x20-\x7E]/g, '?');
}

function center(text, width) {
  const t = escLine(text);
  if (t.length >= width) return t;
  const pad = Math.floor((width - t.length) / 2);
  return ' '.repeat(pad) + t;
}

function padCost(left, right, width) {
  const l = escLine(left);
  const r = escLine(right);
  if (l.length + r.length + 1 > width) return l;
  return l + ' '.repeat(width - l.length - r.length) + r;
}

function wrap(text, width, indent) {
  const words = escLine(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line) { line = w; continue; }
    if ((line + ' ' + w).length <= width) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : ' '.repeat(indent) + l));
}

function renderSessionReport(ticket) {
  const W = ticket.printer?.paperWidthMm === 58 ? 32 : 42;
  const out = [];
  const started = ticket.startedAt ? new Date(ticket.startedAt) : null;
  const closed = ticket.closedAt ? new Date(ticket.closedAt) : null;
  const date = (value) => value ? value.toLocaleDateString() : '';
  const time = (value) => value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const duration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
  };
  const row = (label, value) => out.push(padCost(label, value, W));

  out.push(center('VIRGO PORTAL', W));
  for (const line of wrap(ticket.restaurantName ?? '', W, 0)) out.push(center(line, W));
  for (const line of wrap(ticket.departmentName ?? '', W, 0)) out.push(center(line, W));
  out.push(center('CLOSED SESSION REPORT', W));
  out.push('-'.repeat(W));
  out.push('SESSION DETAILS');
  row('Start date', date(started));
  row('Start time', time(started));
  row('Close date', date(closed));
  row('Close time', time(closed));
  row('Duration', duration(ticket.durationMinutes ?? 0));
  out.push('-'.repeat(W));
  out.push('SESSION SUMMARY');
  row('Total orders', String(ticket.orderCount ?? 0));
  row('Total sales', fmt(ticket.totalMinor ?? 0, ticket.currency));
  out.push('-'.repeat(W));
  out.push('PAYMENT TOTALS');
  for (const [paymentType, amountMinor] of Object.entries(ticket.paymentTotals ?? {})) {
    row(paymentType, fmt(amountMinor, ticket.currency));
  }
  out.push('-'.repeat(W));
  out.push('ORDER DETAILS');
  for (const order of ticket.orders ?? []) {
    for (const line of wrap(order.orderNumber ?? '', W, 0)) out.push(line);
    out.push(padCost(` ${order.paymentType ?? ''}`, fmt(order.amountMinor ?? 0, order.currency ?? ticket.currency), W));
    out.push('-'.repeat(W));
  }
  out.push(center('END OF SESSION REPORT', W));
  out.push(center('Generated by Virgo Portal', W));
  out.push('');
  out.push('');
  out.push('\\n\\x1dv0');
  return out.join('\\n');
}

function renderTicket(ticket) {
  if (ticket.reportType === 'session_report') return renderSessionReport(ticket);
  const W = ticket.printer?.paperWidthMm === 58 ? 32 : 42;
  const out = [];
  out.push(center('VIRGO PORTALS', W));
  out.push(center('ORDER CONFIRMATION', W));
  out.push('-'.repeat(W));
  out.push(center(ticket.restaurantName ?? '', W));
  if (ticket.resourceName && ticket.resourceName !== ticket.restaurantName) {
    out.push(center(ticket.resourceName, W));
  }
  out.push('-'.repeat(W));
  out.push(padCost(`ORDER #${ticket.orderNumber ?? ''}`, '', W).trimEnd());
  out.push(`Order ID: ${ticket.orderId ?? ''}`);
  out.push(`Date: ${ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}`);
  out.push(`Status: ${ticket.status ?? ''}`);
  out.push('-'.repeat(W));
  out.push('ITEMS');
  for (const item of ticket.items ?? []) {
    const nameLines = wrap(item.name ?? '', W - 13, 0);
    nameLines.forEach((l, i) => {
      if (i === 0) out.push(padCost(l, item.lineTotalMinor != null ? fmt(item.lineTotalMinor, ticket.currency) : '', W));
      else out.push(l);
    });
    out.push(` ${item.quantity} x ${fmt(item.priceMinor, ticket.currency)}`);
    if (item.servingLabel) out.push(`   ${item.servingLabel}`);
    if (item.variantName) out.push(`   ${item.variantName}`);
    if (item.removedIngredients) out.push(`   ${item.removedIngredients}`);
    for (const a of item.addOns ?? []) {
      out.push(`   + ${a.name}${a.priceMinor ? ' ' + fmt(a.priceMinor, ticket.currency) : ''}`);
    }
  }
  out.push('-'.repeat(W));
  if ((ticket.tipMinor ?? 0) > 0) {
    out.push(padCost('Tip', fmt(ticket.tipMinor, ticket.currency), W));
    out.push('-'.repeat(W));
  }
  out.push(padCost('TOTAL', fmt(ticket.totalMinor, ticket.currency), W));
  out.push('-'.repeat(W));
  const method = ticket.paymentStatus === 'pay_to_staff' ? 'Pay to Staff' : 'Test Payment';
  out.push(`Payment method: ${method}`);
  out.push('Payment status: NOT PAID');
  out.push(`Mobile: ${ticket.mobileNumber ?? 'Not provided'}`);
  out.push('-'.repeat(W));
  const payToStaff = ticket.paymentStatus === 'pay_to_staff';
  const disclaimer = payToStaff
    ? 'Payment for this order is made to restaurant staff and is not processed through Virgo. This is not an invoice or payment receipt.'
    : 'This is a prototype order. No real payment has been taken and no food will be prepared. This ticket is not a payment receipt or invoice.';
  for (const l of wrap(disclaimer, W, 0)) out.push(l);
  out.push('');
  out.push('');
  out.push('\n\x1dv0'); // partial cut (ESC/POS on most thermal printers)
  return out.join('\n');
}

function fmt(minor, currency) {
  const symbol = currency === 'SEK' ? 'kr' : currency === 'EUR' ? '\u20AC' : currency === 'USD' ? '$' : currency;
  return `${(minor / 100).toFixed(2)} ${symbol}`;
}

function sendToPrinter(ip, port, text) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port, timeout: 10_000 }, () => {
      socket.write(text, 'utf8', () => {
        socket.end();
        resolve();
      });
    });
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`Printer timeout (${ip}:${port})`)); });
    socket.on('error', (err) => reject(err));
  });
}

async function deliver(job) {
  const printer = job.printer ?? {};
  if (!printer.ip) throw new Error('Printer has no IP address.');
  const text = renderTicket({ ...job.ticket, printer });
  await sendToPrinter(printer.ip, printer.port ?? 9100, text);
}

async function processJob(job) {
  try {
    await deliver(job);
    await queueCall('complete', { jobId: job.id });
    console.log(`[print-agent] printed job ${job.id} (order ${job.ticket?.orderNumber ?? '?'})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[print-agent] job ${job.id} failed: ${msg}`);
    failedAt.set(job.id, Date.now());
    try {
      await queueCall('fail', { jobId: job.id, error: msg, maxAttempts: MAX_ATTEMPTS });
    } catch (reportErr) {
      console.error(`[print-agent] could not report failure for ${job.id}:`, reportErr);
    }
  }
}

async function tick() {
  let body;
  try {
    body = await queueCall('claim', DEPARTMENT_IDS.length ? { departmentIds: DEPARTMENT_IDS } : {});
  } catch (err) {
    console.error('[print-agent] claim failed:', err instanceof Error ? err.message : err);
    return;
  }
  const jobs = body.jobs ?? [];
  for (const job of jobs) {
    const lastFail = failedAt.get(job.id);
    if (lastFail && Date.now() - lastFail < RETRY_DELAY_MS) {
      await queueCall('fail', { jobId: job.id, error: 'Backing off before retry.', maxAttempts: MAX_ATTEMPTS }).catch(() => {});
      continue;
    }
    failedAt.delete(job.id);
    await processJob(job);
  }
}

console.log(`[print-agent] started — polling every ${POLL_SECONDS}s${DEPARTMENT_IDS.length ? ` for departments ${DEPARTMENT_IDS.join(', ')}` : ''}`);
setInterval(() => { tick().catch((e) => console.error('[print-agent] tick error:', e)); }, POLL_SECONDS * 1000);
