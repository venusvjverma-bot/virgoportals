import { cn } from '@/lib/cn';

export type BadgeTone = 'success' | 'error' | 'olive' | 'neutral' | 'warning';

const TONES: Record<BadgeTone, string> = {
  success: 'bg-success-100 text-success-700 ring-success-200',
  error: 'bg-error-100 text-error-700 ring-error-200',
  olive: 'bg-olive-100 text-olive-800 ring-olive-200',
  warning: 'bg-warning-100 text-warning-700 ring-warning-200',
  neutral: 'bg-cream-200 text-ink-soft ring-cream-300',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
