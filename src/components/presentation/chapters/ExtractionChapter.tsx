import { motion, useReducedMotion } from 'motion/react';
import { UserCheck, ScanSearch } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { Mascot } from '../Mascot';
import { EASE } from '../visuals';

/** Rows of "menu text" on the PDF, used for the scan animation. */
function PdfRow({ delay, wide = false }: { delay: number; wide?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-1.5">
      <motion.div
        initial={{ opacity: 0.25 }}
        whileInView={{ opacity: [0.25, 1, 0.25] }}
        viewport={{ once: true }}
        transition={{ delay, duration: 1.4 }}
        className={`h-2 rounded bg-ink/30 ${wide ? 'w-24' : 'w-16'}`}
      />
      <motion.div
        initial={{ opacity: 0.25 }}
        whileInView={{ opacity: [0.25, 1, 0.25] }}
        viewport={{ once: true }}
        transition={{ delay: delay + 0.15, duration: 1.4 }}
        className="h-2 w-8 rounded bg-ink/30"
      />
    </div>
  );
}

function ExtractedDish({ name, price, delay }: { name: string; price: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -60, scale: 0.9 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.65, ease: EASE }}
      className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-lift ring-1 ring-cream-200"
    >
      <div>
        <p className="text-xs font-semibold text-ink">{name}</p>
        <div className="mt-1 h-1.5 w-16 rounded bg-cream-200" />
      </div>
      <span className="text-xs font-bold text-olive-700">{price}</span>
    </motion.div>
  );
}

export function ExtractionChapter() {
  const reduce = useReducedMotion();
  return (
    <ChapterShell
      id="chapter-extraction"
      chapterNumber={6}
      kicker="AI Menu Extraction"
      title="Your paper menu, typed into your digital menu. Reviewed by you."
      flip
    >
      <ChapterText>
        <ol className="space-y-3">
          {[
            'Upload your existing PDF menu.',
            'The platform identifies dish names, prices, descriptions and serving sizes — measured like "25 cl" and named like "Large".',
            'Extracted dishes are grouped and placed into your menu, ready to check.',
            'You confirm every dish before it goes live — the AI assists, you stay in control.',
          ].map((text, i) => (
            <motion.li
              key={text}
              initial={reduce ? false : { opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: EASE }}
              className="flex gap-3 text-sm leading-relaxed text-ink-soft"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-600 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              {text}
            </motion.li>
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

      <div className="relative flex h-[440px] items-center justify-center gap-4 sm:h-[500px] sm:gap-8">
        {/* PDF document */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -50, rotate: -6 }}
          whileInView={{ opacity: 1, y: 0, rotate: -3 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative w-40 rounded-xl bg-white p-3 shadow-lift ring-1 ring-cream-200 sm:w-48"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="h-2 w-10 rounded bg-error-300" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">PDF</span>
          </div>
          <PdfRow delay={0.6} wide />
          <PdfRow delay={0.9} />
          <PdfRow delay={1.2} wide />
          <PdfRow delay={1.5} />
          {/* scanning line sweeps */}
          <motion.div
            className="absolute inset-x-2 h-0.5 rounded bg-olive-500"
            animate={reduce ? { top: '90%' } : { top: ['12%', '90%', '12%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* scan badge */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.8, duration: 0.4, ease: EASE }}
            className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-olive-600 text-white shadow-lift"
          >
            <ScanSearch className="h-4 w-4" />
          </motion.div>
        </motion.div>

        {/* extraction beam */}
        <svg viewBox="0 0 60 100" preserveAspectRatio="none" className="h-64 w-12 sm:h-80">
          <motion.path
            d="M8 20 C 26 40, 34 60, 52 80"
            stroke="#657554" strokeWidth="2.5" fill="none" strokeDasharray="5 5"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ delay: 1.6, duration: 1.0, ease: EASE }}
          />
        </svg>

        {/* digital dishes form */}
        <div className="flex w-44 flex-col gap-2.5 sm:w-52">
          <ExtractedDish name="Tagliatelle" price="14.50" delay={1.8} />
          <ExtractedDish name="Ribeye — Large" price="26.00" delay={2.0} />
          <ExtractedDish name="House Red 25cl" price="6.50" delay={2.2} />
          {/* host review stamp */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
            whileInView={{ opacity: 1, scale: 1, rotate: -4 }}
            viewport={{ once: true }}
            transition={{ delay: 2.6, duration: 0.5, ease: EASE }}
            className="mx-auto mt-1 flex items-center gap-2 rounded-full bg-success-500 px-4 py-2 text-xs font-bold text-white shadow-lift"
          >
            <UserCheck className="h-4 w-4" />
            Reviewed by you
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 hidden scale-75 sm:block">
          <Mascot pose="presenting" say="Watch your menu come to life." />
        </div>
      </div>
    </ChapterShell>
  );
}
