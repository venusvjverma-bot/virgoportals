import { cn } from '@/lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
}

const VARIANTS = {
  primary:
    'bg-olive-700 text-white shadow-soft hover:bg-olive-800 hover:shadow-lift active:scale-[0.99]',
  secondary:
    'bg-white text-ink ring-1 ring-inset ring-cream-300 hover:bg-cream-50 hover:ring-olive-200 active:scale-[0.99]',
  ghost: 'bg-transparent text-ink-soft hover:bg-cream-200/70 hover:text-ink',
  danger:
    'bg-white text-error-600 ring-1 ring-inset ring-error-200 hover:bg-error-50 hover:ring-error-300 active:scale-[0.99]',
} as const;

const SIZES = {
  md: 'px-5 py-2.5 text-sm',
  sm: 'px-3.5 py-2 text-[13px]',
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-soft',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    />
  );
}
