import React from 'react';
export type CardVariant='default'|'raised'|'subtle'|'interactive';
interface CardProps extends React.HTMLAttributes<HTMLDivElement>{variant?:CardVariant}
const variants:Record<CardVariant,string>={
 default:'bg-surface-1 border border-border',
 raised:'bg-surface-2 border border-border-strong shadow-card',
 subtle:'bg-surface-soft border border-border',
 interactive:'bg-surface-1 border border-border transition-all duration-150 hover:border-border-strong hover:bg-surface-2',
};
export const Card=React.forwardRef<HTMLDivElement,CardProps>(({variant='default',className='',...props},ref)=><div ref={ref} className={['rounded-lg',variants[variant],className].join(' ')} {...props}/>);
Card.displayName='Card';