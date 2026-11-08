import { motion, useReducedMotion } from 'motion/react';
import { Coins, Layers3, EyeOff, Camera, CheckCircle2 } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { Floating, EASE } from '../visuals';

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -4 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.6, ease: EASE }}
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
        <div className="grid gap-3">
          {[
            { icon: Coins, title: 'Measured serving sizes', text: 'Drinks can carry structured sizes like "25 cl", "330 ml" or "12 oz", each with its own price.' },
            { icon: Layers3, title: 'Named serving sizes', text: 'Or names your guests recognise — Small, Large, Single, Double, Family Size, or anything you like.' },
            { icon: EyeOff, title: 'Removable ingredients', text: 'Guests can ask to leave out ingredients you mark as removable — no special requests needed.' },
            { icon: CheckCircle2, title: 'Availability', text: 'Sold out a dish? One switch takes it off the guest menu until it is back.' },
          ].map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={reduce ? false : { opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
              className="flex gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <div>
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
        {/* dish cards fly into a menu grid */}
        <div className="grid grid-cols-2 gap-4">
          <DishMiniCard name="Tagliatelle" price="14.50" tag="25 cl pairing" tone="bg-warning-200" delay={0.2} />
          <DishMiniCard name="Ribeye" price="26.00" tag="Large / Small" tone="bg-olive-200" delay={0.4} />
          <DishMiniCard name="House Red" price="6.50" tag="25 cl · 12 oz" tone="bg-olive-300" delay={0.6} />
          <DishMiniCard name="Lemonade" price="4.00" tag="33 cl" tone="bg-cream-300" delay={0.8} />
        </div>

        {/* variant/add-on chips assemble onto the ribeye card */}
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
