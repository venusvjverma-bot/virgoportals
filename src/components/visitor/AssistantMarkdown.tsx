import type { ReactNode } from 'react';

type Block =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'ul' | 'ol'; items: string[] };

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|\*[^*\s\n][^*\n]*\*|\[[^\]\n]+\]\([^)\s]+\))/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph && paragraph.length > 0) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = null;
  };

  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (line.trim() === '') {
      flushParagraph();
    } else if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
    } else if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)![1];
      const last = blocks[blocks.length - 1];
      if (last && last.type === type) {
        last.items.push(item);
      } else {
        blocks.push({ type, items: [item] });
      }
    } else {
      if (!paragraph) paragraph = [];
      paragraph.push(line);
    }
  }
  flushParagraph();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, index) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link && SAFE_LINK.test(link[2])) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-olive-700 underline underline-offset-2 break-words hover:text-olive-800"
        >
          {link[1]}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function AssistantMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const headingClass = block.level === 1
            ? 'font-display text-base font-semibold text-ink'
            : 'font-semibold text-ink';
          return (
            <p key={index} className={`${headingClass} pt-1 leading-snug`}>
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === 'paragraph') {
          return (
            <p key={index} className="whitespace-pre-line break-words">
              {renderInline(block.lines.join('\n'))}
            </p>
          );
        }
        const ListTag = block.type;
        return (
          <ListTag
            key={index}
            className={`space-y-1.5 break-words pl-5 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-ink-muted`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                {renderInline(item)}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
