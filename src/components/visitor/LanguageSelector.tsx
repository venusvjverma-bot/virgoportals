import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';

const LANGUAGES: { native: string; english: string; search: string; flag: string }[] = [
  { native: 'English', english: 'English', search: 'english', flag: '🇬🇧' },
  { native: 'Svenska', english: 'Swedish', search: 'swedish svenska', flag: '🇸🇪' },
  { native: '中文', english: 'Chinese', search: 'chinese 中文', flag: '🇨🇳' },
  { native: 'हिन्दी', english: 'Hindi', search: 'hindi हिन्दी', flag: '🇮🇳' },
  { native: 'العربية', english: 'Arabic', search: 'arabic العربية', flag: '🇸🇦' },
  { native: 'Español', english: 'Spanish', search: 'spanish español', flag: '🇪🇸' },
  { native: 'Français', english: 'French', search: 'french français', flag: '🇫🇷' },
  { native: 'Deutsch', english: 'German', search: 'german deutsch', flag: '🇩🇪' },
  { native: 'Italiano', english: 'Italian', search: 'italian italiano', flag: '🇮🇹' },
  { native: 'Português', english: 'Portuguese', search: 'portuguese português', flag: '🇵🇹' },
  { native: 'Polski', english: 'Polish', search: 'polish polski', flag: '🇵🇱' },
  { native: 'Suomi', english: 'Finnish', search: 'finnish suomi', flag: '🇫🇮' },
  { native: 'Türkçe', english: 'Turkish', search: 'turkish türkçe', flag: '🇹🇷' },
  { native: '日本語', english: 'Japanese', search: 'japanese 日本語', flag: '🇯🇵' },
  { native: 'Русский', english: 'Russian', search: 'russian русский', flag: '🇷🇺' },
];

interface LanguageSelectorProps {
  onSelect: (language: string) => void;
}

export function LanguageSelector({ onSelect }: LanguageSelectorProps) {
  const [query, setQuery] = useState('');

  const filtered = LANGUAGES.filter((lang) =>
    lang.search.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your language"
    >
      <div
        className="flex max-h-[78dvh] w-full max-w-md flex-col overflow-hidden"
        style={{
          backgroundColor: '#FFFEFC',
          border: '1px solid #E5DED3',
          borderRadius: '28px',
          boxShadow: '0 12px 40px rgba(41, 42, 39, 0.12)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <p
            className="font-medium uppercase"
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: '#71806A',
            }}
          >
            Virgo Portals
          </p>
          <h2
            className="mt-1.5 font-bold leading-tight"
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '30px',
              color: '#292A27',
            }}
          >
            Your language
          </h2>
          <p
            className="mt-1.5"
            style={{
              fontSize: '15px',
              color: '#77766F',
              lineHeight: '1.5',
            }}
          >
            Choose how you'd like to explore the menu.
          </p>
        </div>

        {/* Search field */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: '#71806A' }}
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find your language"
              className="w-full focus:outline-none"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5DED3',
                borderRadius: '12px',
                padding: '12px 12px 12px 42px',
                fontSize: '15px',
                color: '#292A27',
                transition: 'border-color 200ms ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#71806A'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E5DED3'; }}
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable language list */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft px-6 pb-5">
          {filtered.length === 0 ? (
            <p
              className="py-10 text-center"
              style={{ fontSize: '15px', color: '#77766F' }}
            >
              No languages match your search.
            </p>
          ) : (
            <ul>
              {filtered.map((lang) => (
                <li key={lang.native}>
                  <button
                    type="button"
                    onClick={() => onSelect(lang.native)}
                    className="flex w-full items-center gap-3 py-3.5 text-left transition-colors duration-150 hover:bg-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71806A] rounded-xl px-2"
                    style={{ minHeight: '50px' }}
                  >
                    <span
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center text-[18px] leading-none"
                      style={{
                        backgroundColor: '#F4F1EA',
                        borderRadius: '8px',
                      }}
                    >
                      {lang.flag}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-medium"
                        style={{ fontSize: '15px', color: '#292A27' }}
                      >
                        {lang.native}
                      </p>
                      {lang.english !== lang.native ? (
                        <p
                          className="truncate"
                          style={{ fontSize: '12px', color: '#85847B' }}
                        >
                          {lang.english}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0"
                      style={{ color: '#A8A89E' }}
                      aria-hidden="true"
                    />
                  </button>
                  <div style={{ height: '1px', backgroundColor: '#EAE5DC' }} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
