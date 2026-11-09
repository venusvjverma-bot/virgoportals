import { useRef } from 'react';
import { motion, useReducedMotion, useInView } from 'motion/react';
import { Mascot } from 'wobnimo/react';
import { latte } from 'wobnimo/characters/latte';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { EASE } from '../visuals';

const STEPS = [
  {
    image: '/host-step-signup.webp',
    alt: "Miniature diorama of a restaurant owner's desk with an open laptop showing an account sign-up form, notebook and pen",
    title: 'Create your Host account',
    text: "Let's get you started. Sign up with your email address and choose a password to create your Host account.",
  },
  {
    image: '/host-step-email.webp',
    alt: 'Miniature desk diorama with an envelope, email notification card and a confirmation checkmark',
    title: 'Confirm your email',
    text: 'Check your inbox for a verification email. Confirm your address so we can make sure your account belongs to you.',
  },
  {
    image: '/host-step-restaurant.webp',
    alt: 'Miniature restaurant interior diorama with tables, chairs, counter and warm pendant lighting',
    title: 'Your restaurant is ready',
    text: 'Your restaurant environment is created during registration. Your own space is ready for you to start setting things up.',
  },
  {
    image: '/host-step-dashboard.webp',
    alt: 'Miniature workstation diorama with a laptop showing the Host Dashboard, order slips and a menu booklet',
    title: 'Step into your dashboard',
    text: "You're in! Your Host Dashboard is where you can build your menu, organise your restaurant and manage incoming orders.",
  },
];

export function HostChapter() {
  const reduce = useReducedMotion();
  return (
    <ChapterShell
      id="chapter-host"
      chapterNumber={2}
      kicker="Become a Host"
      title="Getting started is simple."
      flip
    >
      <ChapterText>
        <p className="max-w-xl text-base leading-[1.7] text-ink-soft sm:text-lg">
          A few simple steps and your restaurant will be ready to get started with Virgo Portals.
        </p>

        <ol className="mt-6 space-y-6">
          {STEPS.map(({ image, alt, title, text }, index) => (
            <motion.li
              key={title}
              initial={reduce ? false : { opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ margin: '-40px' }}
              transition={{ delay: index * 0.12, duration: 0.55, ease: EASE }}
              className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
            >
              <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-cream-50 ring-1 ring-cream-200/60 sm:h-24 sm:w-32">
                <img
                  src={image}
                  alt={alt}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  <span className="mr-2 text-olive-600">{index + 1}.</span>
                  {title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </ChapterText>

      <div className="relative flex h-[420px] items-center justify-center sm:h-[480px]">
        <div className="grid w-full max-w-md grid-cols-2 gap-4">
          {STEPS.map(({ image, alt, title }, index) => (
            <motion.div
              key={image}
              initial={reduce ? false : { opacity: 0, y: 40, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ margin: '-40px' }}
              transition={{ delay: 0.3 + index * 0.15, duration: 0.6, ease: EASE }}
              className="overflow-hidden rounded-3xl bg-white p-2 shadow-lift ring-1 ring-cream-200/80"
            >
              <img
                src={image}
                alt={alt}
                loading="lazy"
                className="aspect-square w-full rounded-2xl object-cover"
              />
              <p className="px-2 pb-1.5 pt-2 text-center text-xs font-semibold text-ink-muted">
                {index + 1}. {title}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <ClosingMoment />
    </ChapterShell>
  );
}

/** Closing moment: free-standing message with the celebratory Latte mascot
 * floating beside it, revealed together on scroll and hidden when it leaves. */
function ClosingMoment() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  return (
    <div ref={ref} className="relative mx-auto mt-16 max-w-2xl px-4 pb-8">
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="text-center font-display text-lg font-medium leading-[1.7] text-ink sm:text-xl"
      >
        And that's it! Your Host account and restaurant dashboard are ready. You're all set to start
        building your menu and setting up your restaurant.
      </motion.p>
      <motion.div
        aria-hidden
        initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0, rotate: -12, y: 24 }}
        animate={
          inView
            ? { scale: 1, opacity: 1, rotate: 0, y: 0 }
            : { scale: 0.4, opacity: 0, rotate: -12, y: 24 }
        }
        transition={{ duration: 0.7, delay: reduce ? 0 : 0.2, ease: EASE }}
        className="pointer-events-none absolute z-20 h-32 w-32 sm:h-40 sm:w-40 -left-2 -top-24 sm:left-auto sm:-right-20 sm:top-1/2 sm:-translate-y-1/2"
      >
        <Mascot
          character={latte}
          state={inView ? 'celebrating' : 'listening'}
          style={{ width: '100%', height: '100%' }}
        />
      </motion.div>
    </div>
  );
}
