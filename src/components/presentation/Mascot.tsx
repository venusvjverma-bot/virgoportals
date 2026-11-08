import { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';

export type MascotPose = 'enter' | 'idle' | 'waving' | 'pointing' | 'presenting' | 'celebrating';

const SKIN = '#4E5B41';
const SKIN_DARK = '#3F4F3A';
const FACE = '#F6F1EA';
const INK = '#1C1917';
const BOW = '#FCFAF7';
const CHEEK = '#E39B95';

interface MascotProps {
  pose?: MascotPose;
  /** Speech text: renders a designed bubble beside the mascot. */
  say?: string;
  className?: string;
  bubbleSide?: 'right' | 'left';
}

/**
 * Genuinely animated SVG mascot: a friendly bell-shaped concierge.
 * All poses are animated states (arm motion, blinking, bobbing) — no static image.
 */
export function Mascot({ pose = 'idle', say, className, bubbleSide = 'right' }: MascotProps) {
  const reduceMotion = useReducedMotion();
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    function loop() {
      const delay = 2200 + Math.random() * 2600;
      window.setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setBlink(false);
          loop();
        }, 140);
      }, delay);
    }
    loop();
    return () => {
      cancelled = true;
    };
  }, [reduceMotion]);

  const waving = pose === 'waving' || pose === 'celebrating';
  const armUp = waving || pose === 'pointing' || pose === 'presenting';
  const entering = pose === 'enter';
  const celebrate = pose === 'celebrating';

  const bob: Transition = { duration: 2.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' };

  const bodyVariants = {
    hidden: { opacity: 0, x: reduceMotion ? 0 : -70, y: reduceMotion ? 0 : 6, rotate: reduceMotion ? 0 : -5 },
    visible: { opacity: 1, x: 0, y: 0, rotate: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <div className={`relative inline-flex items-start gap-3 ${className ?? ''}`}>
      {say && bubbleSide === 'left' ? <SpeechBubble text={say} /> : null}
      <motion.div
        variants={bodyVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={bob}
        className="relative"
      >
        <svg width="150" height="170" viewBox="0 0 150 170" fill="none" aria-hidden="true">
          {/* bell body */}
          <ellipse cx="75" cy="152" rx="46" ry="9" fill={SKIN} opacity="0.12" />
          <path
            d="M75 34c22 0 36 17 38 40l6 52c1 9-5 16-14 16H45c-9 0-15-7-14-16l6-52c2-23 16-40 38-40Z"
            fill={SKIN}
          />
          <path
            d="M75 34c22 0 36 17 38 40l6 52c1 9-5 16-14 16h-8c9 0 15-7 14-16l-6-52c-2-23-16-40-38-40h8Z"
            fill={SKIN_DARK}
            opacity="0.55"
          />
          {/* face plate */}
          <ellipse cx="75" cy="92" rx="34" ry="36" fill={FACE} />
          {/* eyes */}
          {blink || reduceMotion === true ? (
            <>
              <rect x="56" y="82" width="10" height="2.6" rx="1.3" fill={INK} />
              <rect x="84" y="82" width="10" height="2.6" rx="1.3" fill={INK} />
            </>
          ) : (
            <>
              <circle cx="61" cy="84" r="5" fill={INK} />
              <circle cx="89" cy="84" r="5" fill={INK} />
              <circle cx="63" cy="82" r="1.6" fill="#FFFFFF" />
              <circle cx="91" cy="82" r="1.6" fill="#FFFFFF" />
            </>
          )}
          {/* cheeks */}
          <ellipse cx="53" cy="98" rx="5" ry="3" fill={CHEEK} opacity="0.55" />
          <ellipse cx="97" cy="98" rx="5" ry="3" fill={CHEEK} opacity="0.55" />
          {/* mouth: changes with pose */}
          {celebrate ? (
            <path d="M66 102q9 10 18 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
          ) : pose === 'pointing' ? (
            <circle cx="80" cy="104" r="3" fill={INK} />
          ) : (
            <path d="M67 101q8 7 16 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
          {/* bow tie */}
          <path d="M66 118l-8-5v10l8-5Zm18 0 8-5v10l-8-5Z" fill={BOW} />
          <circle cx="75" cy="118" r="3" fill={FACE} />
          {/* bell crown loop */}
          <circle cx="75" cy="28" r="7" stroke={SKIN_DARK} strokeWidth="4" fill="none" />
        </svg>

        {/* left arm — resting */}
        {!(waving || celebrate) && (
          <motion.svg
            width="34" height="60" viewBox="0 0 34 60"
            className="absolute -left-6 top-[74px]"
            animate={reduceMotion ? undefined : { rotate: [-4, 4, -4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <path d="M30 6C14 14 6 30 8 52" stroke={SKIN} strokeWidth="11" strokeLinecap="round" fill="none" />
          </motion.svg>
        )}

        {/* right arm — pose driven */}
        {armUp && (
          <motion.svg
            key={`arm-${pose}`}
            width="52" height="86" viewBox="0 0 52 86"
            className="absolute -right-7 top-[52px]"
            initial={reduceMotion ? false : { rotate: -14, originX: '8px', originY: '80px' }}
            animate={{
              rotate: waving
                ? [0, 22, -8, 22, -4]
                : pose === 'pointing'
                  ? [10, 4, 10]
                  : pose === 'presenting'
                    ? [8, 2, 8]
                    : [0, 16, 0, 16],
            }}
            transition={
              waving
                ? { duration: 0.8, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }
                : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
            }
            style={{ originX: '8px', originY: '80px' }}
            aria-hidden="true"
          >
            <path d="M8 80C10 54 22 34 44 20" stroke={SKIN} strokeWidth="11" strokeLinecap="round" fill="none" />
            <circle cx="45" cy="17" r="7" fill={SKIN} />
          </motion.svg>
        )}

        {/* celebration arms — both up */}
        {celebrate && (
          <motion.svg
            width="34" height="60" viewBox="0 0 34 60"
            className="absolute -left-6 top-[74px]"
            initial={reduceMotion ? false : { rotate: 0, originX: '26px', originY: '54px' }}
            animate={{ rotate: reduceMotion ? 0 : [-16, -30, -16] }}
            transition={{ duration: 0.7, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
            style={{ originX: '26px', originY: '54px' }}
            aria-hidden="true"
          >
            <path d="M4 54C20 46 28 30 26 8" stroke={SKIN} strokeWidth="11" strokeLinecap="round" fill="none" />
            <circle cx="26" cy="8" r="7" fill={SKIN} />
          </motion.svg>
        )}

        {/* confetti on celebration */}
        {celebrate &&
          !reduceMotion &&
          [
            { x: -34, c: '#DDA53C', d: 0 },
            { x: 34, c: '#87976F', d: 0.25 },
            { x: 0, c: '#D06C63', d: 0.5 },
          ].map(({ x, c, d }) => (
            <motion.span
              key={x}
              className="absolute top-2 h-2 w-2 rounded-full"
              style={{ left: `calc(50% + ${x}px)`, backgroundColor: c }}
              animate={{ y: [-4, -34], opacity: [1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: d, ease: 'easeOut' }}
            />
          ))}

        {/* entrance walk dust */}
        {entering && !reduceMotion && (
          <motion.div
            className="absolute bottom-1 left-2 h-2 w-10 rounded-full bg-cream-300"
            animate={{ opacity: [0.8, 0], x: [-8, -24] }}
            transition={{ duration: 1.1, repeat: 2, ease: 'easeOut' }}
          />
        )}
      </motion.div>
      {say && bubbleSide === 'right' ? <SpeechBubble text={say} /> : null}
    </div>
  );
}

function SpeechBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative max-w-[min(240px,100%)] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm font-medium leading-relaxed text-ink shadow-lift ring-1 ring-cream-200"
    >
      {text}
    </motion.div>
  );
}
