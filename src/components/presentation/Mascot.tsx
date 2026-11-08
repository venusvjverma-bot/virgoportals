import { motion, useReducedMotion } from 'motion/react';

export type MascotPose = 'idle' | 'waving' | 'pointing' | 'celebrating';

const POSE_SRC: Record<MascotPose, string> = {
  idle: '/mascot-idle.webp',
  waving: '/mascot-waving.webp',
  pointing: '/mascot-pointing.webp',
  celebrating: '/mascot-celebrating.webp',
};

interface MascotProps {
  pose?: MascotPose;
  className?: string;
}

/**
 * Static-artwork mascot with graceful animation. A Rive-driven mascot can
 * replace this component later without touching call sites (same props).
 */
export function Mascot({ pose = 'idle', className }: MascotProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.img
      key={pose}
      src={POSE_SRC[pose]}
      alt="Virgo mascot"
      loading="lazy"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    />
  );
}
