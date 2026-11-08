import { motion, useReducedMotion } from 'motion/react';
import { QrCode, Languages, ShoppingBasket, BadgeCheck } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { PhoneMock, MenuLines } from './WelcomeChapter';
import { EASE } from '../visuals';

const JOURNEY = [
  { icon: Languages, text: 'Picks their language' },
  { icon: ShoppingBasket, text: 'Adds dishes to the basket' },
  { icon: BadgeCheck, text: 'Receives the order confirmation' },
];

export function CustomerChapter() {
  const reduce = useReducedMotion();
  return (
    <ChapterShell
      id="chapter-customer"
      chapterNumber={7}
      kicker="Your Customer's Experience"
      title="From a scan on the table to a confirmed order."
    >
      <ChapterText>
        <p>
          Your guests don't download anything. They scan the QR code at their table, and your menu opens in
          their own language, right in the browser.
        </p>
        <motion.ol
          initial={reduce ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={reduce ? undefined : { visible: { transition: { staggerChildren: 0.12 } } }}
          className="space-y-3"
        >
          {JOURNEY.map(({ icon: Icon, text }) => (
            <motion.li
              key={text}
              variants={reduce ? undefined : { hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } }}
              className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft ring-1 ring-cream-200/80"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-ink">{text}</span>
            </motion.li>
          ))}
        </motion.ol>
        <p className="text-sm text-ink-muted">
          Serving options, variants and add-ons are all chosen on the same screen — the order that reaches you
          is complete and clear.
        </p>
      </ChapterText>

      <div className="relative flex h-[480px] items-center justify-center sm:h-[540px]">
        {/* QR code card */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: 8 }}
          whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease: EASE }}
          className="absolute left-[6%] top-[10%] flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 shadow-lift ring-1 ring-cream-200"
        >
          <QrCode className="h-14 w-14 text-ink" />
          <span className="text-[10px] font-medium text-ink-muted">Scan me</span>
        </motion.div>

        {/* scan pulse rings */}
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute left-[13%] top-[18%] h-28 w-28 rounded-full border-2 border-olive-400"
            animate={reduce ? undefined : { scale: [1, 1.7], opacity: [0.7, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }}
          />
        ))}

        {/* scan beam to the phone */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <motion.path
            d="M22 24 C 34 30, 40 40, 46 52"
            stroke="#657554" strokeWidth="0.8" fill="none" strokeDasharray="2 2"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.8, ease: EASE }}
          />
        </svg>

        {/* smartphone */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 70, rotate: 6 }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.9, ease: EASE }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <PhoneMock>
            <MenuLines />
          </PhoneMock>
        </motion.div>

        {/* food cards float toward the phone */}
        {[
          { label: 'Pasta', tone: 'bg-warning-200', pos: 'right-[10%] top-[8%]', d: 1.0 },
          { label: 'Steak', tone: 'bg-olive-200', pos: 'right-[4%] top-[38%]', d: 1.2 },
          { label: 'Salad', tone: 'bg-olive-100', pos: 'right-[14%] top-[66%]', d: 1.4 },
        ].map(({ label, tone, pos, d }) => (
          <motion.div
            key={label}
            initial={reduce ? false : { opacity: 0, x: 70, y: 20 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: d, duration: 0.7, ease: EASE }}
            className={`absolute ${pos}`}
          >
            <div className="w-24 rounded-xl bg-white p-2 shadow-lift ring-1 ring-cream-200">
              <div className={`h-12 rounded-lg ${tone}`} />
              <p className="mt-1.5 text-[11px] font-semibold text-ink">{label}</p>
            </div>
          </motion.div>
        ))}

        {/* basket assembles */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 50, scale: 0.7 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.7, duration: 0.6, ease: EASE }}
          className="absolute bottom-[6%] left-[16%] flex items-center gap-2 rounded-2xl bg-olive-700 px-4 py-3 text-white shadow-lift"
        >
          <ShoppingBasket className="h-4 w-4" />
          <span className="text-xs font-semibold">Basket · 3 items</span>
        </motion.div>
      </div>
    </ChapterShell>
  );
}
