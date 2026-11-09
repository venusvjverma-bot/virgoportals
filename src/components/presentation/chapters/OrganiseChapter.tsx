import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Store } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { Mascot } from '../Mascot';
import { EASE } from '../visuals';

const FOOD_CATS = ['Starters', 'Mains', 'Desserts'];
const DRINK_CATS = ['Beers', 'Wines', 'Coffee'];

function CategoryChip({ label, delay, tone }: { label: string; delay: number; tone: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={reduce ? false : { opacity: 0, scale: 0.6, y: 14 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-soft ${tone}`}
    >
      {label}
    </motion.span>
  );
}

const ORGANISATION_CARDS = [
  {
    title: 'Departments',
    image: '/file_00000000b62c820aa015a8a4b5db79c0.png',
    alt: 'Warm miniature restaurant bar with guests and a bartender',
    text: 'Have a restaurant, a bar or room service? You can set up each as its own department, with its own opening hours and QR menu.',
  },
  {
    title: 'Events',
    image: '/file_00000000d24881f4b7a95ed0bd0e464f.png',
    alt: 'Miniature event dining table with flowers and elegant tableware',
    text: 'Planning a wedding, hosting a festival or running a pop-up? Create an event with its own menu and set the dates it will be available.',
  },
] as const;

export function OrganiseChapter() {
  const reduce = useReducedMotion();
  const cardsRef = useRef<HTMLDivElement>(null);
  const cardsInView = useInView(cardsRef, { amount: 0.25 });
  const closingRef = useRef<HTMLParagraphElement>(null);
  const closingInView = useInView(closingRef, { amount: 0.5 });
  return (
    <ChapterShell
      id="chapter-organise"
      chapterNumber={4}
      kicker="Organise Your Restaurant"
      title="Departments, events, sections and categories — everything in its place."
      flip
    >
      <ChapterText>
        <div ref={cardsRef} className="grid gap-4 sm:grid-cols-2">
          {ORGANISATION_CARDS.map(({ title, image, alt, text }, i) => (
            <motion.div
              key={title}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={reduce || cardsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ delay: reduce ? 0 : i * 0.15, duration: 0.6, ease: EASE }}
              className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-cream-200/80"
            >
              <img
                src={image}
                alt={alt}
                loading="lazy"
                className="aspect-video w-full object-cover object-center"
              />
              <div className="p-5">
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.p
          ref={closingRef}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={reduce || closingInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: reduce ? 0 : 0.35, duration: 0.6, ease: EASE }}
        >
          Now let's look at your menu. You can keep food and drinks in separate sections, then organise dishes into
          categories such as starters, main courses and desserts. When you add a dish, simply choose where it belongs
          and which department or event should offer it.
        </motion.p>
      </ChapterText>

      <div className="relative flex h-[440px] flex-col items-center justify-center sm:h-[500px]">
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
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.6, ease: EASE }}
            className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-olive-200"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-olive-700">Departments</p>
            <div className="mt-2 space-y-1.5">
              {['Restaurant', 'Bar', 'Room service'].map((d, i) => (
                <motion.div
                  key={d}
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: reduce ? 0 : 0.9 + i * 0.12, duration: 0.4, ease: EASE }}
                  className="rounded-lg bg-olive-50 px-2.5 py-1.5 text-xs font-medium text-olive-800"
                >
                  {d}
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.6, ease: EASE }}
            className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-warning-200"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-warning-600">Events</p>
            <div className="mt-2 space-y-1.5">
              {['Wine festival', 'Summer pop-up'].map((e, i) => (
                <motion.div
                  key={e}
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: reduce ? 0 : 1.0 + i * 0.12, duration: 0.4, ease: EASE }}
                  className="rounded-lg bg-warning-50 px-2.5 py-1.5 text-xs font-medium text-warning-700"
                >
                  {e}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

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
