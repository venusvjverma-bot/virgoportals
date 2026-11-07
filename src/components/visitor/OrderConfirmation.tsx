import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Download, FileText, ShoppingBag, X } from 'lucide-react';
import { formatMinor, paymentLabel } from '@/lib/orders';
import { generateTicketBlob, PAY_TO_STAFF_NOTICE } from '@/lib/orderTicket';
import { orderItemDetailLines } from '@/lib/orderItemDetails';
import type { ConfirmedOrder } from './CheckoutView';

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
    return generateTicketBlob({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      tipMinor: order.tipMinor,
      serviceType: order.serviceType ?? null,
      serviceLocation: order.serviceLocation ?? null,
      serviceChargeMinor: order.serviceChargeMinor ?? 0,
      totalMinor: order.totalMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      restaurantName: order.restaurantName,
      resourceName: order.resourceName,
      resourceType: order.resourceType,
      mobileNumber: order.mobileNumber,
      items: order.items,
    });
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
            {order.serviceType && order.serviceLocation ? (
              <div className="mt-3 flex items-center justify-between border-t border-cream-200 pt-3">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {order.serviceType === 'room' ? 'Room Service · Room Number' : 'Table Service · Table Number'}
                </span>
                <span className="text-sm font-semibold text-ink">{order.serviceLocation}</span>
              </div>
            ) : null}
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
            {order.serviceType && (order.serviceChargeMinor ?? 0) > 0 ? (
              <div className="flex items-center justify-between border-t border-cream-200 px-5 py-3">
                <span className="text-sm text-ink-soft">
                  {order.serviceType === 'room' ? 'Room service charge' : 'Table service charge'}
                </span>
                <span className="text-sm font-medium text-ink">
                  {formatMinor(order.serviceChargeMinor ?? 0, order.currency)}
                </span>
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
