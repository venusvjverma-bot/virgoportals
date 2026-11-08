import { Store, CalendarDays, Layers, Utensils } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';

export function OrganiseChapter() {
  return (
    <ChapterShell
      id="chapter-organise"
      chapterNumber={4}
      kicker="Organise Your Restaurant"
      title="Departments, events, sections and categories — your restaurant, organised."
      flip
    >
      <ChapterText>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Store,
              title: 'Departments',
              text: 'Your day-to-day service areas — like the restaurant, the bar or room service — each with their own opening hours and their own QR menu.',
            },
            {
              icon: CalendarDays,
              title: 'Events',
              text: 'Time-limited occasions — a festival, a wedding, a pop-up — with their own menus that run between start and end dates.',
            },
            {
              icon: Layers,
              title: 'Sections',
              text: 'The high-level split of your menu: food on one side, drinks on the other.',
            },
            {
              icon: Utensils,
              title: 'Categories',
              text: 'Within each section, guests browse familiar categories — starters, mains, desserts, beers, wines and more.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-cream-200/80">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
        <p>
          Every dish you create is placed in a section and category, and belongs to the department or event it
          should appear in — so the right menu shows up in the right place at the right time.
        </p>
      </ChapterText>
      <ChapterVisual src="/organisation.webp" alt="A restaurant separating into organised areas and menus" />
    </ChapterShell>
  );
}
