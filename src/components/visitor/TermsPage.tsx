import { ArrowLeft } from 'lucide-react';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS, type TermsBlock } from '@/lib/termsContent';

interface TermsPageProps {
  onClose: () => void;
}

function TermsContentBlock({ block }: { block: TermsBlock }) {
  if (block.type === 'list') {
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-olive-600">
        {block.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === 'sub') {
    return <h3 className="pt-1 text-sm font-semibold text-ink">{block.text}</h3>;
  }
  return <p className="text-sm leading-relaxed text-ink-soft">{block.text}</p>;
}

export function TermsPage({ onClose }: TermsPageProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-cream-100 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Terms & Conditions"
    >
      <header className="flex items-center gap-3 border-b border-cream-200 bg-cream-50 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to checkout"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Terms & Conditions</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft">
        <article className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
          <div className="mb-8 border-b border-cream-200 pb-6">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Terms & Conditions
            </h1>
            <p className="mt-1 text-sm font-medium text-ink-muted">Restaurant Ordering Terms</p>
            <p className="mt-3 text-xs text-ink-faint">Last updated: {TERMS_LAST_UPDATED}</p>
          </div>

          {TERMS_SECTIONS.map((section, index) => (
            <section key={section.title} className="mb-8">
              <h2 className="font-display text-base font-semibold text-ink sm:text-lg">
                <span className="mr-2 text-olive-700">{index + 1}.</span>
                {section.title}
              </h2>
              <div className="mt-3 space-y-3">
                {section.blocks.map((block, blockIndex) => (
                  <TermsContentBlock key={blockIndex} block={block} />
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
