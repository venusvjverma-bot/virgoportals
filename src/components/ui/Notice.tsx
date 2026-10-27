import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type NoticeTone = 'error' | 'success' | 'info';

const TONES: Record<NoticeTone, { wrap: string; icon: string }> = {
  error: { wrap: 'bg-error-50 text-error-700 ring-error-200', icon: 'text-error-500' },
  success: { wrap: 'bg-success-50 text-success-700 ring-success-200', icon: 'text-success-500' },
  info: { wrap: 'bg-olive-50 text-olive-800 ring-olive-100', icon: 'text-olive-500' },
};

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info };

interface NoticeProps {
  tone: NoticeTone;
  children: React.ReactNode;
  className?: string;
}

export function Notice({ tone, children, className }: NoticeProps) {
  const Icon = ICONS[tone];
  return (
    <div
      className={cn(
        'flex animate-pop items-start gap-2.5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset',
        TONES[tone].wrap,
        className
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONES[tone].icon)} />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
