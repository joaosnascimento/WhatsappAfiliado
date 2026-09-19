import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Link as LinkIcon,
  Send,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { Conversion } from '../types/affiliate.ts';

interface ReportData {
  shopee: {
    productsFound: number;
    affiliateLinksReady: number;
    publications: number;
    clicksTracked: number;
    conversions: number;
    commissionBrl: number;
  };
  mercadolivre: {
    productsFound: number;
    affiliateLinksReady: number;
    publications: number;
    clicksTracked: number;
    conversions: number;
    commissionBrl: number;
  };
  recentConversions: Conversion[];
}

interface DashboardTabProps {
  reports: ReportData | null;
  onNavigateToOffers: () => void;
  onNavigateToAffiliates: () => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  reports,
  onNavigateToOffers,
  onNavigateToAffiliates,
}) => {
  const shopee = reports?.shopee || {
    productsFound: 0,
    affiliateLinksReady: 0,
    publications: 0,
    clicksTracked: 0,
    conversions: 0,
    commissionBrl: 0,
  };

  const ml = reports?.mercadolivre || {
    productsFound: 0,
    affiliateLinksReady: 0,
    publications: 0,
    clicksTracked: 0,
    conversions: 0,
    commissionBrl: 0,
  };

  const totalCommissions = (shopee.commissionBrl + ml.commissionBrl).toFixed(2);
  const totalPublications = shopee.publications + ml.publications;

  return (
    <div className="space-y-8">
      {/* Top Banner with Real SaaS Architecture overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3 h-3" /> Arquitetura de Produção Ativa
              </span>
              <span className="text-xs text-slate-400">&bull; Conformidade estrita com termos de afiliação</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Painel de Operações &bull; Automação de Afiliados
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl mt-1 leading-relaxed">
              Mecanismos reais e independentes para <strong className="text-orange-400">Shopee Open API</strong> (GraphQL + assinatura SHA-256) e <strong className="text-yellow-400">Mercado Livre Brasil</strong> (OAuth DevCenter + validação de links oficiais <code className="text-xs bg-slate-800 px-1 py-0.5 rounded text-amber-300">meli.la</code>).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              id="dashboard-btn-radar"
              onClick={onNavigateToOffers}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              Radar de Ofertas
            </button>
            <button
              id="dashboard-btn-affiliates"
              onClick={onNavigateToAffiliates}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Diagnóstico de APIs
            </button>
          </div>
        </div>
      </div>

      {/* Global Quick Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Comissão Acumulada</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">R$ {totalCommissions}</div>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> Conversões faturadas e atribuídas
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Publicações WhatsApp</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{totalPublications}</div>
            <p className="text-xs text-slate-400 mt-1">Disparadas com mensagens auditadas pela IA</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Links de Afiliados Validados</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <LinkIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              {shopee.affiliateLinksReady + ml.affiliateLinksReady}
            </div>
            <p className="text-xs text-blue-400 mt-1">Prontos para postagem com rastreamento</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cliques Rastreados</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              {shopee.clicksTracked + ml.clicksTracked}
            </div>
            <p className="text-xs text-slate-400 mt-1">Rastreados via SubIds únicos</p>
          </div>
        </div>
      </div>

      {/* Mandatory Marketplace Segregation: Section 24 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SHOPEE METRICS CARD */}
        <div className="bg-slate-900 border border-orange-900/40 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-lg">
                🟠
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Shopee Brasil</h3>
                <p className="text-xs text-slate-400">Affiliate Open API (GraphQL Oficial + SubIds)</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
              Assinatura SHA-256
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Ofertas no Pipeline</span>
              <div className="text-xl font-bold text-white mt-1">{shopee.productsFound}</div>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> {shopee.affiliateLinksReady} links oficiais
              </span>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Publicações Enviadas</span>
              <div className="text-xl font-bold text-white mt-1">{shopee.publications}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Grupos e canais</span>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Conversões Confirmadas</span>
              <div className="text-xl font-bold text-white mt-1">{shopee.conversions}</div>
              <span className="text-[11px] text-orange-400 mt-0.5 block">Via Shopee Open API</span>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Comissão Gerada</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">R$ {shopee.commissionBrl.toFixed(2)}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Taxas de 8% a 14%</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Rastreamento ativo: <code className="text-orange-300">s.shopee.com.br/..</code></span>
            <span className="text-slate-500">5 SubIds vinculados</span>
          </div>
        </div>

        {/* MERCADO LIVRE METRICS CARD */}
        <div className="bg-slate-900 border border-yellow-900/40 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center font-bold text-lg">
                🟡
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Mercado Livre Brasil</h3>
                <p className="text-xs text-slate-400">DevCenter OAuth + Validação de Links <code className="text-amber-300">meli.la</code></p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
              OAuth 2.0 Ativo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Ofertas no Pipeline</span>
              <div className="text-xl font-bold text-white mt-1">{ml.productsFound}</div>
              <span className="text-[11px] text-yellow-400 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> {ml.affiliateLinksReady} links meli.la validados
              </span>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Publicações Enviadas</span>
              <div className="text-xl font-bold text-white mt-1">{ml.publications}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Grupos e canais</span>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Conversões Registradas</span>
              <div className="text-xl font-bold text-white mt-1">{ml.conversions}</div>
              <span className="text-[11px] text-yellow-400 mt-0.5 block">Portal de Afiliados</span>
            </div>

            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800">
              <span className="text-xs text-slate-400">Comissão Gerada</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">R$ {ml.commissionBrl.toFixed(2)}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Atribuição comprovada</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Regra de Segurança: <strong className="text-slate-300">URLs comuns bloqueadas</strong></span>
            <span className="text-yellow-400 font-medium">Exige meli.la oficial</span>
          </div>
        </div>
      </div>

      {/* Pipeline Lifecycle Visual State Machine */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-bold text-white mb-1">
          Ciclo de Vida do Pipeline de Afiliados (Regra 17)
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Diferenciação rigorosa: <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">PRODUCT_FOUND ≠ AFFILIATE_LINK_READY</code>. Somente ofertas com link de afiliado oficial comprovado avançam para publicação.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Etapa 1</span>
            <span className="font-semibold text-xs text-slate-200 block mt-1">DISCOVERED</span>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">Produto localizado via API de catálogo oficial.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Etapa 2</span>
            <span className="font-semibold text-xs text-yellow-300 block mt-1">VALIDATED</span>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">Preço, estoque e dados confirmados. URL original preservada.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Etapa 3</span>
            <span className="font-semibold text-xs text-emerald-300 block mt-1">AFFILIATE_READY</span>
            <p className="text-[11px] text-slate-300 mt-1 leading-snug">Link oficial (meli.la ou Shopee shortLink) validado.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Etapa 4</span>
            <span className="font-semibold text-xs text-blue-300 block mt-1">SCHEDULED</span>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">Mensagem redigida pela IA e enfileirada para o WhatsApp.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Etapa 5</span>
            <span className="font-semibold text-xs text-emerald-400 block mt-1">PUBLISHED</span>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">Enviada ao grupo/canal e registrada na trilha de auditoria.</p>
          </div>
        </div>
      </div>

      {/* Recent Conversions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Eventos Recentes de Conversão & Atribuição</h3>
            <p className="text-xs text-slate-400">Vendas faturadas com SubIds e links de afiliado rastreados</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">ID / Pedido</th>
                <th className="pb-3 font-semibold">Marketplace</th>
                <th className="pb-3 font-semibold">Valor do Pedido</th>
                <th className="pb-3 font-semibold">Comissão</th>
                <th className="pb-3 font-semibold">SubId / Destino</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {reports?.recentConversions && reports.recentConversions.length > 0 ? (
                reports.recentConversions.map((conv) => (
                  <tr key={conv.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 font-mono text-slate-400">{conv.external_id}</td>
                    <td className="py-3">
                      {conv.marketplace === 'SHOPEE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                          Shopee
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                          Mercado Livre
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-medium text-white">R$ {conv.order_amount !== undefined ? conv.order_amount.toFixed(2) : '0,00'}</td>
                    <td className="py-3 font-bold text-emerald-400">+ R$ {conv.commission.toFixed(2)}</td>
                    <td className="py-3">
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-[11px]">
                        {conv.sub_id || 'whatsapp_vip'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {conv.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(conv.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Nenhuma conversão registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
