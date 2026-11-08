import type { ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useRef } from 'react';

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades/slides children in when they enter the viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Parallax layer: drifts vertically as the visitor scrolls through it. */
export function Parallax({
  children,
  distance = 40,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [distance, -distance]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/** An SVG path that draws itself when scrolled into view. */
export function DrawnPath({
  d,
  stroke = '#657554',
  width = 2.5,
  delay = 0,
  className,
  dashed = false,
}: {
  d: string;
  stroke?: string;
  width?: number;
  delay?: number;
  className?: string;
  dashed?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} aria-hidden="true">
      <motion.path
        d={d}
        stroke={stroke}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dashed ? '4 4' : undefined}
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 1.4, delay, ease: EASE }}
      />
    </svg>
  );
}

/** A small labelled node that pops in, for workflow diagrams. */
export function FlowNode({
  icon,
  label,
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.5, ease: EASE }}
      className="flex flex-col items-center gap-1.5"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-olive-700 shadow-soft ring-1 ring-cream-200">
        {icon}
      </span>
      <span className="text-center text-xs font-medium leading-tight text-ink-soft">{label}</span>
    </motion.div>
  );
}

/** Continuously floating element (gentle bob + tilt). */
export function Floating({
  children,
  delay = 0,
  distance = 8,
  rotate = 2,
  className,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  rotate?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -distance, 0], rotate: [-rotate, rotate, -rotate] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** A scroll progress value hook scoped to a section (0 at entry, 1 at exit). */
export function useSectionProgress(): [React.RefObject<HTMLDivElement>, MotionValue<number>] {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  return [ref, scrollYProgress];
}
