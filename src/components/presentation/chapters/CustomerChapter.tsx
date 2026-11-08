import { motion, useReducedMotion } from 'motion/react';
import { QrCode, Languages, BookOpen, ShoppingBasket, Smartphone, BadgeCheck } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';

const STEPS = [
  { icon: QrCode, text: 'Guest scans your QR code' },
  { icon: Languages, text: 'Picks their language' },
  { icon: BookOpen, text: 'Browses your menu' },
  { icon: ShoppingBasket, text: 'Adds dishes to the basket' },
  { icon: Smartphone, text: 'Confirms their details at checkout' },
  { icon: BadgeCheck, text: 'Receives the order confirmation' },
];

export function CustomerChapter() {
  const reduceMotion = useReducedMotion();
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
          initial={reduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={reduceMotion ? undefined : { visible: { transition: { staggerChildren: 0.12 } } }}
          className="space-y-3"
        >
          {STEPS.map(({ icon: Icon, text }) => (
            <motion.li
              key={text}
              variants={reduceMotion ? undefined : { hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } }}
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
      <ChapterVisual src="/customer-phone.webp" alt="A smartphone showing the digital menu connected to a QR code" />
    </ChapterShell>
  );
}
