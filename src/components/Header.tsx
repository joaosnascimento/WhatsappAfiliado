import React from 'react';
import { LayoutDashboard, Settings2, Search, Users, Send, ShieldCheck, MoreHorizontal, LogOut, Share2 } from 'lucide-react';
import type { MarketplaceAccount } from '../types/affiliate.ts';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accounts: MarketplaceAccount[];
  onRunTests: () => void;
  isTestingSuite: boolean;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, accounts, onRunTests, isTestingSuite, onLogout }) => {
  const ml = accounts.find(a => a.marketplace === 'MERCADOLIVRE');
  const sh = accounts.find(a => a.marketplace === 'SHOPEE');
  const primary = [
    {id:'dashboard',label:'Início',icon:LayoutDashboard},
    {id:'setup',label:'Configuração',icon:Settings2},
    {id:'offers',label:'Ofertas',icon:Search},
    {id:'destinations',label:'WhatsApp',icon:Users},
    {id:'queue',label:'Fila',icon:Send},
  ];
  const secondary = [
    {id:'affiliates',label:'APIs e Afiliados'},
    {id:'audit',label:'Auditoria'},
    {id:'docs',label:'Testes e documentação'},
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <button onClick={()=>setActiveTab('dashboard')} className="flex items-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10"><Share2 className="h-5 w-5"/></div>
            <div className="hidden sm:block"><div className="font-bold tracking-tight text-white">WhatsappAfiliado</div><div className="text-[11px] text-slate-500">Automação de ofertas</div></div>
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <span className={ml?.status === 'CONNECTED' ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300" : "rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400"}>ML {ml?.status === 'CONNECTED' ? 'conectado' : 'pendente'}</span>
            <span className={sh?.status === 'CONNECTED' ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300" : "rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400"}>Shopee {sh?.status === 'CONNECTED' ? 'conectada' : 'pendente'}</span>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto pb-2">
          {primary.map(({id,label,icon:Icon}) => (
            <button key={id} onClick={()=>setActiveTab(id)} className={activeTab===id ? "flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950" : "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-white"}>
              <Icon className="h-3.5 w-3.5"/>{label}
            </button>
          ))}
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-white"><MoreHorizontal className="h-3.5 w-3.5"/>Mais</summary>
            <div className="absolute right-0 top-10 z-50 min-w-56 rounded-xl border border-slate-800 bg-slate-900 p-1 shadow-2xl">
              {secondary.map(item=><button key={item.id} onClick={()=>setActiveTab(item.id)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white">{item.label}</button>)}
              <button onClick={onRunTests} disabled={isTestingSuite} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-emerald-300 hover:bg-slate-800 disabled:opacity-50"><ShieldCheck className="h-3.5 w-3.5"/>{isTestingSuite?'Executando testes...':'Executar testes'}</button>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
};
