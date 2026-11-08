import { Camera, Coins, Layers3, EyeOff, ImageIcon, CheckCircle2 } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';

export function MenuChapter() {
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
            { icon: ImageIcon, title: 'Variants and add-ons', text: 'Choices like cooking degree, sides, or extras with an additional price are all part of a dish.' },
            { icon: EyeOff, title: 'Removable ingredients', text: 'Guests can ask to leave out ingredients you mark as removable — no special requests needed.' },
            { icon: CheckCircle2, title: 'Availability', text: 'Sold out a dish? One switch takes it off the guest menu until it is back.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Camera className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
          Every dish card is edited in one place, and your guest menu updates instantly.
        </p>
      </ChapterText>
      <ChapterVisual src="/menu-building.webp" alt="Floating dish cards assembling into a digital menu" />
    </ChapterShell>
  );
}
