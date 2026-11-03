import { useEffect, useRef, type RefObject } from 'react';

export function createAlertAudio(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

export function playAlertPing(ctx: AudioContext): void {
  if (ctx.state !== 'running') return;
  const start = ctx.currentTime;
  const notes = [
    { frequency: 880, offset: 0 },
    { frequency: 1320, offset: 0.12 },
  ];
  for (const note of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + note.offset;
    oscillator.type = 'sine';
    oscillator.frequency.value = note.frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.4);
  }
}

export function useOrderAlertAudio(): RefObject<AudioContext | null> {
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    function unlock() {
      if (!audioRef.current) audioRef.current = createAlertAudio();
      void audioRef.current?.resume();
    }
    const events = ['pointerdown', 'keydown'] as const;
    for (const type of events) window.addEventListener(type, unlock);
    return () => {
      for (const type of events) window.removeEventListener(type, unlock);
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  return audioRef;
}
