import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  resourceType: 'department' | 'event';
  resourceName: string;
  introduction: string;
  images: string[];
  onContinue: () => void;
}

export function WelcomeScreen({
  resourceType,
  resourceName,
  introduction,
  images,
  onContinue,
}: WelcomeScreenProps) {
  const [imageStatus, setImageStatus] = useState<Record<string, 'loaded' | 'failed'>>({});

  const uniqueImages = useMemo(() => Array.from(new Set(images)), [images]);
  const imageSignature = uniqueImages.join('\\u0000');

  useEffect(() => {
    setImageStatus({});
  }, [imageSignature]);

  const loadedImages = uniqueImages.filter((src) => imageStatus[src] === 'loaded');
  const allImagesSettled =
    uniqueImages.length > 0 &&
    uniqueImages.every((src) => imageStatus[src] === 'loaded' || imageStatus[src] === 'failed');
  const animationReady = allImagesSettled && loadedImages.length > 0;
  const displayImages = animationReady ? [...loadedImages, ...loadedImages] : [...uniqueImages, ...uniqueImages];
  const showBackground = animationReady;

  const markImageLoaded = (src: string) => {
    setImageStatus((current) =>
      current[src] === 'loaded' ? current : { ...current, [src]: 'loaded' }
    );
  };

  const markImageFailed = (src: string) => {
    setImageStatus((current) =>
      current[src] === 'failed' ? current : { ...current, [src]: 'failed' }
    );
    if (import.meta.env.DEV) {
      console.warn('[WelcomeScreen] Dish background image failed to load:', src);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden animate-fade-in"
      style={{ backgroundColor: '#1F2620' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Welcome to ${resourceName}`}
    >
      {uniqueImages.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            className="food-wall-track"
            style={{
              animationDuration: `${Math.max(loadedImages.length, 1) * 6}s`,
              animationPlayState: animationReady ? 'running' : 'paused',
              visibility: animationReady ? 'visible' : 'hidden',
            }}
          >
            {displayImages.map((src, index) => (
              <img
                key={`${src}-${index}`}
                src={src}
                alt=""
                className="food-wall-image"
                onLoad={() => markImageLoaded(src)}
                onError={() => markImageFailed(src)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="absolute inset-0"
        style={{
          background: showBackground
            ? 'linear-gradient(180deg, rgba(31,38,32,0.55) 0%, rgba(31,38,32,0.7) 50%, rgba(31,38,32,0.85) 100%)'
            : 'linear-gradient(180deg, #2A332B 0%, #1F2620 50%, #1A1F19 100%)',
        }}
        aria-hidden="true"
      />

      <div className="welcome-screen-content relative z-10 flex w-full flex-col items-center justify-center px-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              color: '#C8D4BD',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Your AI Menu Assistant
          </span>

          <h1
            className="font-display leading-tight text-white"
            style={{
              fontSize: 'clamp(28px, 6vw, 40px)',
              fontWeight: 700,
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}
          >
            {resourceName}
          </h1>

          <p
            className="animate-fade-in font-sans leading-relaxed"
            style={{
              fontSize: 'clamp(15px, 2.4vw, 17px)',
              color: 'rgba(255,255,255,0.88)',
              textShadow: '0 1px 8px rgba(0,0,0,0.3)',
              animationDelay: '0.25s',
            }}
          >
            {introduction || `Welcome to ${resourceName}! Discover something you'll love. Explore the menu, find your favourites, and let our AI assistant help you choose.`}
          </p>

          <button
            type="button"
            onClick={onContinue}
            className="mx-auto mt-4 inline-flex animate-bubble-pulse items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            style={{
              backgroundColor: '#EB7C10',
              boxShadow: '0 8px 24px rgba(235, 124, 16, 0.35)',
            }}
          >
            Continue
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
