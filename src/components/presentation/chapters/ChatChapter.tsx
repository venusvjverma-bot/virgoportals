import { motion, useReducedMotion } from 'motion/react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { Mascot } from '../Mascot';
import { PhoneMock } from './WelcomeChapter';
import { EASE } from '../visuals';

function ChatBubble({
  from = 'assistant',
  children,
  delay,
}: {
  from?: 'assistant' | 'guest';
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.92 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.5, ease: EASE }}
      className={`max-w-[75%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed shadow-soft ${
        from === 'assistant'
          ? 'self-start rounded-bl-sm bg-white text-ink ring-1 ring-cream-200'
          : 'self-end rounded-br-sm bg-olive-700 text-white'
      }`}
    >
      {children}
    </motion.div>
  );
}

function FoodChip({ label, tone, delay }: { label: string; tone: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      className="flex items-center gap-2 rounded-xl bg-white p-1.5 shadow-soft ring-1 ring-cream-200"
    >
      <span className={`h-8 w-8 rounded-lg ${tone}`} />
      <div>
        <p className="text-[10px] font-semibold text-ink">{label}</p>
        <div className="mt-0.5 h-1 w-10 rounded bg-cream-200" />
      </div>
    </motion.div>
  );
}

export function ChatChapter() {
  const reduceMotion = useReducedMotion();
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
        <div className="space-y-3">
          {[
            'Guests ask questions about dishes and the menu in their own words.',
            'It helps with discovery — finding dishes that match what they feel like.',
            'Suggestions respond to the guest\'s basket, so recommendations fit what they have already chosen.',
            'The assistant only works from your actual menu — guests can\'t order things you don\'t serve.',
          ].map((text, i) => (
            <motion.p
              key={text}
              initial={{ opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
              className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-olive-500" />
              {text}
            </motion.p>
          ))}
        </div>
      </ChapterText>

      <div className="relative flex h-[480px] items-center justify-center sm:h-[540px]">
        {/* phone with animated conversation */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <PhoneMock>
            <div className="flex h-full flex-col gap-1.5">
              <ChatBubble from="guest" delay={0.7}>Something light with herbs?</ChatBubble>
              <ChatBubble delay={1.2}>Our grilled sea bass with lemon thyme is a favourite.</ChatBubble>
              <ChatBubble from="guest" delay={1.7}>And to drink?</ChatBubble>
              <ChatBubble delay={2.2}>A crisp 25 cl house white pairs beautifully.</ChatBubble>
            </div>
          </PhoneMock>
        </motion.div>

        {/* recommendations connect out of the phone */}
        <div className="absolute right-[4%] top-[16%] flex flex-col gap-3">
          <FoodChip label="Sea bass" tone="bg-olive-200" delay={2.6} />
          <FoodChip label="House white 25cl" tone="bg-warning-200" delay={2.8} />
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <motion.path
            d="M58 40 C 72 32, 78 28, 86 24"
            stroke="#657554" strokeWidth="0.8" fill="none" strokeDasharray="2 2"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ delay: 2.4, duration: 0.7, ease: EASE }}
          />
          <motion.path
            d="M58 52 C 72 58, 78 62, 86 66"
            stroke="#DDA53C" strokeWidth="0.8" fill="none" strokeDasharray="2 2"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ delay: 2.6, duration: 0.7, ease: EASE }}
          />
        </svg>

        {/* mascot introduces the feature */}
        <div className="absolute bottom-0 left-0 hidden scale-75 sm:block">
          <Mascot pose="pointing" say="Ask it anything about the menu." />
        </div>
      </div>
    </ChapterShell>
  );
}
