import { jsPDF } from 'jspdf';
import { formatMinor } from '@/lib/currency';
import { orderItemDetailLines } from '@/lib/orderItemDetails';

export const PAY_TO_STAFF_NOTICE =
  'Payment for this order is made to restaurant staff and is not processed through Virgo. This is not an invoice or payment receipt.';

export const PROTOTYPE_TICKET_NOTICE =
  'This is a prototype order. No real payment has been taken and no food will be prepared. ' +
  'This ticket is not a payment receipt or invoice. The mobile number shown is the one ' +
  'provided at checkout for this specific order.';

export interface ReceiptTicketItem {
  name: string;
  priceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  servingLabel: string | null;
  variantName: string | null;
  removedIngredients: string;
  addOns: { name: string; priceMinor: number }[];
}

export interface ReceiptTicketData {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  tipMinor: number;
  totalMinor: number;
  currency: string;
  createdAt: string;
  restaurantName: string;
  resourceName: string;
  resourceType: string;
  mobileNumber: string | null;
  items: ReceiptTicketItem[];
}

function drawReceipt(doc: jsPDF, order: ReceiptTicketData): number {
  const pageW = 80;
  const margin = 4;
  const contentW = pageW - margin * 2;
  const right = margin + contentW;
  const created = new Date(order.createdAt);
  const payToStaff = order.paymentStatus === 'pay_to_staff';
  let y = 6;

  const sep = () => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, right, y);
  };

  doc.setTextColor(0, 0, 0);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('VIRGO PORTALS', pageW / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFontSize(11);
  doc.text('ORDER CONFIRMATION', pageW / 2, y, { align: 'center' });
  y += 6;
  sep();
  y += 4;

  doc.setFontSize(10);
  doc.text(order.restaurantName, pageW / 2, y, { align: 'center' });
  y += 5.5;
  if (order.resourceName && order.resourceName !== order.restaurantName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(order.resourceName, pageW / 2, y, { align: 'center' });
    y += 6;
  }
  y += 1.5;
  sep();
  y += 4;

  // Order info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`ORDER #${order.orderNumber}`, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Order ID: ${order.orderId}`, margin, y);
  y += 4;
  doc.setFontSize(9);
  doc.text(`Date: ${created.toLocaleString()}`, margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Status: ${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}`, margin, y);
  y += 5;
  sep();
  y += 4;

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('ITEMS', margin, y);
  y += 4.5;

  for (const item of order.items) {
    const nameLines = doc.splitTextToSize(item.name, contentW - 20) as string[];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    nameLines.forEach((line, i) => {
      doc.text(line, margin, y);
      if (i === 0) doc.text(formatMinor(item.lineTotalMinor, order.currency), right, y, { align: 'right' });
      y += 4;
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${item.quantity} x ${formatMinor(item.priceMinor, order.currency)}`, margin + 1, y);
    y += 3.4;
    doc.setFontSize(7.5);
    for (const detail of orderItemDetailLines(item, order.currency)) {
      const detailLines = doc.splitTextToSize(detail, contentW - 4) as string[];
      for (const detailLine of detailLines) {
        doc.text(detailLine, margin + 3, y);
        y += 3.4;
      }
    }
    y += 1.5;
  }

  y += 0.5;
  sep();
  y += 3.5;

  if (order.tipMinor > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Tip', margin, y);
    doc.text(formatMinor(order.tipMinor, order.currency), right, y, { align: 'right' });
    y += 4.5;
    sep();
    y += 3.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL', margin, y);
  doc.text(formatMinor(order.totalMinor, order.currency), right, y, { align: 'right' });
  y += 6;
  sep();
  y += 4;

  // Payment info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const method = payToStaff ? 'Pay to Staff' : 'Test Payment';
  doc.text(`Payment method: ${method}`, margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.text('Payment status: NOT PAID', margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Mobile: ${order.mobileNumber ?? 'Not provided'}`, margin, y);
  y += 5.5;
  sep();
  y += 4;

  // Footer
  doc.setFontSize(6.8);
  const disclaimer = payToStaff ? PAY_TO_STAFF_NOTICE : PROTOTYPE_TICKET_NOTICE;
  const discLines = doc.splitTextToSize(disclaimer, contentW) as string[];
  for (const line of discLines) {
    doc.text(line, margin, y);
    y += 3.1;
  }
  y += 4;
  return y;
}

export function generateTicketBlob(order: ReceiptTicketData): Blob {
  const measureDoc = new jsPDF({ unit: 'mm', format: [80, 600] });
  const contentBottom = drawReceipt(measureDoc, order);
  const height = Math.ceil(contentBottom + 4);
  const doc = new jsPDF({ unit: 'mm', format: [80, height] });
  drawReceipt(doc, order);
  return doc.output('blob');
}
