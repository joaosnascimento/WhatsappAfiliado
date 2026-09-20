import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>{label?:string;hint?:string;error?:string;icon?:React.ReactNode}
export const Input=React.forwardRef<HTMLInputElement,InputProps>(({label,hint,error,icon,className='',id,...props},ref)=>{
 const generatedId=React.useId(); const inputId=id||generatedId;
 return <div className="space-y-1.5">
  {label&&<label htmlFor={inputId} className="block text-sm font-medium text-text">{label}</label>}
  <div className="relative">
   {icon&&<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">{icon}</span>}
   <input ref={ref} id={inputId} aria-invalid={!!error} aria-describedby={error?inputId+'-error':hint?inputId+'-hint':undefined}
    className={['w-full min-h-10 rounded-md border bg-surface-soft px-3.5 py-2.5 text-sm text-text outline-none transition-shadow placeholder:text-subtle',icon?'pl-10':'','focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10',error?'border-danger focus:border-danger focus:ring-danger/10':'border-border'].join(' ')+ ' '+className} {...props}/>
  </div>
  {error?<p id={inputId+'-error'} className="text-xs font-medium text-red-300">{error}</p>:hint?<p id={inputId+'-hint'} className="text-xs text-muted">{hint}</p>:null}
 </div>;
});
Input.displayName='Input';