import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChapterShell } from '../ChapterShell';
import { EASE, Reveal, TextReveal } from '../visuals';

/** Shared phone mock used by other chapters (Chat, Customer). */
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

/** Shared digital-menu lines used by other chapters (Customer). */
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

const TABS = [
  {
    id: 'setup',
    tab: 'Restaurant setup',
    title: 'Configure your restaurant',
    description:
      'Create your Host account and configure your restaurant environment, including restaurant details, currency, welcome message and service type.',
    image: '/welcome-setup.webp',
    alt: 'Laptop showing the Virgo Portals Host Dashboard restaurant settings on a restaurant host stand',
  },
  {
    id: 'menu',
    tab: 'Menu management',
    title: 'Create and organise your menu',
    description:
      'Add dishes, images, prices, serving sizes, variants and add-ons. You can also extract dishes from a PDF menu using AI assistance, then review and correct the results before publishing.',
    image: '/welcome-menu.webp',
    alt: 'Plated dishes beside a tablet displaying the Virgo Portals digital menu and a PDF menu being reviewed',
  },
  {
    id: 'guests',
    tab: 'Customer experience',
    title: "Your guests' ordering experience",
    description:
      "Guests scan your restaurant's QR code, select their language, explore your digital menu and use the visitor chat to discover suitable dishes.",
    image: '/welcome-guests.webp',
    alt: 'Restaurant table with a QR code stand and a smartphone showing the Virgo Portals visitor menu',
  },
  {
    id: 'orders',
    tab: 'Order management',
    title: 'Manage incoming orders',
    description:
      'Orders arrive in your Host Dashboard, where your team can manage order statuses and prepare orders for collection.',
    image: '/welcome-orders.webp',
    alt: 'Restaurant counter with a tablet showing the Virgo Portals Orders interface and a receipt printer',
  },
] as const;

export function WelcomeChapter() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <ChapterShell
      id="chapter-welcome"
      chapterNumber={1}
      kicker="Welcome"
      title={
        <>
          Your restaurant. <span className="text-olive-700">One connected digital platform.</span>
        </>
      }
    >
      <div className="w-full">
        <Reveal>
          <p className="max-w-2xl border-l-2 border-olive-300 pl-4 text-base leading-[1.7] text-ink-soft sm:pl-5 sm:text-lg">
            Manage your restaurant, publish your digital menu, welcome guests and receive orders — all through
            Virgo Portals.
          </p>
        </Reveal>

        {/* Four interactive workflow tabs — the journey from setup to orders */}
        <div className="mt-12">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive-600">The workflow</p>
            <h3 className="mt-2 max-w-2xl font-display text-2xl font-semibold leading-[1.2] tracking-tight text-ink sm:text-3xl">
              How your restaurant works with Virgo Portals
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-[1.7] text-ink-soft sm:text-base">
              Four connected steps take your restaurant from setup to incoming orders.
            </p>
          </Reveal>

          {/* Tab grid — two columns on phones, four across from tablets up */}
          <div
            role="tablist"
            aria-label="Workflow steps"
            className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
          >
            {TABS.map((t, i) => {
              const selected = i === active;
              return (
                <motion.button
                  key={t.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(i)}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ margin: '-40px' }}
                  transition={{ delay: i * 0.07, duration: 0.5, ease: EASE }}
                  className={`group relative w-full overflow-hidden rounded-2xl px-3.5 py-3.5 text-left text-sm font-semibold leading-snug ring-1 transition-all duration-300 sm:px-4 ${
                    selected
                      ? 'bg-olive-700 text-white shadow-lift ring-olive-700'
                      : 'bg-white text-ink-soft ring-cream-200 hover:bg-olive-50 hover:text-ink hover:ring-olive-200'
                  }`}
                >
                  <span
                    className={`block text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      selected ? 'text-olive-100' : 'text-olive-600'
                    }`}
                  >
                    <TextReveal text={t.tab} stagger={0.03} />
                  </span>
                  <span className="mt-1 block">
                    <TextReveal text={t.title} delay={0.12} stagger={0.05} />
                  </span>
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 h-0.5 bg-olive-400 transition-transform duration-300 ${
                      selected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
                    }`}
                  />
                </motion.button>
              );
            })}
          </div>

          {/* Active tab panel — text beside its image on wide screens, stacked on phones */}
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-cream-200/80">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="grid gap-0 md:grid-cols-5"
              >
                <div className="flex flex-col justify-center gap-4 p-6 sm:p-10 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-olive-600">
                    <TextReveal text={`Step ${String(active + 1).padStart(2, '0')} of 04`} stagger={0.03} />
                  </p>
                  <h4 className="font-display text-xl font-semibold leading-[1.25] tracking-tight text-ink sm:text-2xl">
                    <TextReveal key={`title-${tab.id}`} text={tab.title} delay={0.1} stagger={0.05} />
                  </h4>
                  <p className="text-sm leading-[1.7] text-ink-soft sm:text-base">
                    <TextReveal key={`desc-${tab.id}`} text={tab.description} delay={0.25} stagger={0.025} />
                  </p>
                </div>
                <div className="relative min-h-[220px] md:col-span-3 md:min-h-[320px]">
                  <img
                    src={tab.image}
                    alt={tab.alt}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-white via-transparent to-transparent md:block" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ChapterShell>
  );
}
