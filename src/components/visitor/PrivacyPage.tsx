import { ArrowLeft } from 'lucide-react';

const PROVIDER_CONTACT_EMAIL = 'support@example.com'; // TODO: replace with the provider's official support email before publication

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
            <h2 className="font-display text-base font-semibold text-ink">Browser storage</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Visitor Chat saves the following in your browser so the service works for you:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-olive-600">
              <li>Your chat conversation, so it is restored if you reload the page.</li>
              <li>Your basket contents, so you do not lose your selected items.</li>
              <li>A reference to your last confirmed order.</li>
              <li>A temporary checkout key that prevents your order from being submitted twice.</li>
            </ul>
            <p className="text-sm leading-relaxed text-ink-soft">
              This browser storage is used only to provide the service you asked for. It is not
              used for advertising, profiling or tracking, and Visitor Chat does not set any
              cookies. Because only strictly necessary storage is used, no cookie consent is
              required.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">AI chat processing</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              When you send a message, it is transmitted to an external AI provider chosen by the
              platform operator so that an AI response can be generated. Information about the
              items in your basket may also be shared with the AI assistant as part of the
              conversation, for example when you ask about your order so far.
            </p>
            <p className="text-sm leading-relaxed text-ink-soft">
              The AI assistant does not see the checkout page, your final order summary, your
              mobile number, or the details of your confirmed order.
            </p>
            <p className="text-sm leading-relaxed text-ink-soft">
              Virgo Portal does not save chat conversations in its database. Your conversation
              history is kept only in your own browser, as described above. We cannot state what
              the AI provider does with message data on its side; if you have questions about
              this, please contact us using the details below.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">Orders and your mobile number</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              You do not need an account, registration or login to use Visitor Chat. When you
              check out, we ask for your mobile number so the restaurant can contact you about
              your order.
            </p>
            <p className="text-sm leading-relaxed text-ink-soft">
              Your mobile number is stored in the platform's order database together with your
              order details, and stays associated with that order. The restaurant (the "Host")
              receives your mobile number and order details through Virgo Portal, and uses them
              to prepare, fulfil and communicate about your order. Orders — including completed
              and cancelled ones — remain in the database as historical records.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">Third-party services</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-olive-600">
              <li>
                Supabase provides the platform's backend, database and ordering infrastructure.
                Order information and customer mobile numbers are stored in the platform
                database. Visitor chat messages and basket context are sent to the configured AI
                provider for responses; the AI provider does not receive checkout information or
                confirmed order details.
              </li>
              <li>
                Google Fonts serves the typefaces used on this page. When the page loads, your
                browser contacts Google's servers to fetch them.
              </li>
            </ul>
            <p className="text-sm leading-relaxed text-ink-soft">
              No analytics services, advertising pixels or marketing trackers are used in Visitor
              Chat.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">How long we keep information</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Your chat history and basket stay stored in your browser until you clear them in
              Visitor Chat, or until you clear your browser's site data for this page. Order
              records, together with the mobile numbers associated with them, remain in the
              platform database as historical records.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">Your privacy rights</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Under the GDPR, you have the right to:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-olive-600">
              <li>Access the personal information we process about you.</li>
              <li>Have inaccurate information corrected.</li>
              <li>Have your information erased, where legally applicable.</li>
              <li>Restrict the processing of your information, where applicable.</li>
              <li>Object to processing, where applicable.</li>
              <li>Lodge a complaint with your relevant data protection authority.</li>
            </ul>
            <p className="text-sm leading-relaxed text-ink-soft">
              To submit a privacy-related request, contact the Virgo Portal provider at{' '}
              <a
                href={`mailto:${PROVIDER_CONTACT_EMAIL}`}
                className="font-medium text-olive-700 underline underline-offset-2 transition-colors duration-150 hover:text-olive-800"
              >
                {PROVIDER_CONTACT_EMAIL}
              </a>
              . Please note that your chat history and basket are stored only in your own
              browser, which you can clear yourself at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-ink">Contact</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Virgo Portal is operated by its platform provider. For privacy questions, contact{' '}
              <a
                href={`mailto:${PROVIDER_CONTACT_EMAIL}`}
                className="font-medium text-olive-700 underline underline-offset-2 transition-colors duration-150 hover:text-olive-800"
              >
                {PROVIDER_CONTACT_EMAIL}
              </a>
              . Legal identity and business registration details will be published here when
              confirmed.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
