import { useRef } from 'react';
import { motion, useReducedMotion, useInView } from 'motion/react';
import { Building2 } from 'lucide-react';
import { ChapterShell } from '../ChapterShell';
import { Floating, EASE } from '../visuals';

function MiniRestaurant({ hue, name, delay }: { hue: string; name: string; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 50, scale: 0.85 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.7, ease: EASE }}
      className="flex flex-col items-center gap-2"
    >
      <div className="rounded-2xl bg-white p-3 shadow-lift ring-1 ring-cream-200">
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl" style={{ backgroundColor: hue }}>
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-ink">{name}</p>
        <div className="mt-1 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1.5 w-3 rounded-full bg-cream-200" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function EnvironmentChapter() {
  const reduce = useReducedMotion();
  const textRef = useRef<HTMLDivElement>(null);
  const textInView = useInView(textRef, { amount: 0.3 });
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

      <div className="relative flex h-[420px] flex-col items-center justify-center sm:h-[480px]">
        {/* shared platform slab rises */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 60, scaleY: 0.4 }}
          whileInView={{ opacity: 1, y: 0, scaleY: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: EASE }}
          className="absolute bottom-6 h-24 w-full max-w-[272px] rounded-[2rem] bg-white shadow-lift ring-1 ring-cream-200 sm:w-96"
        />
        <p className="absolute bottom-10 text-xs font-medium uppercase tracking-widest text-ink-faint">
          Shared platform infrastructure
        </p>
        {/* three isolated environments */}
        <div className="relative z-10 flex items-end gap-6 sm:gap-10">
          <MiniRestaurant hue="#ACB99E" name="Trattoria" delay={0.4} />
          <MiniRestaurant hue="#657554" name="Bistro Nord" delay={0.6} />
          <MiniRestaurant hue="#DDA53C" name="Café Lumen" delay={0.8} />
        </div>
        {/* isolation outlines draw in */}
        {[16, 50, 84].map((left, i) => (
          <motion.div
            key={left}
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.0 + i * 0.15, duration: 0.5, ease: EASE }}
            style={{ left: `${left}%` }}
            className="absolute top-[26%] h-32 w-24 max-w-[28%] -translate-x-1/2 rounded-3xl border-2 border-dashed border-olive-300"
          />
        ))}
        {/* floating profile card = your settings stay yours */}
        <Floating delay={1.2} className="absolute right-[4%] top-[4%]">
          <div className="w-44 rounded-2xl bg-white p-4 shadow-lift ring-1 ring-cream-200">
            <p className="text-xs font-semibold text-ink">Your environment</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between"><span className="text-[10px] text-ink-muted">Name</span><div className="h-1.5 w-14 rounded bg-olive-200" /></div>
              <div className="flex items-center justify-between"><span className="text-[10px] text-ink-muted">City</span><div className="h-1.5 w-10 rounded bg-cream-200" /></div>
              <div className="flex items-center justify-between"><span className="text-[10px] text-ink-muted">Currency</span><div className="h-1.5 w-8 rounded bg-warning-200" /></div>
            </div>
          </div>
        </Floating>
      </div>
    </ChapterShell>
  );
}
