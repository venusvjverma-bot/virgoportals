import { motion, useReducedMotion } from 'motion/react';
import { Store, CalendarDays } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { Mascot } from '../Mascot';
import { EASE } from '../visuals';

const FOOD_CATS = ['Starters', 'Mains', 'Desserts'];
const DRINK_CATS = ['Beers', 'Wines', 'Coffee'];

function CategoryChip({ label, delay, tone }: { label: string; delay: number; tone: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6, y: 14 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-soft ${tone}`}
    >
      {label}
    </motion.span>
  );
}

export function OrganiseChapter() {
  const reduce = useReducedMotion();
  return (
    <ChapterShell
      id="chapter-organise"
      chapterNumber={4}
      kicker="Organise Your Restaurant"
      title="Departments, events, sections and categories — your restaurant, organised."
      flip
    >
      <ChapterText>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Store,
              title: 'Departments',
              text: 'Your day-to-day service areas — like the restaurant, the bar or room service — each with their own opening hours and their own QR menu.',
            },
            {
              icon: CalendarDays,
              title: 'Events',
              text: 'Time-limited occasions — a festival, a wedding, a pop-up — with their own menus that run between start and end dates.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
        <p>
          Sections split your menu into <strong className="font-semibold text-ink">food</strong> and{' '}
          <strong className="font-semibold text-ink">drinks</strong>, and categories sit inside them. Every
          dish you create is placed in a section and category, and belongs to the department or event it should
          appear in.
        </p>
      </ChapterText>

      <div className="relative flex h-[440px] flex-col items-center justify-center sm:h-[500px]">
        {/* central restaurant */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease: EASE }}
          className="z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-olive-700 text-cream-50 shadow-lift"
        >
          <Store className="h-8 w-8" />
        </motion.div>
        <p className="z-10 mt-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-soft ring-1 ring-cream-200">
          Your restaurant
        </p>

        {/* department vs event branches */}
        <svg viewBox="0 0 300 90" className="h-20 w-full max-w-md">
          <motion.path
            d="M150 4 C 90 20, 60 45, 45 86"
            stroke="#657554" strokeWidth="2" fill="none" strokeDasharray="4 4"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8, ease: EASE }}
          />
          <motion.path
            d="M150 4 C 210 20, 240 45, 255 86"
            stroke="#DDA53C" strokeWidth="2" fill="none" strokeDasharray="4 4"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.55, duration: 0.8, ease: EASE }}
          />
        </svg>

        <div className="grid w-full max-w-md grid-cols-2 gap-4">
          {/* departments card */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.6, ease: EASE }}
            className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-olive-200"
          >
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-olive-700">
              <Store className="h-3.5 w-3.5" /> Departments
            </p>
            <div className="mt-2 space-y-1.5">
              {['Restaurant', 'Bar', 'Room service'].map((d, i) => (
                <motion.div
                  key={d}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.9 + i * 0.12, duration: 0.4, ease: EASE }}
                  className="rounded-lg bg-olive-50 px-2.5 py-1.5 text-xs font-medium text-olive-800"
                >
                  {d}
                </motion.div>
              ))}
            </div>
          </motion.div>
          {/* events card */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.6, ease: EASE }}
            className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-warning-200"
          >
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-warning-600">
              <CalendarDays className="h-3.5 w-3.5" /> Events
            </p>
            <div className="mt-2 space-y-1.5">
              {['Wine festival', 'Summer pop-up'].map((e, i) => (
                <motion.div
                  key={e}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.0 + i * 0.12, duration: 0.4, ease: EASE }}
                  className="rounded-lg bg-warning-50 px-2.5 py-1.5 text-xs font-medium text-warning-700"
                >
                  {e}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* sections + categories assemble at the bottom */}
        <div className="mt-5 flex w-full max-w-md flex-col items-center gap-2">
          <div className="flex gap-2">
            <CategoryChip label="Food" delay={1.2} tone="bg-olive-600 text-white" />
            <CategoryChip label="Drinks" delay={1.3} tone="bg-ink text-cream-50" />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {FOOD_CATS.map((c, i) => (
              <CategoryChip key={c} label={c} delay={1.4 + i * 0.1} tone="bg-olive-100 text-olive-800" />
            ))}
            {DRINK_CATS.map((c, i) => (
              <CategoryChip key={c} label={c} delay={1.7 + i * 0.1} tone="bg-cream-200 text-ink-soft" />
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 right-0 hidden scale-75 sm:block">
          <Mascot pose="pointing" say="Everything in its right place." />
        </div>
      </div>
    </ChapterShell>
  );
}
