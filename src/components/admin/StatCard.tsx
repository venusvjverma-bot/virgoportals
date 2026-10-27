import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: 'olive' | 'success' | 'warning' | 'neutral';
  index?: number;
}

const ACCENTS = {
  olive: 'bg-olive-100 text-olive-700',
  success: 'bg-success-100 text-success-600',
  warning: 'bg-warning-100 text-warning-600',
  neutral: 'bg-cream-200 text-ink-soft',
} as const;

export function StatCard({ label, value, icon, accent = 'olive', index = 0 }: StatCardProps) {
  return (
    <div
      className="animate-fade-in rounded-2xl bg-white p-6 shadow-soft ring-1 ring-cream-200/80 transition-shadow duration-300 hover:shadow-lift"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn('flex h-11 w-11 items-center justify-center rounded-xl', ACCENTS[accent])}
        >
          {icon}
        </span>
      </div>
      <p className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
