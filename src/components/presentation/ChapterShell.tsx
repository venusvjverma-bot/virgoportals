import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface ChapterShellProps {
  id: string;
  chapterNumber: number;
  kicker: string;
  title: ReactNode;
  children: ReactNode;
  flip?: boolean;
}

export function ChapterShell({ id, chapterNumber, kicker, title, children, flip = false }: ChapterShellProps) {
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion ? {} : {
    initial: { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  };
  return (
    <section id={id} className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-20 sm:px-8">
      <motion.div {...reveal}>
        <p className="font-display text-sm uppercase tracking-[0.25em] text-olive-600">
          {String(chapterNumber).padStart(2, '0')} — {kicker}
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          {title}
        </h2>
      </motion.div>
      <div className={`mt-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        {children}
      </div>
    </section>
  );
}

export function ChapterText({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4 text-base leading-relaxed text-ink-soft sm:text-lg"
    >
      {children}
    </motion.div>
  );
}

export function ChapterVisual({ src, alt }: { src: string; alt: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="overflow-hidden rounded-3xl bg-white p-2 shadow-lift ring-1 ring-cream-200/80">
        <img src={src} alt={alt} loading="lazy" className="w-full rounded-2xl object-cover" />
      </div>
    </motion.div>
  );
}
