import { jsPDF } from 'jspdf';

/**
 * The single subscription invoice design, shared by real and test payments.
 * The ONLY difference for test payments is the prominent TEST label
 * (`isTest`), driven by the payment's provider/reference.
 */

export interface SubscriptionInvoiceData {
  subscriptionRef: string | null;
  paymentRef: string | null;
  restaurantName: string;
  ownerEmail: string;
  packageName: string;
  amountCents: number;
  currency: string;
  cycleNumber: number;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  isTest: boolean;
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function drawInvoice(doc: jsPDF, inv: SubscriptionInvoiceData): number {
  const pageW = 210;
  const margin = 20;
  const right = pageW - margin;
  let y = 24;

  const sep = () => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, right, y);
  };

  // TEST banner — the only difference from a real invoice
  if (inv.isTest) {
    doc.setFillColor(250, 246, 232);
    doc.rect(margin, y - 6, pageW - margin * 2, 12, 'F');
    doc.setTextColor(158, 93, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TEST — NOT A REAL PAYMENT INVOICE', pageW / 2, y + 1.5, { align: 'center' });
    y += 12;
    doc.setTextColor(0, 0, 0);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('VIRGO PORTALS', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Subscription Invoice', margin, y);
  y += 10;
  sep();
  y += 8;

  doc.setFontSize(9);
  doc.text(`Billed to: ${inv.restaurantName} (${inv.ownerEmail})`, margin, y);
  y += 5;
  doc.text(`Invoice date: ${fmtDate(inv.paidAt ?? new Date().toISOString())}`, margin, y);
  y += 5;
  doc.text(`Subscription: ${inv.subscriptionRef ?? '—'}`, margin, y);
  y += 5;
  doc.text(`Payment reference: ${inv.paymentRef ?? '—'}`, margin, y);
  y += 9;
  sep();
  y += 8;

  // Line item
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin, y);
  doc.text('Amount', right, y, { align: 'right' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`${inv.packageName} plan — monthly (cycle ${inv.cycleNumber})`, margin, y);
  doc.text(usd(inv.amountCents), right, y, { align: 'right' });
  y += 5;
  doc.setFontSize(8.5);
  doc.text(
    inv.periodStart && inv.periodEnd
      ? `Billing period: ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`
      : 'Billing period: —',
    margin,
    y,
  );
  y += 9;
  sep();
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL', margin, y);
  doc.text(usd(inv.amountCents), right, y, { align: 'right' });
  y += 8;
  sep();
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('All subscription prices are in USD. Payment processed by Virgo Portals.', margin, y);
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
