import React from 'react';
import { ShoppingBag, Send, DollarSign, CheckCircle2, Clock3, ChevronRight, MousePointerClick, BarChart3 } from 'lucide-react';
import type { Conversion } from '../types/affiliate.ts';

interface ReportData {
  shopee: { productsFound:number; affiliateLinksReady:number; publications:number; clicksTracked:number; conversions:number; commissionBrl:number };
  mercadolivre: { productsFound:number; affiliateLinksReady:number; publications:number; clicksTracked:number; conversions:number; commissionBrl:number };
  recentConversions: Conversion[];
}
interface DashboardTabProps {
  reports: ReportData | null;
  onNavigateToOffers: () => void;
  onNavigateToAffiliates: () => void;
}
const empty = { productsFound:0, affiliateLinksReady:0, publications:0, clicksTracked:0, conversions:0, commissionBrl:0 };

export const DashboardTab: React.FC<DashboardTabProps> = ({ reports, onNavigateToOffers, onNavigateToAffiliates }) => {
  const shopee = reports?.shopee || empty;
  const ml = reports?.mercadolivre || empty;
  const totalOffers = shopee.productsFound + ml.productsFound;
  const totalReady = shopee.affiliateLinksReady + ml.affiliateLinksReady;
  const totalPublications = shopee.publications + ml.publications;
  const totalClicks = shopee.clicksTracked + ml.clicksTracked;
  const totalConversions = shopee.conversions + ml.conversions;
  const totalCommission = shopee.commissionBrl + ml.commissionBrl;

  const stats = [
    { label:'Ofertas', value:totalOffers, icon:ShoppingBag },
    { label:'Prontas', value:totalReady, icon:CheckCircle2 },
    { label:'Enviadas', value:totalPublications, icon:Send },
    { label:'Comissão', value:`R$ ${totalCommission.toFixed(2)}`, icon:DollarSign },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="flex flex-col gap-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Painel</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Sua automação está aqui.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Encontre ofertas, gere mensagens e envie para seus grupos sem ficar navegando por telas técnicas.</p>
        </div>
        <button onClick={onNavigateToOffers} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400">
          <ShoppingBag className="h-4 w-4" /> Encontrar ofertas
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({label,value,icon:Icon}) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon className="h-4 w-4" />{label}</div>
            <div className="mt-3 text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Como está indo</h2>
            <p className="mt-1 text-sm text-slate-400">Um resumo rápido do que já aconteceu.</p>
          </div>
          <button onClick={onNavigateToAffiliates} className="inline-flex items-center gap-1 self-start text-xs font-semibold text-slate-400 hover:text-white">Configurar integrações <ChevronRight className="h-3.5 w-3.5"/></button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 p-5"><MousePointerClick className="h-5 w-5 text-slate-500"/><div className="mt-4 text-xs text-slate-500">Cliques</div><div className="mt-1 text-2xl font-bold text-white">{totalClicks}</div></div>
          <div className="rounded-2xl bg-slate-950 p-5"><BarChart3 className="h-5 w-5 text-slate-500"/><div className="mt-4 text-xs text-slate-500">Conversões</div><div className="mt-1 text-2xl font-bold text-white">{totalConversions}</div></div>
          <div className="rounded-2xl bg-slate-950 p-5"><Send className="h-5 w-5 text-slate-500"/><div className="mt-4 text-xs text-slate-500">Envios</div><div className="mt-1 text-2xl font-bold text-white">{totalPublications}</div></div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-lg font-bold text-white">Canais de venda</h2><p className="mt-1 text-sm text-slate-400">Acompanhe cada marketplace sem abrir outro painel.</p></div>
          <button onClick={onNavigateToAffiliates} className="hidden items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white sm:inline-flex">Gerenciar <ChevronRight className="h-3.5 w-3.5"/></button>
        </div>
        <div className="mt-5 divide-y divide-slate-800">
          {[['Shopee',shopee.publications,shopee.productsFound],['Mercado Livre',ml.publications,ml.productsFound]].map(([name,sends,found])=>(
            <div key={name as string} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div><div className="text-sm font-semibold text-white">{name}</div><div className="mt-1 text-xs text-slate-500">{found} ofertas encontradas</div></div>
              <div className="text-right"><div className="text-sm font-semibold text-white">{sends} envios</div><div className="mt-1 text-xs text-slate-500">registrados</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="mb-5"><h2 className="text-lg font-bold text-white">Conversões recentes</h2><p className="mt-1 text-sm text-slate-400">As vendas atribuídas aparecerão aqui.</p></div>
        {reports?.recentConversions?.length ? (
          <div className="space-y-3">
            {reports.recentConversions.slice(0,5).map(conv=>(
              <div key={conv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 p-4">
                <div><div className="text-sm font-semibold text-white">{conv.marketplace==='SHOPEE'?'Shopee':'Mercado Livre'}</div><div className="mt-1 text-xs text-slate-500">{conv.external_id} · {new Date(conv.created_at).toLocaleDateString('pt-BR')}</div></div>
                <div className="text-right"><div className="text-sm font-bold text-emerald-400">R$ {conv.commission.toFixed(2)}</div><div className="mt-1 text-xs text-slate-500">Comissão</div></div>
              </div>
            ))}
          </div>
        ) : <div className="rounded-2xl border border-dashed border-slate-800 px-5 py-10 text-center"><Clock3 className="mx-auto h-7 w-7 text-slate-600"/><p className="mt-3 text-sm font-medium text-slate-300">Ainda não há conversões.</p><p className="mt-1 text-xs text-slate-500">Quando uma venda for atribuída, ela aparecerá aqui.</p></div>}
      </section>
    </div>
  );
};
