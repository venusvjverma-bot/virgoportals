import { useMemo } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { ParticleNetworkBg } from 'particle-network-bg/react';
import type { ParticleNetworkConfig } from 'particle-network-bg';

interface AuthShellProps {
  subtitle: string;
  children: React.ReactNode;
  animatedBg?: boolean;
  mascotUrl?: string;
  wide?: boolean;
}

function particleCountForViewport(): number {
  if (typeof window === 'undefined') return 60;
  return window.innerWidth < 768 ? 45 : 80;
}

export function AuthShell({ subtitle, children, animatedBg = false, mascotUrl, wide = false }: AuthShellProps) {
  const particleConfig = useMemo<Partial<ParticleNetworkConfig>>(
    () => ({
      particleCount: particleCountForViewport(),
      particleColor: '#7c9b5e',
      lineColor: '#a8c98a',
      backgroundColor: '#F6F1EA',
      minRadius: 1.5,
      maxRadius: 3.5,
      linkDistance: 140,
    }),
    [],
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {animatedBg && (
          <ParticleNetworkBg
            config={particleConfig}
            className="h-full w-full"
            style={{ background: 'transparent' }}
          />
        )}
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-olive-200/35 blur-3xl" />
        <div className="absolute -bottom-52 -right-32 h-[30rem] w-[30rem] rounded-full bg-warning-100/60 blur-3xl" />
      </div>

      <div className={`relative z-10 w-full animate-fade-in ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        <div className="mb-8 flex flex-col items-center text-center">
          {mascotUrl ? (
            <div className="relative flex flex-col items-center">
              <img
                src={mascotUrl}
                alt=""
                aria-hidden="true"
                className="h-24 w-auto object-contain sm:h-28"
              />
              <div
                className="pointer-events-none mt-1 h-3 w-16 rounded-[50%] bg-olive-900/25 blur-md sm:w-20"
                aria-hidden="true"
              />
            </div>
          ) : null}
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Virgo Portals
          </h1>
          <p className="mt-3 flex items-center gap-2 text-base text-ink-muted">
            <UtensilsCrossed className="h-4 w-4 text-olive-500" />
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
