import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants: Record<ButtonVariant,string> = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-400 focus-visible:ring-brand-400/40',
  secondary: 'bg-surface-2 text-text border border-border hover:bg-surface-3 focus-visible:ring-brand-400/30',
  ghost: 'text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-brand-400/30',
  danger: 'bg-danger/10 text-red-300 border border-danger/20 hover:bg-danger/15 focus-visible:ring-danger/30',
  success: 'bg-success/10 text-emerald-300 border border-success/20 hover:bg-success/15 focus-visible:ring-success/30',
};
const sizes: Record<ButtonSize,string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-sm',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({variant='primary', size='md', loading=false, icon, children, disabled, className='', ...props}, ref) => (
    <button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined}
      className={['inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all duration-150 outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], className].join(' ')}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
);
Button.displayName='Button';