import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mascot } from 'wobnimo/react';
import { latte } from 'wobnimo/characters/latte';

export type CheckoutMascotState = 'listening' | 'celebrating' | 'working' | 'error';

export interface MascotAnchor {
  /** Element to sit beside (an input, a section card, the submit button…). */
  el: HTMLElement;
  /** Which side of the anchor to prefer; falls back to the other side if it does not fit. */
  side: 'left' | 'right';
}

const MASCOT_PX = 88;
const GAP = 8;
const VIEWPORT_MARGIN = 8;

/**
 * Positions the single shared Latte instance beside the element anchored to the
 * current checkout reaction. Uses visualViewport when available so the position
 * is recalculated when the mobile keyboard opens/closes or the page scrolls,
 * keeping Latte fully inside the visible area at all times.
 */
export function CheckoutMascot({
  state,
  anchor,
}: {
  state: CheckoutMascotState | null;
  anchor: MascotAnchor | null;
}) {
  const lastState = useRef<CheckoutMascotState>('listening');
  if (state) lastState.current = state;
  const visible = state !== null;

  const mascotRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const update = useCallback(() => {
    if (!mascotRef.current) return;
    const vv = window.visualViewport;
    const vpTop = vv ? vv.offsetTop : 0;
    const vpLeft = vv ? vv.offsetLeft : 0;
    const visLeft = vv ? Math.max(vpLeft, VIEWPORT_MARGIN) : VIEWPORT_MARGIN;
    const visRight = vv ? Math.min(vpLeft + vv.width, window.innerWidth - VIEWPORT_MARGIN) : window.innerWidth - VIEWPORT_MARGIN;
    const visTop = vv ? Math.max(vpTop, VIEWPORT_MARGIN) : VIEWPORT_MARGIN;
    const visBottom = vv ? Math.min(vpTop + vv.height, window.innerHeight - VIEWPORT_MARGIN) : window.innerHeight - VIEWPORT_MARGIN;

    // Reliable fallback: top-right of the visible viewport. Used when the
    // anchor is missing or unmeasurable so the mascot never ends up hidden.
    if (!anchor || !anchor.el.isConnected) {
      setPos({ top: visTop, left: visRight - MASCOT_PX });
      return;
    }
    const rect = anchor.el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPos({ top: visTop, left: visRight - MASCOT_PX });
      return;
    }

    // Preferred side first; if the mascot would leave the visible area, flip.
    let left: number;
    const trySide = (side: 'left' | 'right') =>
      side === 'right' ? rect.right + GAP : rect.left - MASCOT_PX - GAP;
    left = trySide(anchor.side);
    const fitsPreferred =
      left >= visLeft && left + MASCOT_PX <= visRight;
    if (!fitsPreferred) {
      left = trySide(anchor.side === 'right' ? 'left' : 'right');
      if (left < visLeft) left = visLeft;
      if (left + MASCOT_PX > visRight) left = visRight - MASCOT_PX;
    }

    // Vertically centred on the anchor, clamped into the visible viewport.
    let top = rect.top + rect.height / 2 - MASCOT_PX / 2;
    if (top < visTop) top = visTop;
    if (top + MASCOT_PX > visBottom) top = visBottom - MASCOT_PX;

    setPos({ top, left });
  }, [anchor]);

  useLayoutEffect(() => {
    if (!visible) {
      setPos(null);
      return;
    }
    update();
  }, [visible, update]);

  useEffect(() => {
    if (!visible) return;
    const vv = window.visualViewport;
    const onVv = () => update();
    vv?.addEventListener('resize', onVv);
    vv?.addEventListener('scroll', onVv);
    window.addEventListener('resize', onVv);
    window.addEventListener('scroll', onVv, true);
    window.addEventListener('orientationchange', onVv);
    return () => {
      vv?.removeEventListener('resize', onVv);
      vv?.removeEventListener('scroll', onVv);
      window.removeEventListener('resize', onVv);
      window.removeEventListener('scroll', onVv, true);
      window.removeEventListener('orientationchange', onVv);
    };
  }, [visible, update]);

  return (
    <div
      ref={mascotRef}
      aria-hidden={state === null}
      style={{
        position: 'fixed',
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        width: MASCOT_PX,
        height: MASCOT_PX,
        // No transition on position: repositioning must never animate visibly.
        opacity: visible && pos ? 1 : 0,
        transition: 'opacity 300ms ease-out',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <Mascot
        character={latte}
        state={lastState.current}
        style={{ width: MASCOT_PX, height: MASCOT_PX }}
      />
    </div>
  );
}
