import React from 'react';
import { LayoutDashboard, Search, Users, Send, MoreHorizontal, LogOut, Share2, Settings2 } from 'lucide-react';
import type { MarketplaceAccount } from '../types/affiliate.ts';

interface HeaderProps { activeTab:string; setActiveTab:(tab:string)=>void; accounts:MarketplaceAccount[]; onRunTests:()=>void; isTestingSuite:boolean; onLogout:()=>void; }

export const Header:React.FC<HeaderProps>=({activeTab,setActiveTab,accounts,onRunTests,isTestingSuite,onLogout})=>{
 const ml=accounts.find(a=>a.marketplace==='MERCADOLIVRE'); const sh=accounts.find(a=>a.marketplace==='SHOPEE');
 const items=[{id:'dashboard',label:'Início',icon:LayoutDashboard},{id:'offers',label:'Ofertas',icon:Search},{id:'destinations',label:'WhatsApp',icon:Users},{id:'queue',label:'Envios',icon:Send}];
 return <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
  <div className="mx-auto max-w-7xl px-4 sm:px-6">
   <div className="flex h-16 items-center justify-between gap-4">
    <button onClick={()=>setActiveTab('dashboard')} className="flex items-center gap-3 text-left"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950"><Share2 className="h-4 w-4"/></div><div><div className="font-bold tracking-tight text-white">WhatsappAfiliado</div><div className="hidden text-[10px] text-slate-500 sm:block">Ofertas automáticas no WhatsApp</div></div></button>
    <div className="hidden items-center gap-2 sm:flex"><span className={"rounded-full border px-2.5 py-1 text-[10px] "+(ml?.status==='CONNECTED'?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-slate-800 bg-slate-900 text-slate-500')}>Mercado Livre {ml?.status==='CONNECTED'?'✓':'—'}</span><span className={"rounded-full border px-2.5 py-1 text-[10px] "+(sh?.status==='CONNECTED'?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-slate-800 bg-slate-900 text-slate-500')}>Shopee {sh?.status==='CONNECTED'?'✓':'—'}</span></div>
   </div>
   <nav className="flex items-center gap-1 overflow-x-auto pb-2">
    {items.map(({id,label,icon:Icon})=><button key={id} onClick={()=>setActiveTab(id)} className={"flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold "+(activeTab===id?'bg-emerald-500 text-slate-950':'text-slate-400 hover:bg-slate-900 hover:text-white')}><Icon className="h-3.5 w-3.5"/>{label}</button>)}
    <button onClick={()=>setActiveTab('setup')} className={"ml-auto flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold "+(activeTab==='setup'?'bg-slate-800 text-white':'text-slate-500 hover:bg-slate-900 hover:text-white')}><Settings2 className="h-3.5 w-3.5"/>Configurar</button>
    <details className="relative"><summary className="flex cursor-pointer list-none items-center rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-900 hover:text-white"><MoreHorizontal className="h-4 w-4"/></summary><div className="absolute right-0 top-10 z-50 min-w-52 rounded-xl border border-slate-800 bg-slate-900 p-1 shadow-2xl"><button onClick={()=>setActiveTab('affiliates')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800">Marketplaces e APIs</button><button onClick={()=>setActiveTab('audit')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800">Auditoria</button><button onClick={()=>setActiveTab('docs')} className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800">Ajuda e testes</button><button onClick={onRunTests} disabled={isTestingSuite} className="w-full rounded-lg px-3 py-2 text-left text-xs text-emerald-300 hover:bg-slate-800">{isTestingSuite?'Executando testes...':'Executar testes'}</button><button onClick={onLogout} className="mt-1 w-full border-t border-slate-800 px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-800 hover:text-white"><LogOut className="mr-2 inline h-3.5 w-3.5"/>Sair</button></div></details>
   </nav>
  </div>
 </header>;
};