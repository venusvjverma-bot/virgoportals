import { jsPDF } from 'jspdf';

/**
 * Shared A4 invoice template for subscription, renewal, and credit top-up
 * payments. Payment-specific descriptions, amounts, VAT, and references are
 * supplied by the caller; this module owns presentation only.
 */
export interface SubscriptionInvoiceData {
  title?: string;
  footerNote?: string;
  subscriptionRef: string | null;
  paymentRef: string | null;
  restaurantName: string;
  ownerEmail: string;
  lineDescription: string;
  amountCents: number;
  currency: string;
  /** VAT rate to break out (e.g. 0.25 for Swedish VAT). 0 or omitted = no VAT line. */
  vatRate?: number;
  /** Exact VAT amount charged (minor units). When set, overrides the derived calculation. */
  vatCents?: number | null;
  /** Exact total charged including VAT (minor units). When set, overrides the derived calculation. */
  totalCents?: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  /** IANA timezone used for invoice dates, matching the host dashboard. */
  timeZone?: string;
  isTest: boolean;
}

const COLORS = {
  green: [43, 83, 55] as const,
  darkGreen: [29, 57, 38] as const,
  paleGreen: [232, 240, 232] as const,
  text: [38, 40, 37] as const,
  muted: [105, 108, 101] as const,
  rule: [185, 202, 185] as const,
  testBg: [250, 246, 232] as const,
  testText: [158, 93, 15] as const,
};

function money(cents: number, currency: string): string {
  const code = (currency || 'SEK').toUpperCase();
  if (code === 'USD') return `${(cents / 100).toFixed(2)}`;
  const hasOre = Math.round(cents) % 100 !== 0;
  const digits = hasOre ? 2 : 0;
  return `${new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100)} kr`;
}

function fmtDate(iso: string | null, timeZone: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  });
}

