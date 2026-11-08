import { FileText, ScanSearch, ListChecks, UserCheck } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';
import { Mascot } from '../Mascot';

const STEPS = [
  { icon: FileText, title: 'Upload your PDF menu', text: 'Take the menu you already have and upload it.' },
  { icon: ScanSearch, title: 'AI reads the menu', text: 'The platform identifies dish names, prices, descriptions and serving sizes — measured sizes like "25 cl" and named sizes like "Large".' },
  { icon: ListChecks, title: 'Dishes appear organised', text: 'Extracted dishes are grouped and placed into your menu, ready to check.' },
  { icon: UserCheck, title: 'You review and approve', text: 'You confirm every dish before it goes live — the AI assists, you stay in control of what guests see.' },
];

export function ExtractionChapter() {
  return (
    <ChapterShell
      id="chapter-extraction"
      chapterNumber={6}
      kicker="AI Menu Extraction"
      title="Your paper menu, typed into your digital menu. Reviewed by you."
      flip
    >
      <ChapterText>
        <ol className="space-y-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  <span className="mr-2 text-olive-600">{index + 1}.</span>
                  {title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-2xl bg-cream-100 p-4 ring-1 ring-cream-200">
          <p className="text-sm leading-relaxed text-ink-soft">
            Extraction is AI-assisted, not magic: unusual menus, unclear scans or unfamiliar formats can need
            correcting — that is why every extracted dish goes through your review before it reaches your
            guests.
          </p>
        </div>
      </ChapterText>
      <div className="relative">
        <ChapterVisual src="/extraction.webp" alt="A printed menu transforming into organised digital dish cards" />
        <div className="absolute -top-6 right-2 w-20 sm:w-24">
          <Mascot pose="pointing" className="drop-shadow-lift" />
        </div>
      </div>
    </ChapterShell>
  );
}
