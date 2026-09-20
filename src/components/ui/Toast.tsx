import React from 'react';
import { CheckCircle2, CircleAlert, Info, X, Loader2 } from 'lucide-react';
type ToastKind='success'|'error'|'info'|'loading';
interface ToastItem{id:number;kind:ToastKind;title:string;message?:string}
interface ToastContextValue{toast:(kind:ToastKind,title:string,message?:string)=>void}
const ToastContext=React.createContext<ToastContextValue|null>(null);
export const ToastProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const [items,setItems]=React.useState<ToastItem[]>([]);
 const remove=(id:number)=>setItems(v=>v.filter(x=>x.id!==id));
 const toast=(kind:ToastKind,title:string,message?:string)=>{const id=Date.now()+Math.random();setItems(v=>[...v,{id,kind,title,message}]);if(kind!=='loading')window.setTimeout(()=>remove(id),4200)};
 return <ToastContext.Provider value={{toast}}>{children}<div className="fixed right-4 top-20 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2.5" aria-live="polite">{items.map(item=><ToastItemView key={item.id} item={item} onClose={()=>remove(item.id)}/>)}</div></ToastContext.Provider>;
};
const ToastItemView:React.FC<{item:ToastItem;onClose:()=>void}>=({item,onClose})=>{
 const Icon=item.kind==='success'?CheckCircle2:item.kind==='error'?CircleAlert:item.kind==='loading'?Loader2:Info;
 return <div className="animate-toast-in rounded-lg border border-border-strong bg-surface-3 p-3.5 shadow-popover"><div className="flex gap-3"><Icon className={['mt-0.5 h-4 w-4 shrink-0',item.kind==='success'?'text-emerald-400':item.kind==='error'?'text-red-400':item.kind==='loading'?'animate-spin text-brand-400':'text-blue-400'].join(' ')}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text">{item.title}</p>{item.message&&<p className="mt-0.5 text-xs leading-5 text-muted">{item.message}</p>}</div><button onClick={onClose} aria-label="Fechar" className="text-subtle hover:text-text"><X className="h-4 w-4"/></button></div></div>;
};
export const useToast=()=>{const ctx=React.useContext(ToastContext);if(!ctx)throw new Error('useToast must be used inside ToastProvider');return ctx.toast};