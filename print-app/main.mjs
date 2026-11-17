#!/usr/bin/env node
/**
 * Virgo Portals — Windows printing app (main process).
 *
 * A small desktop app for restaurant owners. Signs in with the restaurant's
 * existing Virgo Portal host account — no service key, no technical setup.
 * Reuses the exact queue/retry/printing logic from print-agent/print-agent.mjs
 * (claim → render → raw TCP ESC/POS → complete/fail with backoff).
 *
 * Extras over the headless agent:
 *   - sign-in window (host email + password) on first run
 *   - department checklist: which departments this computer serves
 *   - "Send test print" per department (enqueues a 'test' job via the host's
 *     authenticated RPC enqueue_department_test_print)
 *   - tray icon, "start with Windows" registry key, plain-language errors
 *
 * Package: run build-windows.bat (uses electron-builder, portable NSIS
 * installer). Node 18+ required on the build machine only.
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APP_VERSION = '1.0.0';
const POLL_SECONDS = 5;
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 30_000;
const HEARTBEAT_MS = 60_000;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://mnoqtlwafknnxmakghhu.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ub3F0bHdhZmtubnhtYWtnaGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MjUzMjQsImV4cCI6MjEwNzIwMTMyNH0.mSKWLrdV2vwHefVdUXc2rlxMAs3Ey-VjAy5_1Gvjsjw';

const CONFIG_DIR = path.join(app.getPath('userData'), 'virgo-print-app');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

let config = { email: null, password: null, departmentIds: [], restaurantId: null, agentId: null };
let supabase = null;
let session = null;
let tray = null;
let win = null;
let pollTimer = null;
let heartbeatTimer = null;
const failedAt = new Map();
let stopping = false;

// ── config persistence ────────────────────────────────────────────────
function loadConfig() {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch { /* first run */ }
}

function saveConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// ── auth ──────────────────────────────────────────────────────────────
async function signIn(email, password) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error.message));
  session = data.session;
  config.email = email;
  config.password = password; // stored only on this computer, never sent anywhere else
  saveConfig();
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('owner_id', session.user.id)
    .limit(1)
    .maybeSingle();
  if (!restaurant) throw new Error('No restaurant is linked to this account.');
  config.restaurantId = restaurant.id;
  saveConfig();
  await registerAgent();
  startWork();
  return restaurant;
}

function friendlyAuthError(message) {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password. Use the same account you sign in to Virgo Portal with.';
  if (/email not confirmed/i.test(message)) return 'This email has not been confirmed yet.';
  if (/too many requests/i.test(message)) return 'Too many attempts — please wait a minute and try again.';
  return message;
}

// ── agent registration + heartbeat ────────────────────────────────────
async function queueCall(action, extra = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/print-queue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Queue call failed (${res.status})`);
  return body;
}

async function registerAgent() {
  const { agentId } = await queueCall('register', { agentName: 'Printing app', appVersion: APP_VERSION });
  if (agentId) config.agentId = agentId;
  saveConfig();
}

async function heartbeat() {
  try { await queueCall('heartbeat'); } catch { /* retried next minute */ }
}

// ── printing (same logic as print-agent.mjs) ──────────────────────────
function escLine(s) { return String(s).replace(/[^\x20-\x7E]/g, '?'); }
function center(text, width) {
  const t = escLine(text);
  if (t.length >= width) return t;
  return ' '.repeat(Math.floor((width - t.length) / 2)) + t;
}
function padCost(left, right, width) {
  const l = escLine(left);
  const r = escLine(right);
  if (l.length + r.length + 1 > width) return l;
  return l + ' '.repeat(width - l.length - r.length) + r;
}
function wrap(text, width) {
  return escLine(String(text)).split(/\s+/).filter(Boolean)
    .reduce((lines, w) => {
      if (!lines.length || (lines[lines.length - 1] + ' ' + w).length > width) lines.push(w);
      else lines[lines.length - 1] += ' ' + w;
      return lines;
    }, []);
}
function fmt(minor, currency) {
  const symbol = currency === 'SEK' ? 'kr' : currency === 'EUR' ? '\u20AC' : currency === 'USD' ? '$' : (currency ?? '');
  return `${((minor ?? 0) / 100).toFixed(2)} ${symbol}`;
}

function renderTestTicket(ticket, printer) {
  const W = printer.paperWidthMm === 58 ? 32 : 42;
  const out = [];
  out.push(center('VIRGO PORTALS', W));
  out.push(center('TEST PRINT', W));
  out.push('-'.repeat(W));
  out.push(center(ticket.departmentName ?? '', W));
  out.push('-'.repeat(W));
  out.push(`Date: ${new Date().toLocaleString()}`);
  out.push('');
  out.push(center('The printer is working.', W));
  out.push(center('You can start taking orders.', W));
  out.push('');
  out.push('');
  out.push('\n\x1dv0');
  return out.join('\n');
}

function renderSessionReport(ticket) {
  const W = ticket.printer?.paperWidthMm === 58 ? 32 : 42;
  const out = [];
  const started = ticket.startedAt ? new Date(ticket.startedAt) : null;
  const closed = ticket.closedAt ? new Date(ticket.closedAt) : null;
  const date = (value) => (value ? value.toLocaleDateString() : '');
  const time = (value) => (value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  const duration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes % 60}m`;
  };
  const row = (label, value) => out.push(padCost(label, value, W));
  out.push(center('VIRGO PORTAL', W));
  for (const line of wrap(ticket.restaurantName ?? '', W)) out.push(center(line, W));
  for (const line of wrap(ticket.departmentName ?? '', W)) out.push(center(line, W));
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
    for (const line of wrap(order.orderNumber ?? '', W)) out.push(line);
    out.push(padCost(` ${order.paymentType ?? ''}`, fmt(order.amountMinor ?? 0, order.currency ?? ticket.currency), W));
    out.push('-'.repeat(W));
  }
  out.push(center('END OF SESSION REPORT', W));
  out.push(center('Generated by Virgo Portal', W));
  out.push('');
  out.push('');
  out.push('\n\x1dv0');
  return out.join('\n');
}

