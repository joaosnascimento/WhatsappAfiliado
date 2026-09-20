import React from 'react';
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement>{}
export const Skeleton:React.FC<SkeletonProps>=({className='',...props})=><div aria-hidden="true" className={['animate-pulse rounded-md bg-surface-3',className].join(' ')} {...props}/>;