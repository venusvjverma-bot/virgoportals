import { motion, useReducedMotion, useTransform } from 'motion/react';
import { BellRing, BarChart3, Printer, ShieldCheck, Coins, Sparkles, Smartphone, ChefHat } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { useSectionProgress, EASE } from '../visuals';

/** Animated courier dot travelling along the order arc. */
function OrderTraveller() {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-24 w-full max-w-md">
      <svg viewBox="0 0 400 100" className="h-full w-full">
        <motion.path
          d="M30 80 C 140 0, 260 0, 370 80"
          stroke="#657554" strokeWidth="2.5" fill="none" strokeDasharray="6 5"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }} viewport={{ once: true }}
          transition={{ duration: 1.2, ease: EASE }}
        />
        {!reduce && (
          <motion.circle r="7" fill="#4E5B41" stroke="#F6F1EA" strokeWidth="2.5"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.2 }}
          >
            <animateMotion dur="2.4s" repeatCount="indefinite" path="M30 80 C 140 0, 260 0, 370 80" />
          </motion.circle>
        )}
      </svg>
      <Smartphone className="absolute -left-1 bottom-0 h-6 w-6 text-ink-soft" />
      <ChefHat className="absolute -right-1 bottom-0 h-6 w-6 text-olive-700" />
    </div>
  );
}

function StatusPill({ label, tone, delay }: { label: string; tone: string; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold shadow-soft ${tone}`}
    >
      {label}
    </motion.span>
  );
}

export function OperationsChapter() {
  const [ref, progress] = useSectionProgress();
  const reduce = useReducedMotion();
  const creditFill = useTransform(progress, [0.3, 0.8], reduce ? ['70%', '70%'] : ['0%', '70%']);

  return (
    <ChapterShell
      id="chapter-operations"
      chapterNumber={9}
      kicker="Orders & One Connected Platform"
      title="Orders land with your staff. The platform keeps it all running."
    >
      <ChapterText>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: BellRing, title: 'Live orders', text: 'Orders arrive in your dashboard in real time, with a clear flow from new to accepted to completed — and your staff see them the moment guests confirm.' },
            { icon: BarChart3, title: 'Sessions & reports', text: 'Service sessions per department can be closed with a full report — and printed receipts are available for restaurants that run a printer (optional; most don\'t need one).' },
            { icon: Printer, title: 'Payment, the simple way', text: 'Guests choose to pay your staff directly at the table or counter — no payment hardware required to get started.' },
            { icon: ShieldCheck, title: 'One shared platform', text: 'Every restaurant runs on the same dependable infrastructure — while every Host\'s data stays fully separate.' },
          ].map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.1, duration: 0.55, ease: EASE }}
              className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
            </motion.div>
          ))}
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

      <div ref={ref} className="relative flex h-[460px] flex-col items-center justify-center gap-8 sm:h-[500px]">
        {/* animated order arc */}
        <StatusPill label="Guest confirms" tone="bg-olive-700 text-white" delay={0.2} />
        <OrderTraveller />
        <div className="flex items-center gap-2">
          <StatusPill label="New" tone="bg-warning-200 text-warning-700" delay={0.8} />
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.0 }}>→</motion.span>
          <StatusPill label="Accepted" tone="bg-olive-200 text-olive-800" delay={1.1} />
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.3 }}>→</motion.span>
          <StatusPill label="Completed" tone="bg-success-200 text-success-700" delay={1.4} />
        </div>

        {/* credit meter fills as you scroll */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
          className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-lift ring-1 ring-cream-200"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-ink">
            <span>AI credits</span>
            <span>7.0 / 10</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-cream-100">
            <motion.div className="h-full rounded-full bg-olive-500" style={{ width: creditFill }} />
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">Tokens used by chat, extraction and dish images.</p>
        </motion.div>

        {/* connected restaurants */}
        <div className="flex items-center gap-3">
          {['#ACB99E', '#657554', '#DDA53C'].map((c, i) => (
            <motion.span
              key={c}
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 + i * 0.15, duration: 0.5, ease: EASE }}
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="text-[11px] font-medium text-ink-muted">independent restaurants, one platform</span>
        </div>
      </div>
    </ChapterShell>
  );
}
