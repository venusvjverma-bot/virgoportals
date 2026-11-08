import { Bot, Compass, Lightbulb, ShoppingBasket } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';
import { Mascot } from '../Mascot';

export function ChatChapter() {
  return (
    <ChapterShell
      id="chapter-chat"
      chapterNumber={8}
      kicker="AI-Powered Visitor Chat"
      title="A helpful assistant, sat at every table."
      flip
    >
      <ChapterText>
        <p>
          Alongside your menu, every guest has access to an AI assistant that knows your restaurant's menu and
          helps them make choices.
        </p>
        <div className="grid gap-3">
          {[
            { icon: Compass, text: 'Guests ask questions about dishes and the menu in their own words.' },
            { icon: Lightbulb, text: 'It helps with discovery — finding dishes that match what they feel like.' },
            { icon: ShoppingBasket, text: 'Suggestions respond to the guest\'s basket, so recommendations fit what they have already chosen.' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm leading-relaxed text-ink-soft">{text}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-muted">
          The assistant only works from your actual menu — guests can't order things you don't serve.
        </p>
      </ChapterText>
      <div className="relative">
        <ChapterVisual src="/customer-phone.webp" alt="A guest chatting with the AI assistant about the menu" />
        <div className="absolute -bottom-6 right-2 w-20 sm:w-24">
          <Mascot pose="idle" className="drop-shadow-lift" />
        </div>
      </div>
    </ChapterShell>
  );
}
