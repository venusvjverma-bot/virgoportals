import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';

export function EnvironmentChapter() {
  return (
    <ChapterShell
      id="chapter-environment"
      chapterNumber={3}
      kicker="Your Restaurant Environment"
      title="Every restaurant gets its own sealed environment."
    >
      <ChapterText>
        <p>
          When you become a Host, Virgo Portals creates a restaurant environment that belongs entirely to you —
          with your restaurant's name, city and currency, your welcome message, and how you charge for table or
          room service.
        </p>
        <p>
          Your environment is yours alone. Menus, orders and settings from other restaurants on the platform
          never mix with yours — the platform is built so every Host only ever sees their own restaurant.
        </p>
        <p className="text-sm text-ink-muted">
          One Host, one restaurant: the platform enforces that link, so your digital presence is always exactly
          your business.
        </p>
      </ChapterText>
      <ChapterVisual src="/restaurant-environment.webp" alt="Separate restaurant environments connected through shared infrastructure" />
    </ChapterShell>
  );
}
