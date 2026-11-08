import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useScroll } from 'motion/react';
import { Logo } from '@/components/Logo';
import { ChapterNavigation } from './ChapterNavigation';
import { WelcomeChapter } from './chapters/WelcomeChapter';
import { HostChapter } from './chapters/HostChapter';
import { EnvironmentChapter } from './chapters/EnvironmentChapter';
import { OrganiseChapter } from './chapters/OrganiseChapter';
import { MenuChapter } from './chapters/MenuChapter';
import { ExtractionChapter } from './chapters/ExtractionChapter';
import { CustomerChapter } from './chapters/CustomerChapter';
import { ChatChapter } from './chapters/ChatChapter';
import { OperationsChapter } from './chapters/OperationsChapter';
import { ClosingChapter } from './chapters/ClosingChapter';

export const PRESENTATION_CHAPTERS = [
  { id: 'chapter-welcome', short: 'Welcome' },
  { id: 'chapter-host', short: 'Host account' },
  { id: 'chapter-environment', short: 'Environment' },
  { id: 'chapter-organise', short: 'Organisation' },
  { id: 'chapter-menu', short: 'Menu' },
  { id: 'chapter-extraction', short: 'AI extraction' },
  { id: 'chapter-customer', short: 'Customer' },
  { id: 'chapter-chat', short: 'Visitor chat' },
  { id: 'chapter-operations', short: 'Orders' },
  { id: 'chapter-closing', short: 'Start here' },
];

interface PresentationPageProps {
  onBack: () => void;
  onBecomeHost: () => void;
}

export function PresentationPage({ onBack, onBecomeHost }: PresentationPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { scrollYProgress } = useScroll({ container: containerRef });

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', setProgress);
    return () => unsubscribe();
  }, [scrollYProgress]);

  const chapterProgress = useMemo(
    () => PRESENTATION_CHAPTERS.map((_, i) => (i + 1) / PRESENTATION_CHAPTERS.length),
    []
  );

  useEffect(() => {
    const active = chapterProgress.findIndex((threshold) => progress <= threshold + 0.001);
    setActiveIndex(active === -1 ? PRESENTATION_CHAPTERS.length - 1 : active);
  }, [progress, chapterProgress]);

  function scrollToChapter(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="bg-cream-100">
      <header className="sticky top-0 z-50 flex items-center justify-between bg-cream-100/90 px-5 py-4 backdrop-blur sm:px-8">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-cream-300 transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Logo className="h-8" />
        <span className="hidden text-sm font-medium text-ink-muted sm:block">
          How Virgo Portals works
        </span>
      </header>

      <ChapterNavigation
        chapters={PRESENTATION_CHAPTERS}
        activeIndex={activeIndex}
        progress={progress}
        onSelect={scrollToChapter}
      />

      <main ref={containerRef} className="relative">
        <WelcomeChapter />
        <HostChapter />
        <EnvironmentChapter />
        <OrganiseChapter />
        <MenuChapter />
        <ExtractionChapter />
        <CustomerChapter />
        <ChatChapter />
        <OperationsChapter />
        <ClosingChapter onBecomeHost={onBecomeHost} onBackToLogin={onBack} />
      </main>
    </div>
  );
}
