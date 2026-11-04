import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Download, FileText, ShoppingBag, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatMinor, paymentLabel } from '@/lib/orders';
import { orderItemDetailLines } from '@/lib/orderItemDetails';
import type { ConfirmedOrder } from './CheckoutView';

const PAY_TO_STAFF_NOTICE =
  'Payment for this order is made to restaurant staff and is not processed through Virgo. This is not an invoice or payment receipt.';

interface OrderConfirmationProps {
  order: ConfirmedOrder;
  onClose: () => void;
}

export function OrderConfirmation({ order, onClose }: OrderConfirmationProps) {
  const created = new Date(order.createdAt);
  const payToStaff = order.paymentStatus === 'pay_to_staff';
  const [showSuccess, setShowSuccess] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  function generatePdfBlob(): Blob {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Header band
    doc.setFillColor(63, 80, 55);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Order Confirmation Ticket', pageW / 2, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(payToStaff ? 'Virgo Portals — Order' : 'Virgo Portals — Prototype Order', pageW / 2, 22, { align: 'center' });

    y = 40;
    doc.setTextColor(42, 42, 42);

    // Order number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Order #${order.orderNumber}`, margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Order ID: ${order.orderId}`, margin, y);
    y += 6;

    // Date
    doc.text(`Date: ${created.toLocaleString()}`, margin, y);
    y += 10;

    // Restaurant info
    doc.setTextColor(42, 42, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Restaurant', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(order.restaurantName, margin, y);
    y += 5;
    if (order.resourceName && order.resourceName !== order.restaurantName) {
      const label = order.resourceType === 'event' ? 'Event' : 'Department';
      doc.text(`${label}: ${order.resourceName}`, margin, y);
      y += 5;
    }
    y += 5;

    // Items table header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(245, 243, 238);
    doc.rect(margin, y - 4, contentW, 8, 'F');
    doc.text('Item', margin + 2, y + 1);
    doc.text('Qty', margin + contentW - 45, y + 1, { align: 'right' });
    doc.text('Price', margin + contentW - 25, y + 1, { align: 'right' });
    doc.text('Total', margin + contentW - 2, y + 1, { align: 'right' });
    y += 8;

    // Items
    doc.setFont('helvetica', 'normal');
    for (const item of order.items) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const nameLines = doc.splitTextToSize(item.name, contentW - 55);
      doc.text(nameLines[0], margin + 2, y);
      doc.text(String(item.quantity), margin + contentW - 45, y, { align: 'right' });
      doc.text(formatMinor(item.priceMinor, order.currency), margin + contentW - 25, y, { align: 'right' });
      doc.text(formatMinor(item.lineTotalMinor, order.currency), margin + contentW - 2, y, { align: 'right' });
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      for (const detail of orderItemDetailLines(item, order.currency)) {
        y += 4.5;
        if (y > 275) {
          doc.addPage();
          y = margin;
        }
        doc.text(detail, margin + 6, y);
      }
      doc.setFontSize(10);
      doc.setTextColor(42, 42, 42);
      y += 6;
    }

    // Tip and total
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    y += 6;
    if (order.tipMinor > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Tip', margin, y);
      doc.text(formatMinor(order.tipMinor, order.currency), margin + contentW - 2, y, { align: 'right' });
      y += 8;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total', margin, y);
    doc.text(formatMinor(order.totalMinor, order.currency), margin + contentW - 2, y, { align: 'right' });
    y += 10;

    // Status & payment
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Order status: ${order.status}`, margin, y);
    y += 6;
    doc.text(`Payment: ${paymentLabel(order.paymentStatus)}`, margin, y);
    y += 6;

    // Mobile number
    doc.text(`Mobile number: ${order.mobileNumber}`, margin, y);
    y += 12;

    // Disclaimer box
    doc.setFillColor(255, 248, 230);
    doc.rect(margin, y, contentW, 24, 'F');
    doc.setDrawColor(230, 200, 120);
    doc.rect(margin, y, contentW, 24);
    doc.setFontSize(8);
    doc.setTextColor(120, 80, 0);
    const disclaimer = payToStaff ? PAY_TO_STAFF_NOTICE :
      'This is a prototype order. No real payment has been taken and no food will be prepared. ' +
      'This ticket is not a payment receipt or invoice. The mobile number shown is the one ' +
      'provided at checkout for this specific order.';
    const discLines = doc.splitTextToSize(disclaimer, contentW - 6);
    doc.text(discLines, margin + 3, y + 5);

    return doc.output('blob');
  }

  function downloadTicket() {
    const blob = generatePdfBlob();

    // Revoke any previous Blob URL before creating a new one
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    // Create a Blob URL for the "Open PDF" button
    blobUrlRef.current = URL.createObjectURL(blob);

    // Initiate the download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-ticket-${order.orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Show success message (avoid duplicates from a single click)
    setOpenFailed(false);
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
    }
    setShowSuccess(true);
    dismissTimerRef.current = window.setTimeout(() => {
      setShowSuccess(false);
      dismissTimerRef.current = null;
    }, 6000);
  }

  function dismissSuccess() {
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setShowSuccess(false);
  }

  function handleOpenPdf() {
    if (!blobUrlRef.current) return;
    const win = window.open(blobUrlRef.current, '_blank', 'noopener');
    if (!win) {
      setOpenFailed(true);
    } else {
      setOpenFailed(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream-100 animate-fade-in">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft">
        <div className="mx-auto max-w-md px-5 py-8">
          {/* Success indicator */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-olive-100">
              <Check className="h-8 w-8 text-olive-700" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-ink">
              Order confirmed
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Your {payToStaff ? '' : 'test '}order has been sent to the restaurant.
            </p>
          </div>

          {/* Order number */}
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Order number
              </span>
              <span className="font-display text-lg font-bold text-olive-700">
                {order.orderNumber}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-cream-200 pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Status
              </span>
              <span className="inline-flex items-center rounded-full bg-olive-100 px-2.5 py-1 text-xs font-semibold capitalize text-olive-700">
                {order.status}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-cream-200 pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Payment
              </span>
              <span className="text-xs font-semibold text-warning-700">
                {paymentLabel(order.paymentStatus)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-cream-200 pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Mobile
              </span>
              <span className="text-xs font-semibold text-ink">
                {order.mobileNumber}
              </span>
            </div>
          </div>

          {/* Restaurant and resource */}
          <div className="mt-4 rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Restaurant</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{order.restaurantName}</p>
            {order.resourceName && order.resourceName !== order.restaurantName ? (
              <>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {order.resourceType === 'event' ? 'Event' : 'Department'}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{order.resourceName}</p>
              </>
            ) : null}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
              <Clock className="h-3.5 w-3.5" />
              {created.toLocaleString()}
            </div>
          </div>

          {/* Items */}
          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-cream-200">
            <div className="border-b border-cream-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-ink">Ordered items</h3>
            </div>
            <ul className="divide-y divide-cream-200">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">{item.quantity} × {formatMinor(item.priceMinor, order.currency)}</p>
                    {orderItemDetailLines(item, order.currency).map((detail, detailIdx) => (
                      <p key={detailIdx} className="text-xs font-medium text-olive-800">{detail}</p>
                    ))}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-olive-700">
                    {formatMinor(item.lineTotalMinor, order.currency)}
                  </span>
                </li>
              ))}
            </ul>
            {order.tipMinor > 0 ? (
              <div className="flex items-center justify-between border-t border-cream-200 px-5 py-3">
                <span className="text-sm text-ink-soft">Tip</span>
                <span className="text-sm font-medium text-ink">{formatMinor(order.tipMinor, order.currency)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-cream-200 px-5 py-3">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="font-display text-lg font-semibold text-ink">
                {formatMinor(order.totalMinor, order.currency)}
              </span>
            </div>
          </div>

          {/* Prototype notice */}
          <div className="mt-5 rounded-xl bg-warning-50 px-4 py-3 ring-1 ring-warning-200">
            <p className="text-xs text-warning-800">
              {payToStaff
                ? PAY_TO_STAFF_NOTICE
                : 'This is a prototype order. No payment has been taken and no food will be prepared. This is not an invoice or payment receipt.'}
            </p>
          </div>

          {/* Download ticket button */}
          <button
            type="button"
            onClick={downloadTicket}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-olive-700 bg-white py-3.5 text-sm font-semibold text-olive-700 shadow-soft transition-all duration-200 hover:bg-olive-50 active:scale-[0.99]"
          >
            <Download className="h-4 w-4" />
            Download order ticket (PDF)
          </button>

          {/* Success message with Open PDF */}
          {showSuccess ? (
            <div
              role="status"
              className="mt-3 animate-fade-in rounded-2xl bg-olive-50 p-4 shadow-soft ring-1 ring-olive-200"
            >
              <div className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-olive-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-olive-800">
                    Order ticket downloaded successfully. Check your Downloads folder.
                  </p>
                  {openFailed ? (
                    <p className="mt-1.5 text-xs text-warning-700">
                      Could not open the PDF in a new tab. Please open it from your Downloads folder.
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenPdf}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-olive-700 px-3 py-2 text-xs font-semibold text-white transition-all duration-200 hover:bg-olive-800 active:scale-[0.98]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Open PDF
                    </button>
                    <button
                      type="button"
                      onClick={dismissSuccess}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Done button */}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-olive-700 py-3.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-olive-800 hover:shadow-lift active:scale-[0.99]"
          >
            <ShoppingBag className="h-4 w-4" />
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
