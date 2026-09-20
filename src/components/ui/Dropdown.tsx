import React from 'react';
import { ChevronDown } from 'lucide-react';
interface DropdownProps{label?:string;trigger?:React.ReactNode;children:React.ReactNode;align?:'left'|'right'}
export const Dropdown:React.FC<DropdownProps>=({label='Abrir menu',trigger,children,align='right'})=>{
 const [open,setOpen]=React.useState(false); const ref=React.useRef<HTMLDivElement>(null);
 React.useEffect(()=>{if(!open)return; const down=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false)}; const key=(e:KeyboardEvent)=>{const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')||[]); const active=document.activeElement as HTMLElement|null; const i=Math.max(0,items.indexOf(active)); if(e.key==='Escape'){e.preventDefault();setOpen(false);ref.current?.querySelector<HTMLButtonElement>('[data-dropdown-trigger]')?.focus()} else if(e.key==='ArrowDown'){e.preventDefault();items[(i+1)%items.length]?.focus()} else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length]?.focus()} else if(e.key==='Home'){e.preventDefault();items[0]?.focus()} else if(e.key==='End'){e.preventDefault();items.at(-1)?.focus()}}; document.addEventListener('mousedown',down);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',down);document.removeEventListener('keydown',key)}},[open]);
 return <div ref={ref} className="relative">
  <button type="button" data-dropdown-trigger aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={()=>setOpen(v=>!v)} className="outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15">{trigger||<><span>{label}</span><ChevronDown className="h-4 w-4"/></>}</button>
  {open&&<div role="menu" className={['absolute top-[calc(100%+8px)] z-50 min-w-56 rounded-lg border border-border-strong bg-surface-3 p-1.5 shadow-popover animate-dropdown',align==='right'?'right-0':'left-0'].join(' ')} onClick={()=>setOpen(false)}>{children}</div>}
 </div>;
};