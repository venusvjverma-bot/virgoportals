import { motion, useReducedMotion } from 'motion/react';
import { QrCode, UtensilsCrossed, MessageCircle, ClipboardList } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { Mascot } from '../Mascot';
import { Floating, EASE } from '../visuals';

export function WelcomeChapter() {
  const reduce = useReducedMotion();
  return (
    <ChapterShell
      id="chapter-welcome"
      chapterNumber={1}
      kicker="Welcome"
      title={
        <>
          Your restaurant. <span className="text-olive-700">Connected through one digital experience.</span>
        </>
      }
    >
      <ChapterText>
        <p>
          Virgo Portals gives your restaurant a digital presence your guests can open with a single scan — a
          beautiful menu, an AI assistant that answers their questions, and orders that arrive straight at your
          counter.
        </p>
        <p>
          One place to manage your menu. One link between your tables and your kitchen. No apps for your
          guests to install.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { icon: QrCode, text: 'QR-based guest access', d: 0 },
            { icon: UtensilsCrossed, text: 'Centralised menu management', d: 0.1 },
            { icon: MessageCircle, text: 'AI-assisted customer interaction', d: 0.2 },
            { icon: ClipboardList, text: 'Restaurant order management', d: 0.3 },
          ].map(({ icon: Icon, text, d }) => (
            <motion.div
              key={text}
              initial={reduce ? false : { opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: d, duration: 0.55, ease: EASE }}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-ink">{text}</span>
            </motion.div>
          ))}
        </div>
      </ChapterText>

      <div className="relative flex h-[420px] items-center justify-center sm:h-[480px]">
        {/* table surface */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scaleX: 0.6 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="absolute bottom-16 h-24 w-72 rounded-3xl bg-cream-200 shadow-soft sm:w-96"
        />
        {/* table legs */}
        {[14, 76].map((left) => (
          <motion.div
            key={left}
            initial={reduce ? false : { opacity: 0, scaleY: 0 }}
            whileInView={{ opacity: 1, scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
            style={{ left: `${left}%` }}
            className="absolute bottom-0 h-16 w-4 origin-top rounded-b-xl bg-cream-300"
          />
        ))}
        {/* plate */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0, y: -60 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.45, duration: 0.7, ease: EASE }}
          className="absolute bottom-24 left-[8%] h-20 w-20 rounded-full bg-white shadow-lift ring-4 ring-cream-200"
        >
          <div className="absolute inset-3 rounded-full bg-olive-100" />
          <div className="absolute inset-6 rounded-full bg-olive-300" />
        </motion.div>
        {/* smartphone rising from the table */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 90, rotate: -8 }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.9, ease: EASE }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2"
        >
          <PhoneMock>
            <MenuLines />
          </PhoneMock>
        </motion.div>
        {/* QR card flying to the phone */}
        <Floating delay={0.9} className="absolute right-[6%] top-[16%]">
          <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl bg-white p-3 shadow-lift ring-1 ring-cream-200">
            <QrCode className="h-10 w-10 text-olive-700" />
            <div className="h-1 w-10 rounded bg-cream-200" />
          </div>
        </Floating>
        {/* connection beam QR -> phone */}
        <motion.div
          initial={reduce ? false : { opacity: 0, pathLength: 0 }}
          whileInView={{ opacity: 1, pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.1, duration: 0.9, ease: EASE }}
          className="pointer-events-none absolute inset-0"
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <motion.path
              d="M78 32 C 66 40, 60 52, 56 66"
              stroke="#657554"
              strokeWidth="0.8"
              fill="none"
              strokeDasharray="2 2"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.1, duration: 0.9, ease: EASE }}
            />
          </svg>
        </motion.div>
        {/* mascot greets */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2, duration: 0.8, ease: EASE }}
          className="absolute bottom-4 left-0 scale-90 sm:scale-100"
        >
          <Mascot pose="waving" say="Welcome! Let me show you around." />
        </motion.div>
      </div>
    </ChapterShell>
  );
}

export function PhoneMock({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-64 w-32 rounded-[1.6rem] bg-ink p-1.5 shadow-lift sm:h-72 sm:w-36">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.2rem] bg-cream-50">
        <div className="flex items-center justify-center pt-1.5">
          <div className="h-1 w-8 rounded-full bg-ink/20" />
        </div>
        <div className="flex-1 overflow-hidden p-2">{children}</div>
      </div>
    </div>
  );
}

export function MenuLines() {
  return (
    <div className="space-y-1.5">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 1.0, duration: 0.4 }}
        className="h-8 rounded-lg bg-olive-200"
      />
      {[1.1, 1.2, 1.3].map((d, i) => (
        <motion.div
          key={d}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: d, duration: 0.4 }}
          className="flex items-center gap-1.5"
        >
          <div className={`h-7 w-7 rounded-md ${['bg-cream-200', 'bg-olive-100', 'bg-warning-100'][i]}`} />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-full rounded bg-cream-300" />
            <div className="h-1.5 w-2/3 rounded bg-cream-200" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
