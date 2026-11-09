import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Camera } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { Floating, EASE } from '../visuals';

const MENU_FEATURES = [
  {
    title: 'Make every dish look tempting',
    image: '/file_000000005e5c8243bc2bb69f442c7340.png',
    alt: 'Miniature restaurant workers painting a giant dish on a restaurant wall',
    text: 'Create an AI-generated image for each dish to bring your menu to life. Add the dish name, a description and its price, so guests can see what they\'re ordering.',
  },
  {
    title: 'Serve dishes the way you want',
    image: '/file_00000000d6fc81f499c2a592cfd893a5.png',
    alt: 'Three whisky glasses in different sizes with serving quantity labels',
    text: 'Offer different serving sizes or options to suit your menu. Give each one its own price, whether you use measurements like cl and ml or names like small, medium and large.',
  },
  {
    title: 'Give guests more ways to enjoy their dishes',
    image: '/file_00000000d698820abf15819692be8196.png',
    alt: 'Miniature chefs adding toppings to a giant burger beside an add-ons board',
    text: 'Add extras such as cheese, bacon, toppings or sauces to your dishes. Set up the add-on choices and their prices, so guests can customise their orders.',
  },
  {
    title: "Show what's available in your kitchen",
    image: '/file_0000000049d881f4992c2ec9708d64e6.png',
    alt: 'Miniature restaurant workers managing a menu board with availability switches',
    text: 'Not serving a particular dish today? Hide it from your menu with one simple switch. When it\'s back on the menu, switch it on again.',
  },
] as const;

function DishMiniCard({
  name,
  price,
  tag,
  tone,
  delay,
}: {
  name: string;
  price: string;
  tag: string;
  tone: string;
  delay: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 40, rotate: -4 }}
      animate={reduce || inView ? { opacity: 1, y: 0, rotate: 0 } : { opacity: 0, y: 40, rotate: -4 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.6, ease: EASE }}
      className="w-36 rounded-2xl bg-white p-3 shadow-lift ring-1 ring-cream-200"
    >
      <div className={`h-14 rounded-xl ${tone}`} />
      <p className="mt-2 text-xs font-semibold text-ink">{name}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="rounded-full bg-olive-50 px-2 py-0.5 text-[10px] font-medium text-olive-700">{tag}</span>
        <span className="text-xs font-bold text-ink">{price}</span>
      </div>
    </motion.div>
  );
}

export function MenuChapter() {
  const reduce = useReducedMotion();
  const featuresRef = useRef<HTMLDivElement>(null);
  const featuresInView = useInView(featuresRef, { amount: 0.2 });

  return (
    <ChapterShell
      id="chapter-menu"
      chapterNumber={5}
      kicker="Build Your Digital Menu"
      title="Dishes that look as good as they taste."
    >
      <ChapterText>
        <p>
          Build your menu dish by dish: names, descriptions, prices and beautiful images — generated for you
          from the dish itself if you don't have photography.
        </p>
        <div ref={featuresRef} className="grid gap-3">
          {MENU_FEATURES.map(({ title, image, alt, text }, i) => (
            <motion.div
              key={title}
              initial={reduce ? false : { opacity: 0, x: -20 }}
              animate={reduce || featuresInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ delay: reduce ? 0 : i * 0.1, duration: 0.5, ease: EASE }}
              className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-cream-200/80"
            >
              <img
                src={image}
                alt={alt}
                loading="lazy"
                className="aspect-[3/2] w-full object-cover object-center"
              />
              <div className="p-4">
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Camera className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
          Every dish card is edited in one place, and your guest menu updates instantly.
        </p>
      </ChapterText>

      <div className="relative flex h-[460px] items-center justify-center sm:h-[520px]">
        <div className="grid grid-cols-2 gap-4">
          <DishMiniCard name="Tagliatelle" price="14.50" tag="25 cl pairing" tone="bg-warning-200" delay={0.2} />
          <DishMiniCard name="Ribeye" price="26.00" tag="Large / Small" tone="bg-olive-200" delay={0.4} />
          <DishMiniCard name="House Red" price="6.50" tag="25 cl · 12 oz" tone="bg-olive-300" delay={0.6} />
          <DishMiniCard name="Lemonade" price="4.00" tag="33 cl" tone="bg-cream-300" delay={0.8} />
        </div>

        <Floating delay={1.0} className="absolute left-[4%] top-[14%]">
          <div className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-lift ring-1 ring-cream-200">
            Medium rare
          </div>
        </Floating>
        <Floating delay={1.2} className="absolute left-[2%] bottom-[24%]">
          <div className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-lift ring-1 ring-cream-200">
            + Side of fries
          </div>
        </Floating>
        <Floating delay={1.35} className="absolute right-[2%] top-[30%]">
          <div className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-lift ring-1 ring-cream-200">
            No onions
          </div>
        </Floating>
      </div>
    </ChapterShell>
  );
}
