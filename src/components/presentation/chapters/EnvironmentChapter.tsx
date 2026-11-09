import { useRef } from 'react';
import { motion, useReducedMotion, useInView } from 'motion/react';
import { ChapterShell } from '../ChapterShell';
import { Floating, EASE } from '../visuals';

function MiniRestaurant({ name, image, delay }: { name: string; image: string; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 50, scale: 0.85 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.7, ease: EASE }}
      className="flex flex-col items-center gap-2"
    >
      <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-lift ring-1 ring-cream-200">
        <img
          src={image}
          alt={`${name} dish`}
          loading="lazy"
          className="h-16 w-16 rounded-xl object-cover sm:h-20 sm:w-20"
        />
        <p className="mt-1.5 pb-0.5 text-center text-xs font-semibold text-ink">{name}</p>
      </div>
    </motion.div>
  );
}

export function EnvironmentChapter() {
  const reduce = useReducedMotion();
  const textRef = useRef<HTMLDivElement>(null);
  const textInView = useInView(textRef, { amount: 0.3 });
  const slabRef = useRef<HTMLDivElement>(null);
  const slabInView = useInView(slabRef, { amount: 0.3 });
  return (
    <ChapterShell
      id="chapter-environment"
      chapterNumber={3}
      kicker="Your Restaurant Environment"
      title="Your restaurant. Your own space."
    >
      <motion.div
        ref={textRef}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={textInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="space-y-4 text-base leading-relaxed text-ink-soft sm:text-lg"
      >
        <p>Everything you manage in Virgo Portals belongs to your restaurant.</p>
        <p>
          When you join Virgo Portals, we create a dedicated space for your restaurant. You can add your restaurant
          name, choose your city and currency, set a welcome message and decide how table or room service should work.
        </p>
        <p>
          Your restaurant has its own menu, orders, departments and settings. Everything stays separate from other
          restaurants using Virgo Portals. You only see and manage your own restaurant's information.
        </p>
        <p className="text-sm text-ink-muted">
          One restaurant, one dedicated Host account. Your restaurant's information stays organised in one place,
          ready for you to manage.
        </p>
      </motion.div>

      <div ref={slabRef} className="relative flex flex-col items-center">
        {/* illustration: environment card -> branching dashed connectors -> three restaurant cards */}
        <Floating delay={1.2} className="relative z-10">
          <div className="w-44 rounded-2xl bg-white p-4 shadow-lift ring-1 ring-cream-200">
            <p className="text-xs font-semibold text-ink">Your environment</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between"><span className="text-[10px] text-ink-muted">Name</span><div className="h-1.5 w-14 rounded bg-olive-200" /></div>
              <div className="flex items-center justify-between"><span className="text-[10px] text-ink-muted">City</span><div className="h-1.5 w-10 rounded bg-cream-200" /></div>
              <div className="flex items-center justify-between"><span className="text-[10px] text-ink-muted">Currency</span><div className="h-1.5 w-8 rounded bg-warning-200" /></div>
            </div>
          </div>
        </Floating>
        {/* branching dashed connectors: one stem from the card, three paths to the restaurants */}
        <svg
          viewBox="0 0 100 44"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="-mt-px h-11 w-full max-w-lg sm:h-14"
        >
          {[
            'M50 0 V14 C50 26 22 20 16.5 44',
            'M50 0 V44',
            'M50 0 V14 C50 26 78 20 83.5 44',
          ].map((d, i) => (
            <motion.path
              key={d}
              d={d}
              stroke="#a3b899"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
              initial={reduce ? { strokeDashoffset: 0 } : { strokeDashoffset: 100 }}
              whileInView={{ strokeDashoffset: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 1.1, delay: reduce ? 0 : 0.9 + i * 0.2, ease: EASE }}
            />
          ))}
        </svg>
        {/* three isolated environments */}
        <div className="relative z-10 -mt-1 flex items-start justify-center gap-6 px-4 sm:gap-10">
          <MiniRestaurant image="/trattoria-pasta.webp" name="Trattoria" delay={0.4} />
          <MiniRestaurant image="/bistro-nord-dish.webp" name="Bistro Nord" delay={0.6} />
          <MiniRestaurant image="/cafe-lumen-coffee.webp" name="Café Lumen" delay={0.8} />
        </div>
        {/* slab copy: below the illustration, in normal flow */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={slabInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6, delay: reduce ? 0 : 1.5, ease: EASE }}
          className="mt-10 w-full max-w-md px-5 text-center"
        >
          <p className="font-display text-base font-semibold text-ink sm:text-lg">
            Different restaurants. Their own identity.
          </p>
          <p className="mx-auto mt-2 text-sm leading-relaxed text-ink-muted">
            Your restaurant has its own name, settings and dedicated space. Set your location, currency, welcome
            message and service preferences. Your information stays separate from other restaurants, and you manage
            everything through your own portal.
          </p>
        </motion.div>
      </div>
    </ChapterShell>
  );
}