function renderTicket(job) {
  const printer = job.printer ?? {};
  if (job.job_type === 'test') return renderTestTicket(job.ticket ?? {}, printer);
  const ticket = { ...job.ticket, printer };
  if (ticket.reportType === 'session_report') return renderSessionReport(ticket);
  const W = printer.paperWidthMm === 58 ? 32 : 42;
  const out = [];
  out.push(center('VIRGO PORTALS', W));
  out.push(center('ORDER CONFIRMATION', W));
  out.push('-'.repeat(W));
  out.push(center(ticket.restaurantName ?? '', W));
  if (ticket.resourceName && ticket.resourceName !== ticket.restaurantName) out.push(center(ticket.resourceName, W));
  out.push('-'.repeat(W));
  out.push(padCost(`ORDER #${ticket.orderNumber ?? ''}`, '', W).trimEnd());
  out.push(`Order ID: ${ticket.orderId ?? ''}`);
  out.push(`Date: ${ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}`);
  out.push(`Status: ${ticket.status ?? ''}`);
  if (ticket.serviceType && ticket.serviceLocation) {
    out.push(
      ticket.serviceType === 'room'
        ? `ROOM SERVICE - ROOM ${String(ticket.serviceLocation).toUpperCase()}`
        : `TABLE SERVICE - TABLE ${String(ticket.serviceLocation).toUpperCase()}`
    );
  }
  out.push('-'.repeat(W));
  out.push('ITEMS');
  for (const item of ticket.items ?? []) {
    const nameLines = wrap(item.name ?? '', W - 13);
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
  if ((ticket.tipMinor ?? 0) > 0) { out.push(padCost('Tip', fmt(ticket.tipMinor, ticket.currency), W)); out.push('-'.repeat(W)); }
  if (ticket.serviceType && (ticket.serviceChargeMinor ?? 0) > 0) {
    out.push(padCost(ticket.serviceType === 'room' ? 'Room service charge' : 'Table service charge', fmt(ticket.serviceChargeMinor, ticket.currency), W));
    out.push('-'.repeat(W));
  }
  out.push(padCost('TOTAL', fmt(ticket.totalMinor, ticket.currency), W));
  out.push('-'.repeat(W));
  out.push(`Payment method: ${ticket.paymentStatus === 'pay_to_staff' ? 'Pay to Staff' : 'Test Payment'}`);
  out.push('Payment status: NOT PAID');
  out.push(`Mobile: ${ticket.mobileNumber ?? 'Not provided'}`);
  out.push('-'.repeat(W));
  const disclaimer = ticket.paymentStatus === 'pay_to_staff'
    ? 'Payment for this order is made to restaurant staff and is not processed through Virgo. This is not an invoice or payment receipt.'
    : 'This is a prototype order. No real payment has been taken and no food will be prepared. This ticket is not a payment receipt or invoice.';
  for (const l of wrap(disclaimer, W)) out.push(l);
  out.push('');
  out.push('');
  out.push('\x1dv0');
  return out.join('\n');
}

function sendToPrinter(ip, port, text) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port, timeout: 10_000 }, () => {
      socket.write(text, 'utf8', () => { socket.end(); resolve(); });
    });
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`The printer at ${ip}:${port} did not respond. Check that the printer is switched on.`)); });
    socket.on('error', (err) => reject(new Error(friendlyPrintError(err))));
  });
}

