import { motion, useReducedMotion } from 'motion/react';
import { QrCode, Smartphone, UtensilsCrossed, MessageCircle, ClipboardList } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';
import { Mascot } from '../Mascot';

export function WelcomeChapter() {
  const reduceMotion = useReducedMotion();
  return (
    <ChapterShell
      id="chapter-welcome"
      chapterNumber={1}
      kicker="Welcome"
      title={
        <>
          Your restaurant. <span className="text-olive-700">Connected through one digital experience.</span>
        </>
      }
    >
      <ChapterText>
        <p>
          Virgo Portals gives your restaurant a digital presence your guests can open with a single scan — a
          beautiful menu, an AI assistant that answers their questions, and orders that arrive straight at your
          counter.
        </p>
        <p>
          One place to manage your menu. One link between your tables and your kitchen. No apps for your
          guests to install.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { icon: QrCode, text: 'QR-based guest access' },
            { icon: UtensilsCrossed, text: 'Centralised menu management' },
            { icon: MessageCircle, text: 'AI-assisted customer interaction' },
            { icon: ClipboardList, text: 'Restaurant order management' },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-ink">{text}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Smartphone className="h-4 w-4 text-olive-600" />
          Everything runs in the guest's own phone — nothing to download.
        </p>
      </ChapterText>
      <div className="relative">
        <ChapterVisual src="/hero-restaurant.webp" alt="A restaurant transforming into a connected digital experience" />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -bottom-6 -left-4 w-24 sm:w-32"
        >
          <Mascot pose="waving" className="drop-shadow-lift" />
        </motion.div>
      </div>
    </ChapterShell>
  );
}
