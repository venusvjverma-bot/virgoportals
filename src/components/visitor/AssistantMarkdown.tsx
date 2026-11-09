import type { ReactNode } from 'react';

type Block =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'ul' | 'ol'; items: string[] };

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|\*[^*\s\n][^*\n]*\*|\[[^\]\n]+\]\([^)\s]+\))/;

interface NameMatcher {
  pattern: RegExp;
  names: Set<string>;
}

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

function buildNameMatcher(names: string[]): NameMatcher | null {
  const valid = names
    .filter((n) => n.trim().length > 1)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (valid.length === 0) return null;
  return {
    pattern: new RegExp(`(${valid.join('|')})`),
    names: new Set(names.filter((n) => n.trim().length > 1)),
  };
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

function renderTextWithNames(text: string, keyPrefix: string, matcher: NameMatcher | null): ReactNode[] {
  if (!matcher) return [<span key={`${keyPrefix}-0`}>{text}</span>];
  return text.split(matcher.pattern).map((part, index) => {
    if (!part) return null;
    if (matcher.names.has(part)) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-semibold text-olive-700">
          {part}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

export function AssistantMarkdown({ text, highlightNames = [] }: { text: string; highlightNames?: string[] }) {
  const blocks = parseBlocks(text);
  const matcher = buildNameMatcher(highlightNames);
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const headingClass = block.level === 1
            ? 'font-display text-base font-semibold text-ink'
            : 'font-semibold text-ink';
          return (
            <p key={index} className={`${headingClass} pt-1 leading-snug`}>
              {renderTextWithNames(block.text, `h-${index}`, matcher)}
            </p>
          );
        }
        if (block.type === 'paragraph') {
          return (
            <p key={index} className="whitespace-pre-line break-words">
              {renderInline(block.lines.join('\n')).map((node, nodeIndex) => {
                if (!node || typeof node !== 'object' || !('props' in node)) return node;
                const child = (node as { props: { children?: ReactNode } }).props.children;
                return typeof child === 'string'
                  ? renderTextWithNames(child, `p-${index}-${nodeIndex}`, matcher)
                  : child;
              }).filter(Boolean)}
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
                {renderTextWithNames(item, `li-${index}-${itemIndex}`, matcher)}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
