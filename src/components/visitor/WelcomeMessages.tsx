import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const LANGUAGES = [
  'English',
  'Svenska',
  '中文',
  'हिन्दी',
  'Français',
  'Español',
  'العربية',
  'Deutsch',
];

export function WelcomeMessages() {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-5">
      {/* Message 1 — animated waving hand only */}
      <div className="flex animate-fade-in justify-start">
        <div className="flex items-center justify-center rounded-2xl bg-white px-5 py-4 shadow-soft ring-1 ring-cream-200">
          <span
            className="animate-wave inline-block text-4xl sm:text-5xl"
            style={{ transformOrigin: '70% 70%' }}
            role="img"
            aria-label="waving hand"
          >
            👋
          </span>
        </div>
      </div>

      {/* Message 2 — assistant introduction */}
      {showIntro ? (
        <div className="flex animate-fade-in justify-start">
          <div className="max-w-[92%] sm:max-w-[80%]">
            <div className="rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-soft ring-1 ring-cream-200">
              <p>
                Hi! I'm your menu assistant 😊 I can help you explore our menu, choose dishes,
                understand ingredients and allergens, and find something you'll love. You can chat
                with me in your preferred language!
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {LANGUAGES.map((lang) => (
                  <span
                    key={lang}
                    className={cn(
                      'inline-flex items-center rounded-full bg-olive-50 px-2.5 py-1',
                      'text-xs font-medium text-olive-700 ring-1 ring-inset ring-olive-100'
                    )}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
