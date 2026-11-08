import { useEffect } from 'react';

interface ChapterNavigationProps {
  chapters: { id: string; short: string }[];
  activeIndex: number;
  progress: number;
  onSelect: (id: string) => void;
}

export function ChapterNavigation({ chapters, activeIndex, progress, onSelect }: ChapterNavigationProps) {
  useEffect(() => {
    // No-op: progress drives purely visual state.
  }, [progress]);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-1 bg-cream-200">
        <div
          className="h-full bg-olive-600 transition-[width] duration-150 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <nav
        aria-label="Chapters"
        className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex"
      >
        {chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => onSelect(chapter.id)}
            className="group flex items-center gap-2"
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <span
              className={`text-xs font-medium transition-opacity ${
                index === activeIndex ? 'text-olive-700 opacity-100' : 'text-ink-muted opacity-0 group-hover:opacity-100'
              }`}
            >
              {chapter.short}
            </span>
            <span
              className={`h-2.5 w-2.5 rounded-full ring-1 transition ${
                index === activeIndex
                  ? 'scale-125 bg-olive-600 ring-olive-600'
                  : 'bg-white ring-cream-300 group-hover:bg-cream-200'
              }`}
            />
          </button>
        ))}
      </nav>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center md:hidden">
        <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 shadow-soft ring-1 ring-cream-200">
          {chapters.map((chapter, index) => (
            <span
              key={chapter.id}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? 'w-5 bg-olive-600' : 'w-1.5 bg-cream-300'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
