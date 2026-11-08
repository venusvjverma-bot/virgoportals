import { BellRing, BarChart3, Printer, ShieldCheck, Coins, Sparkles } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';

export function OperationsChapter() {
  return (
    <ChapterShell
      id="chapter-operations"
      chapterNumber={9}
      kicker="Orders & One Connected Platform"
      title="Orders land with your staff. The platform keeps it all running."
    >
      <ChapterText>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
              <BellRing className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Live orders</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Orders arrive in your dashboard in real time, with a clear flow from new to accepted to
              completed — and your staff see them the moment guests confirm.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
              <BarChart3 className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Sessions &amp; reports</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Service sessions per department can be closed with a full report — and printed receipts are
              available for restaurants that run a printer (optional; most don't need one).
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
              <Printer className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">Payment, the simple way</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Guests choose to pay your staff directly at the table or counter — no payment hardware
              required to get started.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">One shared platform</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Every restaurant runs on the same dependable infrastructure — while every Host's data stays
              fully separate.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-cream-100 p-4 ring-1 ring-cream-200">
          <Coins className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
          <p className="text-sm leading-relaxed text-ink-soft">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-olive-600" />
            AI features run on simple credits: each Host has a credit balance, and AI usage — chat, menu
            extraction, dish images — is metered transparently against it.
          </p>
        </div>
      </ChapterText>
      <ChapterVisual src="/platform.webp" alt="Independent restaurant environments on a shared platform" />
    </ChapterShell>
  );
}
