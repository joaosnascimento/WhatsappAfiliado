import React from 'react';
import {
  ShoppingBag,
  Send,
  DollarSign,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Settings2,
  ChevronRight,
} from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-400">Painel</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Tudo em um só lugar</h1>
          <p className="mt-1 text-sm text-slate-400">Acompanhe suas ofertas e envios sem complicação.</p>
        </div>
        <button onClick={onNavigateToOffers} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">
          <ShoppingBag className="h-4 w-4" /> Encontrar ofertas
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label:'Ofertas encontradas', value:totalOffers, icon:ShoppingBag },
          { label:'Prontas para enviar', value:totalReady, icon:CheckCircle2 },
          { label:'Enviadas no WhatsApp', value:totalPublications, icon:Send },
          { label:'Comissão gerada', value:`R$ ${totalCommission.toFixed(2)}`, icon:DollarSign },
        ].map(({label,value,icon:Icon}) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{label}</span>
              <Icon className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Status da automação</h2>
            <p className="mt-1 text-sm text-slate-400">Veja rapidamente se está tudo pronto para funcionar.</p>
          </div>
          <button onClick={onNavigateToAffiliates} className="inline-flex items-center gap-1 self-start rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
            Configurações <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { label:'WhatsApp', text:'Conectado', ok:true },
            { label:'Mercado Livre', text:ml.productsFound || ml.affiliateLinksReady ? 'Ativo' : 'Configure quando quiser', ok:Boolean(ml.productsFound || ml.affiliateLinksReady) },
            { label:'Shopee', text:shopee.productsFound || shopee.affiliateLinksReady ? 'Ativo' : 'Configure quando quiser', ok:Boolean(shopee.productsFound || shopee.affiliateLinksReady) },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                {item.ok ? <CheckCircle2 className="h-4 w-4"/> : <Clock3 className="h-4 w-4"/>}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="text-xs text-slate-400">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Atividade</h2>
              <p className="mt-1 text-sm text-slate-400">Resumo dos resultados acumulados.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-950/60 p-4"><div className="text-xs text-slate-500">Cliques</div><div className="mt-1 text-xl font-bold text-white">{totalClicks}</div></div>
            <div className="rounded-xl bg-slate-950/60 p-4"><div className="text-xs text-slate-500">Conversões</div><div className="mt-1 text-xl font-bold text-white">{totalConversions}</div></div>
            <div className="rounded-xl bg-slate-950/60 p-4"><div className="text-xs text-slate-500">Links prontos</div><div className="mt-1 text-xl font-bold text-white">{totalReady}</div></div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
            <ArrowUpRight className="h-4 w-4 text-emerald-400"/> Os números são atualizados conforme o sistema registra novas atividades.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-slate-500"/>
            <h2 className="text-lg font-bold text-white">Marketplaces</h2>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-4">
              <span className="text-sm font-medium text-white">Shopee</span>
              <span className="text-xs text-slate-400">{shopee.publications} envios</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-4">
              <span className="text-sm font-medium text-white">Mercado Livre</span>
              <span className="text-xs text-slate-400">{ml.publications} envios</span>
            </div>
          </div>
          <button onClick={onNavigateToAffiliates} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white">
            Gerenciar integrações <ChevronRight className="h-3.5 w-3.5"/>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Conversões recentes</h2>
          <p className="mt-1 text-sm text-slate-400">Quando houver vendas atribuídas, elas aparecerão aqui.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead><tr className="border-b border-slate-800 text-slate-500">
              <th className="pb-3 font-semibold">Pedido</th><th className="pb-3 font-semibold">Marketplace</th><th className="pb-3 font-semibold">Pedido</th><th className="pb-3 font-semibold">Comissão</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 font-semibold">Data</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {reports?.recentConversions?.length ? reports.recentConversions.map(conv => (
                <tr key={conv.id}>
                  <td className="py-3 font-mono text-slate-400">{conv.external_id}</td>
                  <td className="py-3">{conv.marketplace === 'SHOPEE' ? 'Shopee' : 'Mercado Livre'}</td>
                  <td className="py-3 font-medium text-white">R$ {(conv.order_amount ?? 0).toFixed(2)}</td>
                  <td className="py-3 font-bold text-emerald-400">R$ {conv.commission.toFixed(2)}</td>
                  <td className="py-3"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-400">{conv.status}</span></td>
                  <td className="py-3 text-slate-500">{new Date(conv.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              )) : <tr><td colSpan={6} className="py-10 text-center text-slate-500">Nenhuma conversão registrada ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
