import React from 'react';
export type BadgeVariant='neutral'|'success'|'warning'|'danger'|'info'|'brand';
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>{variant?:BadgeVariant}
const variants:Record<BadgeVariant,string>={
 neutral:'bg-surface-3 text-muted border-border',
 success:'bg-success/10 text-emerald-300 border-success/20',
 warning:'bg-warning/10 text-amber-300 border-warning/20',
 danger:'bg-danger/10 text-red-300 border-danger/20',
 info:'bg-info/10 text-blue-300 border-info/20',
 brand:'bg-brand-500/10 text-brand-300 border-brand-500/20',
};
export const Badge:React.FC<BadgeProps>=({variant='neutral',className='',children,...props})=><span className={['inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',variants[variant],className].join(' ')} {...props}>{children}</span>;