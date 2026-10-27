import { cn } from '@/lib/cn';

const BASE =
  'w-full rounded-xl border-0 bg-cream-50 px-4 py-3 text-sm text-ink ring-1 ring-inset ring-cream-300 ' +
  'placeholder:text-ink-faint transition-all duration-200 ' +
  'hover:ring-olive-200 focus:bg-white focus:ring-2 focus:ring-olive-500';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...rest }: InputProps) {
  return <input className={cn(BASE, className)} {...rest} />;
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...rest }: TextareaProps) {
  return <textarea className={cn(BASE, 'resize-y leading-relaxed', className)} {...rest} />;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cn(BASE, 'cursor-pointer appearance-none bg-no-repeat pr-10', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2379716B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.85rem center',
      }}
      {...rest}
    >
      {children}
    </select>
  );
}
