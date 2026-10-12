import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'brass' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pine text-white hover:bg-pine-dark disabled:bg-pine/50',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-white hover:border-ink-3 disabled:text-ink-3 disabled:bg-surface-2',
  brass: 'bg-brass text-ink hover:bg-brass-dark disabled:opacity-60',
  ghost: 'text-ink-2 hover:bg-ink/5 hover:text-ink disabled:text-ink-3',
  danger: 'bg-crit text-white hover:bg-crit/90 disabled:opacity-60',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-md',
  md: 'h-10 px-4 text-[15px] rounded-lg',
  lg: 'h-12 px-6 text-[16px] rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
