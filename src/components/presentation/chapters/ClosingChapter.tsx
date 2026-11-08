import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, LogIn } from 'lucide-react';
import { Mascot } from '../Mascot';

interface ClosingChapterProps {
  onBecomeHost: () => void;
  onBackToLogin: () => void;
}

export function ClosingChapter({ onBecomeHost, onBackToLogin }: ClosingChapterProps) {
  const reduceMotion = useReducedMotion();
  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-5 py-24 text-center">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-full sm:scale-125"
      >
        <Mascot
          pose="celebrating"
          say="Your table is ready!"
          bubbleSide="left"
          className="max-w-full flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-3"
        />
      </motion.div>
      <motion.h2
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl"
      >
        Your restaurant. Your menu. <span className="text-olive-700">A connected digital experience.</span>
      </motion.h2>
      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg"
      >
        You have seen the whole journey — your environment, your menu, your guests and your orders, all in one
        place. The next table it sets could be your own.
      </motion.p>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
      >
        <button
          type="button"
          onClick={onBecomeHost}
          className="flex items-center gap-2 rounded-full bg-olive-700 px-8 py-4 text-base font-semibold text-white shadow-lift transition hover:bg-olive-800"
        >
          Become a Host
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onBackToLogin}
          className="flex items-center gap-2 rounded-full px-6 py-4 text-base font-medium text-ink-soft ring-1 ring-cream-300 transition hover:bg-white"
        >
          <LogIn className="h-4 w-4" />
          Back to login
        </button>
      </motion.div>
    </section>
  );
}
