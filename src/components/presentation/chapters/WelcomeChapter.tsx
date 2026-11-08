import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChapterShell } from '../ChapterShell';
import { RestaurantShowcase } from '../RestaurantShowcase';
import { EASE } from '../visuals';

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
    tab: '01 — Set up',
    title: 'Set up your restaurant',
    description:
      'Create your Host account and configure your restaurant environment, including restaurant details, currency, welcome message and service type.',
    image: '/welcome-setup.webp',
    alt: 'Laptop showing the Virgo Portals Host Dashboard restaurant settings on a restaurant host stand',
  },
  {
    id: 'menu',
    tab: '02 — Build your menu',
    title: 'Build your digital menu',
    description:
      'Add dishes, images, prices, serving sizes, variants and add-ons. You can also extract dishes from a PDF menu using AI assistance, then review and correct the results before publishing.',
    image: '/welcome-menu.webp',
    alt: 'Plated dishes beside a tablet displaying the Virgo Portals digital menu and a PDF menu being reviewed',
  },
  {
    id: 'guests',
    tab: '03 — Welcome guests',
    title: 'Welcome your guests',
    description:
      "Guests scan your restaurant's QR code, select their language, explore your digital menu and use the visitor chat to discover suitable dishes.",
    image: '/welcome-guests.webp',
    alt: 'Restaurant table with a QR code stand and a smartphone showing the Virgo Portals visitor menu',
  },
  {
    id: 'orders',
    tab: '04 — Manage orders',
    title: 'Receive and manage orders',
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
      <div className="lg:col-span-2">
        <p className="max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
          Manage your restaurant, publish your digital menu, welcome guests and receive orders — all through
          Virgo Portals.
        </p>
      </div>

      {/* Interactive 3D restaurant — the visual centrepiece */}
      <div className="lg:col-span-2">
        <RestaurantShowcase />
      </div>

      {/* Four interactive workflow tabs */}
      <div className="mt-6 w-full lg:col-span-2">
        <h3 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          How your restaurant works with Virgo Portals
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
          Four connected steps take your restaurant from setup to incoming orders.
        </p>

        {/* Tab row — horizontally scrollable on phones */}
        <div className="mt-6 -mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div role="tablist" aria-label="Workflow steps" className="flex min-w-max gap-2 sm:min-w-0 sm:grid sm:grid-cols-4">
            {TABS.map((t, i) => {
              const selected = i === active;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(i)}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ring-1 transition-all duration-300 ${
                    selected
                      ? 'bg-olive-700 text-white shadow-lift ring-olive-700'
                      : 'bg-white text-ink-soft ring-cream-200 hover:bg-olive-50 hover:text-ink'
                  }`}
                >
                  <span className={`block text-[11px] font-medium uppercase tracking-wider ${selected ? 'text-olive-100' : 'text-olive-600'}`}>
                    {t.tab}
                  </span>
                  <span className="mt-0.5 block">{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active tab panel */}
        <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-cream-200/80">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab.id}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="grid gap-0 md:grid-cols-2"
            >
              <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
                <h4 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">{tab.title}</h4>
                <p className="text-sm leading-relaxed text-ink-soft sm:text-base">{tab.description}</p>
              </div>
              <div className="relative min-h-[220px] md:min-h-[300px]">
                <img src={tab.image} alt={tab.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </ChapterShell>
  );
}
