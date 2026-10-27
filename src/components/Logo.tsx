import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  tone?: 'light' | 'dark';
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-10 w-10', className)} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <circle cx="20" cy="20" r="9.5" fill="none" stroke="#F6F1EA" strokeWidth="1.6" opacity="0.85" />
      <circle cx="20" cy="20" r="3.4" fill="#F6F1EA" />
      <circle cx="27.4" cy="12.6" r="1.5" fill="#F6F1EA" opacity="0.9" />
    </svg>
  );
}

export function Logo({ className, tone = 'dark' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark className={tone === 'light' ? 'text-cream-100' : 'text-olive-700'} />
      <span
        className={cn(
          'font-display text-lg font-semibold tracking-tight',
          tone === 'light' ? 'text-cream-100' : 'text-ink'
        )}
      >
        Virgo Portals
      </span>
    </div>
  );
}