function friendlyPrintError(err) {
  if (err?.code === 'EHOSTUNREACH' || err?.code === 'ENETUNREACH') return 'Could not reach the printer. Check it is switched on and connected to the same network as this computer.';
  if (err?.code === 'ECONNREFUSED') return 'The printer refused the connection. Check its IP address and port in the department Printer tab.';
  if (err?.code === 'ETIMEDOUT') return 'The printer took too long to respond.';
  return err?.message ?? 'Unknown printing error.';
}

async function deliver(job) {
  const printer = job.printer ?? {};
  if (!printer.ip) throw new Error('This department has no printer IP address set. Open its Printer tab in Virgo Portal.');
  const text = renderTicket(job);
  await sendToPrinter(printer.ip, printer.port ?? 9100, text);
}

async function processJob(job) {
  try {
    await deliver(job);
    await queueCall('complete', { jobId: job.id });
    console.log(`[print-app] printed job ${job.id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    failedAt.set(job.id, Date.now());
    await queueCall('fail', { jobId: job.id, error: msg, maxAttempts: MAX_ATTEMPTS }).catch(() => {});
  }
}

async function tick() {
  if (!session || stopping) return;
  let body;
  try {
    body = await queueCall('claim', config.departmentIds.length ? { departmentIds: config.departmentIds } : {});
  } catch (err) {
    // Access token expired — refresh and continue on next tick.
    const { data } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }).catch(() => ({ data: null }));
    if (data?.session) session = data.session;
    console.error('[print-app] claim failed:', err?.message ?? err);
    return;
  }
  for (const job of body.jobs ?? []) {
    const lastFail = failedAt.get(job.id);
    if (lastFail && Date.now() - lastFail < RETRY_DELAY_MS) {
      await queueCall('fail', { jobId: job.id, error: 'Backing off before retry.', maxAttempts: MAX_ATTEMPTS }).catch(() => {});
      continue;
    }
    failedAt.delete(job.id);
    await processJob(job);
  }
}

function startWork() {
  if (pollTimer) return;
  heartbeat();
  pollTimer = setInterval(() => tick().catch(() => {}), POLL_SECONDS * 1000);
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
}

// ── windows auto-start ────────────────────────────────────────────────
function enableAutoStart() {
  if (process.platform !== 'win32') return;
  const { Registry } = require('winreg');
  const key = new Registry({ hive: Registry.HKCU, key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' });
  key.set('VirgoPrintingApp', Registry.REG_SZ, `"${process.execPath}"`, () => {});
}

// ── UI ────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 680,
    title: 'Virgo Printing App',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('close', (event) => {
    if (!stopping) { event.preventDefault(); win.hide(); }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'printer-icon.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Virgo Printing App');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => { win?.show(); } },
    { label: 'Quit', click: () => { stopping = true; app.quit(); } },
  ]));
}

// ── IPC for the renderer ──────────────────────────────────────────────
ipcMain.handle('sign-in', async (_e, { email, password }) => {
  try {
    const restaurant = await signIn(email, password);
    return { ok: true, restaurant };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sign-in failed.' };
  }
});

ipcMain.handle('get-state', async () => {
  if (!supabase || !session) return { signedIn: false, email: config.email ?? null };
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, printer_enabled, printer_name, printer_ip')
    .eq('restaurant_id', config.restaurantId)
    .order('name');
  return {
    signedIn: true,
    email: config.email,
    departmentIds: config.departmentIds,
    connected: true,
    departments: departments ?? [],
  };
});

ipcMain.handle('set-departments', async (_e, departmentIds) => {
  config.departmentIds = departmentIds;
  saveConfig();
  if (config.agentId && supabase && session) {
    await supabase.from('print_agents').update({ department_ids: departmentIds }).eq('id', config.agentId);
  }
  return { ok: true };
});

ipcMain.handle('test-print', async (_e, departmentId) => {
  try {
    const { error } = await supabase.rpc('enqueue_department_test_print', { p_department_id: departmentId });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not send the test print.' };
  }
});

// ── lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  loadConfig();
  createWindow();
  createTray();
  enableAutoStart();
  if (config.email && config.password) {
    signIn(config.email, config.password).catch(() => {});
  }
});
app.on('window-all-closed', () => { /* stay in tray */ });