function drawInvoice(doc: jsPDF, inv: SubscriptionInvoiceData): number {
  const pageW = 210;
  const margin = 20;
  const right = pageW - margin;
  const contentW = right - margin;
  let y = 22;

  const setText = (color: readonly number[]) => doc.setTextColor(color[0], color[1], color[2]);
  const setDraw = (color: readonly number[]) => doc.setDrawColor(color[0], color[1], color[2]);
  const setFill = (color: readonly number[]) => doc.setFillColor(color[0], color[1], color[2]);

  const rule = (atY: number, width = 0.35) => {
    setDraw(COLORS.rule);
    doc.setLineWidth(width);
    doc.line(margin, atY, right, atY);
  };

  const drawWrapped = (value: string, x: number, atY: number, maxW: number, lineH: number) => {
    const lines = doc.splitTextToSize(value, maxW) as string[];
    doc.text(lines, x, atY);
    return atY + Math.max(1, lines.length) * lineH;
  };

  // Test payments retain a clear warning while using the same invoice layout.
  if (inv.isTest) {
    setFill(COLORS.testBg);
    doc.roundedRect(margin, y - 7, contentW, 12, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(COLORS.testText);
    doc.text('TEST — NOT A REAL PAYMENT INVOICE', pageW / 2, y + 1, { align: 'center' });
    y += 15;
  }

  // Two-column issuer header: portal identity on the left, legal company
  // information on the right, separated by a vertical green rule.
  const dividerX = 111;
  const headerTop = y - 1;
  const headerBottom = y + 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  setText(COLORS.darkGreen);
  doc.text('VIRGO PORTALS', margin, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setText(COLORS.green);
  doc.text(inv.title ?? 'Subscription Invoice', margin, y + 17);

  setDraw(COLORS.green);
  doc.setLineWidth(0.7);
  doc.line(dividerX, headerTop, dividerX, headerBottom);

  const companyX = dividerX + 8;
  const companyW = right - companyX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setText(COLORS.darkGreen);
  doc.text('Virgo Imagination', companyX, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(COLORS.text);
  let companyY = y + 14;
  companyY = drawWrapped('Organisation number: 880905-6792', companyX, companyY, companyW, 4.5);
  companyY = drawWrapped('Södergatan 53,', companyX, companyY, companyW, 4.5);
  companyY = drawWrapped('19547, Märsta,', companyX, companyY, companyW, 4.5);
  drawWrapped('Sweden', companyX, companyY, companyW, 4.5);

  y = headerBottom + 8;
  rule(y, 0.55);
  y += 11;

  // Customer and payment details.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(COLORS.text);
  const detailW = contentW;
  y = drawWrapped(`Billed to: ${inv.restaurantName} (${inv.ownerEmail})`, margin, y, detailW, 5);
  y = drawWrapped(`Invoice date: ${fmtDate(inv.paidAt ?? new Date().toISOString(), inv.timeZone ?? 'UTC')}`, margin, y, detailW, 5);
  y = drawWrapped(`Subscription: ${inv.subscriptionRef ?? '—'}`, margin, y, detailW, 5);
  y = drawWrapped(`Payment reference: ${inv.paymentRef ?? '—'}`, margin, y, detailW, 5);
  y += 5;
  rule(y);
  y += 8;

  // Payment values remain entirely data-driven. The charged total is VAT-
  // inclusive; VAT is extracted from it so the displayed total reconciles.
  const rate = inv.vatRate ?? 0;
  const totalCents = inv.totalCents ?? inv.amountCents;
  const netCents = rate > 0 ? Math.round(totalCents / (1 + rate)) : totalCents;
  const vatCents = totalCents - netCents;

  const labelX = margin + 2;
  const amountX = right - 2;
  const tableTop = y;
  const headerH = 10;
  setFill(COLORS.paleGreen);
  doc.roundedRect(margin, tableTop, contentW, headerH, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(COLORS.darkGreen);
  doc.text('Description', labelX, tableTop + 6.7);
  doc.text('Amount', amountX, tableTop + 6.7, { align: 'right' });
  y = tableTop + headerH + 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(COLORS.text);
  const descriptionW = contentW - 48;
  const descriptionLines = doc.splitTextToSize(inv.lineDescription, descriptionW) as string[];
  doc.text(descriptionLines, labelX, y);
  doc.text(money(totalCents, inv.currency), amountX, y, { align: 'right' });
  y += Math.max(6, descriptionLines.length * 5);

  if (rate > 0) {
    doc.text('Price excl. VAT', labelX, y);
    doc.text(money(netCents, inv.currency), amountX, y, { align: 'right' });
    y += 5.5;
    doc.text(`VAT ${Math.round(rate * 100)}%`, labelX, y);
    doc.text(money(vatCents, inv.currency), amountX, y, { align: 'right' });
    y += 5.5;
  }

  doc.setFontSize(8.5);
  setText(COLORS.muted);
  doc.text(
    inv.periodStart && inv.periodEnd
      ? `Billing period: ${fmtDate(inv.periodStart, inv.timeZone ?? 'UTC')} – ${fmtDate(inv.periodEnd, inv.timeZone ?? 'UTC')}`
      : 'Billing period: —',
    labelX,
    y,
  );
  y += 10;
  rule(y, 0.55);
  y += 10;

  // Emphasized total row with a restrained pale-green amount highlight.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setText(COLORS.darkGreen);
  doc.text('TOTAL', margin + 2, y + 1);

  const totalLabel = money(totalCents, inv.currency);
  const totalBoxW = Math.max(34, doc.getTextWidth(totalLabel) + 10);
  const totalBoxH = 12;
  setFill(COLORS.paleGreen);
  doc.roundedRect(right - totalBoxW, y - 6, totalBoxW, totalBoxH, 2, 2, 'F');
  doc.text(totalLabel, right - 5, y + 1, { align: 'right' });
  y += 12;
  rule(y, 0.55);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(COLORS.muted);
  const footer = inv.footerNote
    ?? 'All subscription prices are in SEK excluding VAT. Swedish VAT is added at checkout. Payment processed by Virgo Portals.';
  drawWrapped(footer, margin + 1, y, contentW - 2, 4);

  return y;
}

export function generateSubscriptionInvoiceBlob(inv: SubscriptionInvoiceData): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawInvoice(doc, inv);
  return doc.output('blob');
}

export function isTestPayment(paymentRef: string | null, provider?: string | null): boolean {
  return provider === 'mock-test' || (paymentRef?.startsWith('test_') ?? false);
}
