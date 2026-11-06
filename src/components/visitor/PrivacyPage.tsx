import { ArrowLeft } from 'lucide-react';

export function PrivacyPage({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-cream-100 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Privacy Policy"
    >
      <header className="flex items-center gap-3 border-b border-cream-200 bg-cream-50 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink">Privacy Policy</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft px-5 py-6">
        <div className="mx-auto max-w-lg space-y-5 pb-10">
          <p className="text-sm leading-relaxed text-ink-soft">
            Last updated: 6 November 2026
          </p>
          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">What we store on your device</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Visitor Chat saves information in your browser only so the service works for you:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-olive-600">
              <li>Your chat conversation, so it is restored if you reload the page.</li>
              <li>Your basket contents, so you do not lose your selected items.</li>
              <li>A reference to your last confirmed order.</li>
              <li>A temporary key during checkout that prevents your order from being created twice.</li>
            </ul>
            <p className="text-sm leading-relaxed text-ink-soft">
              This storage is strictly necessary to provide the service you asked for. We do not
              use it for advertising, profiling, or tracking, and we do not set any cookies in
              Visitor Chat. Because this is the only storage used, no cookie consent is required.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">Third-party services</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-olive-600">
              <li>
                Supabase hosts the chat and ordering functions of this service. Your messages,
                basket and order details are processed there to run the service.
              </li>
              <li>
                Google Fonts serves the typefaces used on this page. When the page loads, your
                browser contacts Google's servers to fetch them.
              </li>
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">Your data</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              When you place an order, your mobile number and order details are shared with the
              restaurant so they can prepare and serve your order. You can clear your saved chat
              and basket at any time from within Visitor Chat, or by clearing your browser's site
              data for this page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
