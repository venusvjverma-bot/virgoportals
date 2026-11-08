import { motion, useReducedMotion } from 'motion/react';
import { Mail, Building2, KeyRound, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { ChapterShell, ChapterText } from '../ChapterShell';
import { EASE } from '../visuals';

const STEPS = [
  { icon: KeyRound, title: 'Create your Host account', text: 'Sign up with your email and a password — the "Become a Host" button on the login page starts it.' },
  { icon: Mail, title: 'Confirm your email', text: 'A verification email makes sure the account is yours before anything goes live.' },
  { icon: Building2, title: 'Your restaurant is created', text: 'Registration sets up your restaurant environment on the platform in the same step.' },
  { icon: LayoutDashboard, title: 'Sign in to your Host Dashboard', text: 'Your dashboard is the control room for menus, departments, orders and settings.' },
];

export function HostChapter() {
  const reduce = useReducedMotion();
  return (
    <ChapterShell
      id="chapter-host"
      chapterNumber={2}
      kicker="Become a Host"
      title="From sign-up to a running restaurant in four steps."
      flip
    >
      <ChapterText>
        <ol className="mt-2 space-y-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <motion.li
              key={title}
              initial={reduce ? false : { opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: index * 0.12, duration: 0.55, ease: EASE }}
              className="flex gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80"
            >
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
            </motion.li>
          ))}
        </ol>
      </ChapterText>

      <div className="relative flex h-[420px] items-center justify-center sm:h-[480px]">
        {/* account card forms first */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -40, rotate: -4 }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="absolute top-6 w-56 rounded-2xl bg-white p-5 shadow-lift ring-1 ring-cream-200"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-olive-50 text-olive-700">
              <Mail className="h-4 w-4" />
            </span>
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-full rounded bg-cream-200" />
              <div className="h-2 w-2/3 rounded bg-cream-100" />
            </div>
          </div>
          <motion.div
            initial={reduce ? false : { scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.9, duration: 0.4, ease: EASE }}
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-success-500 text-white shadow-lift"
          >
            <CheckCircle2 className="h-4 w-4" />
          </motion.div>
        </motion.div>

        {/* restaurant building assembles from blocks */}
        {[
          { w: 'w-40', b: 'bottom-24', d: 0.4 },
          { w: 'w-32', b: 'bottom-36', d: 0.6 },
          { w: 'w-24', b: 'bottom-48', d: 0.8 },
        ].map(({ w, b, d }, i) => (
          <motion.div
            key={d}
            initial={reduce ? false : { opacity: 0, y: 60, scale: 0.8 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: d, duration: 0.6, ease: EASE }}
            className={`absolute ${b} ${w} rounded-xl bg-olive-${(i + 3) * 100} shadow-soft`}
            style={{ height: 28, backgroundColor: ['#ACB99E', '#87976F', '#657554'][i] }}
          />
        ))}
        {/* door + awning */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scaleY: 0 }}
          whileInView={{ opacity: 1, scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.0, duration: 0.4, ease: EASE }}
          className="absolute bottom-24 left-1/2 h-9 w-8 origin-bottom -translate-x-1/2 rounded-t-lg bg-ink/70"
        />
        <motion.div
          initial={reduce ? false : { opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.15, duration: 0.5, ease: EASE }}
          className="absolute bottom-[132px] left-1/2 flex h-4 w-36 -translate-x-1/2 origin-left justify-between rounded-t-full bg-warning-300 px-2"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-full w-1.5 bg-white/70" />
          ))}
        </motion.div>
        {/* connection line account -> restaurant */}
        <motion.svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <motion.path
            d="M50 30 C 50 45, 50 55, 50 66"
            stroke="#657554"
            strokeWidth="0.7"
            fill="none"
            strokeDasharray="2 2"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.2, duration: 0.8, ease: EASE }}
          />
        </motion.svg>
        <p className="absolute bottom-2 w-full text-center text-xs font-medium text-ink-muted">
          Your account and your restaurant — created together.
        </p>
      </div>
    </ChapterShell>
  );
}
