import React,{useEffect,useState} from 'react';
import { ShoppingBag, Send, DollarSign, CheckCircle2, Clock3, ChevronRight, MousePointerClick, BarChart3, MessageCircle, Store, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import type { Conversion, MarketplaceAccount } from '../types/affiliate.ts';

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ReportData {
  shopee: { productsFound:number; affiliateLinksReady:number; publications:number; clicksTracked:number; conversions:number; commissionBrl:number };
  mercadolivre: { productsFound:number; affiliateLinksReady:number; publications:number; clicksTracked:number; conversions:number; commissionBrl:number };
  recentConversions: Conversion[];
}
interface DashboardTabProps {
  reports: ReportData | null;
  accounts: MarketplaceAccount[];
  whatsappSettings:any;
  apiFetch:ApiFetch;
  onNavigateToOffers: () => void;
  onNavigateToAffiliates: () => void;
  onNavigateToSetup: () => void;
  onNavigateToQueue: () => void;
}
const empty = { productsFound:0, affiliateLinksReady:0, publications:0, clicksTracked:0, conversions:0, commissionBrl:0 };

export const DashboardTab: React.FC<DashboardTabProps> = ({ reports, accounts, whatsappSettings, apiFetch, onNavigateToOffers, onNavigateToAffiliates, onNavigateToSetup, onNavigateToQueue }) => {
  const [loading,setLoading]=useState(true);
  const [waState,setWaState]=useState<string>('UNKNOWN');
  const [mlState,setMlState]=useState<'CONNECTED'|'LOGIN_REQUIRED'|'EXPIRED'|'DISCONNECTED'|'ERROR'|'unknown'>('unknown');
  const [refreshing,setRefreshing]=useState(false);
  const [automationEnabled,setAutomationEnabled]=useState(true);
  const [automationBusy,setAutomationBusy]=useState(false);

  const refreshIntegrations=async()=>{
    setRefreshing(true);
    try { const a=await apiFetch('/api/automation/status'); const d=await a.json().catch(()=>({})); if(a.ok) setAutomationEnabled(Boolean(d.enabled)); } catch {}
    try {
      const [wa,ml]=await Promise.all([
        apiFetch('/api/whatsapp/status').then(async r=>({ok:r.ok,data:await r.json().catch(()=>({}))})),
        apiFetch('/api/mercadolivre/status').then(async r=>({ok:r.ok,data:await r.json().catch(()=>({}))})),
      ]);
      setWaState(String(wa.data?.runtimeState || (wa.ok?'UNKNOWN':'ERROR')).toUpperCase());
      setMlState((ml.data?.status || (ml.ok?'unknown':'ERROR')) as any);
    } catch {
      setWaState('error');
      setMlState('ERROR');
    } finally { setRefreshing(false); }
  };

  useEffect(()=>{const t=window.setTimeout(()=>setLoading(false),250);void refreshIntegrations();return()=>window.clearTimeout(t)},[]);
  if (loading && reports===null) {
    return (
      <div className="mx-auto max-w-7xl space-y-5" aria-busy="true">
        <div className="h-36 rounded-xl bg-surface-1 animate-pulse"/>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 rounded-lg bg-surface-1 animate-pulse"/>)}</div>
        <div className="grid gap-5 lg:grid-cols-3"><div className="h-64 rounded-lg bg-surface-1 animate-pulse"/><div className="h-64 rounded-lg bg-surface-1 animate-pulse"/><div className="h-64 rounded-lg bg-surface-1 animate-pulse"/></div>
      </div>
    );
  }

  const shopee = reports?.shopee || empty;
  const ml = reports?.mercadolivre || empty;
  const totalOffers = shopee.productsFound + ml.productsFound;
  const totalReady = shopee.affiliateLinksReady + ml.affiliateLinksReady;
  const totalPublications = shopee.publications + ml.publications;
  const totalClicks = shopee.clicksTracked + ml.clicksTracked;
  const totalConversions = shopee.conversions + ml.conversions;
  const totalCommission = shopee.commissionBrl + ml.commissionBrl;
  const shopeeConnected=accounts.some(a=>a.marketplace==='SHOPEE' && a.status==='CONNECTED');
  const whatsappConfigured=Boolean(whatsappSettings?.provider==='evolution' && whatsappSettings?.evolutionApiUrl && whatsappSettings?.evolutionApiKey==='configured' && whatsappSettings?.evolutionInstance);
  const waOpen=waState==='CONNECTED';
  const mlConnected=mlState==='CONNECTED';

  const stats: Array<{label:string; value:number|string; icon:typeof ShoppingBag; action?:()=>void}> = [
    { label:'Ofertas encontradas', value:totalOffers, icon:ShoppingBag, action:onNavigateToOffers },
    { label:'Links prontos', value:totalReady, icon:CheckCircle2, action:onNavigateToOffers },
    { label:'Envios registrados', value:totalPublications, icon:Send, action:onNavigateToQueue },
    { label:'Comissão', value:`R$ ${totalCommission.toFixed(2)}`, icon:DollarSign },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-xl border border-border bg-surface-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-subtle">Automação global</p><div className="mt-1 flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${automationEnabled?'bg-emerald-400':'bg-amber-400'}`}/><span className="text-sm font-bold text-text">{automationEnabled?'Ativa':'Pausada'}</span></div><p className="mt-1 text-xs text-muted">Pausar impede novas publicações automáticas; o histórico e os envios manuais continuam disponíveis.</p></div>
          <button type="button" disabled={automationBusy} onClick={async()=>{setAutomationBusy(true);try{const r=await apiFetch('/api/automation/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!automationEnabled})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Não foi possível alterar a automação.');setAutomationEnabled(Boolean(d.enabled));}catch{}finally{setAutomationBusy(false)}}} className={`rounded-md px-4 py-2 text-sm font-bold border ${automationEnabled?'border-amber-500/30 bg-amber-500/10 text-amber-300':'border-brand-500/30 bg-brand-500/10 text-brand-300'} disabled:opacity-50`}>{automationBusy?'Atualizando...':automationEnabled?'Pausar automação':'Ativar automação'}</button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface-1 p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-300">Central de operação</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text sm:text-3xl">Controle sua automação em um só lugar.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Veja o que está conectado, identifique o próximo passo e vá direto para a ação — sem procurar configurações escondidas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onNavigateToOffers} className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-bold text-bg hover:bg-brand-400"><ShoppingBag className="h-4 w-4"/>Encontrar ofertas</button>
            <button onClick={onNavigateToQueue} className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text hover:bg-surface-3"><Send className="h-4 w-4"/>Ver envios</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({label,value,icon:Icon,action}) => (
          <button key={label} onClick={action} disabled={!action} className="rounded-lg border border-border bg-surface-1 p-4 text-left transition hover:border-border-strong hover:bg-surface-2 disabled:cursor-default">
            <div className="flex items-center gap-2 text-xs font-semibold text-subtle"><Icon className="h-4 w-4"/>{label}</div>
            <div className="mt-2 text-2xl font-bold text-text">{value}</div>
          </button>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-brand-300"/><h2 className="text-sm font-bold text-text">WhatsApp</h2></div><button onClick={onNavigateToSetup} className="text-xs font-semibold text-muted hover:text-text">Configurar</button></div>
          <div className="mt-4 flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${waOpen?'bg-emerald-400':'bg-amber-400'}`}/><div><div className="text-sm font-semibold text-text">{waOpen?'Conectado':whatsappConfigured?'Desconectado':'Não configurado'}</div><div className="text-xs text-subtle">{waOpen?'Pronto para publicar ofertas.':whatsappConfigured?'Reconecte o WhatsApp para voltar a enviar.':'Configure a Evolution API para começar.'}</div></div></div>
          {!waOpen&&<button onClick={onNavigateToSetup} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:text-brand-200">{whatsappConfigured?'Reconectar WhatsApp':'Configurar WhatsApp'}<ArrowRight className="h-3.5 w-3.5"/></button>}
        </div>

        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Store className="h-4 w-4 text-brand-300"/><h2 className="text-sm font-bold text-text">Mercado Livre</h2></div><button onClick={onNavigateToAffiliates} className="text-xs font-semibold text-muted hover:text-text">Gerenciar</button></div>
          <div className="mt-4 flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${mlConnected?'bg-emerald-400':'bg-amber-400'}`}/><div><div className="text-sm font-semibold text-text">{mlConnected?'Conectado':mlState==='EXPIRED'?'Sessão expirada':mlState==='LOGIN_REQUIRED'?'Login necessário':'Desconectado'}</div><div className="text-xs text-subtle">{mlConnected?'Sessão validada no Mercado Livre.':'Conecte ou faça login novamente para automatizar.'}</div></div></div>
          {!mlConnected&&<button onClick={onNavigateToAffiliates} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:text-brand-200">Resolver conexão<ArrowRight className="h-3.5 w-3.5"/></button>}
        </div>

        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Store className="h-4 w-4 text-orange-300"/><h2 className="text-sm font-bold text-text">Shopee</h2></div><button onClick={onNavigateToAffiliates} className="text-xs font-semibold text-muted hover:text-text">Gerenciar</button></div>
          <div className="mt-4 flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${shopeeConnected?'bg-emerald-400':'bg-amber-400'}`}/><div><div className="text-sm font-semibold text-text">{shopeeConnected?'Configurada':'Aguardando credenciais'}</div><div className="text-xs text-subtle">{shopeeConnected?'Open API pronta para uso.':'Salve App ID e Secret para habilitar a integração.'}</div></div></div>
          {!shopeeConnected&&<button onClick={onNavigateToAffiliates} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:text-brand-200">Configurar Shopee<ArrowRight className="h-3.5 w-3.5"/></button>}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-base font-bold text-text">Desempenho</h2><p className="mt-1 text-xs text-muted">Métricas reais registradas pelo sistema.</p></div><button onClick={()=>void refreshIntegrations()} disabled={refreshing} className="inline-flex items-center gap-1 self-start text-xs font-semibold text-muted hover:text-text">{refreshing?<RefreshCw className="h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="h-3.5 w-3.5"/>}Atualizar conexões</button></div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-bg p-4"><MousePointerClick className="h-4 w-4 text-subtle"/><div className="mt-3 text-xs text-subtle">Cliques</div><div className="mt-1 text-xl font-bold text-text">{totalClicks}</div></div>
            <div className="rounded-lg bg-bg p-4"><BarChart3 className="h-4 w-4 text-subtle"/><div className="mt-3 text-xs text-subtle">Conversões</div><div className="mt-1 text-xl font-bold text-text">{totalConversions}</div></div>
            <div className="rounded-lg bg-bg p-4"><Send className="h-4 w-4 text-subtle"/><div className="mt-3 text-xs text-subtle">Envios</div><div className="mt-1 text-xl font-bold text-text">{totalPublications}</div></div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-brand-300"/><h2 className="text-base font-bold text-text">Próxima ação</h2></div>
          <p className="mt-2 text-sm text-muted">{!waOpen?'Conecte o WhatsApp para habilitar os envios.':!mlConnected&&!shopeeConnected?'Configure pelo menos um marketplace para encontrar ofertas.':totalReady===0?'Encontre uma oferta e gere o link de afiliado.':'Você já tem ofertas prontas. Publique ou acompanhe a fila de envios.'}</p>
          <button onClick={!waOpen?onNavigateToSetup:(!mlConnected&&!shopeeConnected?onNavigateToAffiliates:(totalReady===0?onNavigateToOffers:onNavigateToQueue))} className="mt-4 inline-flex items-center gap-1 rounded-md bg-surface-2 px-3 py-2 text-xs font-bold text-text hover:bg-surface-3">Continuar <ArrowRight className="h-3.5 w-3.5"/></button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-1 p-5">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-base font-bold text-text">Canais de venda</h2><p className="mt-1 text-xs text-muted">Resumo por marketplace.</p></div><button onClick={onNavigateToAffiliates} className="hidden items-center gap-1 text-xs font-semibold text-muted hover:text-text sm:inline-flex">Gerenciar <ChevronRight className="h-3.5 w-3.5"/></button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[['Shopee',shopee.publications,shopee.productsFound],['Mercado Livre',ml.publications,ml.productsFound]].map(([name,sends,found])=>(
            <div key={name as string} className="flex items-center justify-between gap-4 rounded-lg bg-bg px-4 py-3"><div><div className="text-sm font-semibold text-text">{name}</div><div className="mt-1 text-xs text-subtle">{found} ofertas encontradas</div></div><div className="text-right"><div className="text-sm font-semibold text-text">{sends} envios</div><div className="mt-1 text-xs text-subtle">registrados</div></div></div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-1 p-5">
        <div className="mb-4"><h2 className="text-base font-bold text-text">Conversões recentes</h2><p className="mt-1 text-xs text-muted">As vendas atribuídas aparecerão aqui.</p></div>
        {reports?.recentConversions?.length ? (
          <div className="space-y-2">{reports.recentConversions.slice(0,5).map(conv=><div key={conv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-bg px-4 py-3"><div><div className="text-sm font-semibold text-text">{conv.marketplace==='SHOPEE'?'Shopee':'Mercado Livre'}</div><div className="mt-1 text-xs text-subtle">{conv.external_id} · {new Date(conv.created_at).toLocaleDateString('pt-BR')}</div></div><div className="text-right"><div className="text-sm font-bold text-brand-300">R$ {conv.commission.toFixed(2)}</div><div className="mt-1 text-xs text-subtle">Comissão</div></div></div>)}</div>
        ) : <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center"><Clock3 className="mx-auto h-6 w-6 text-subtle"/><p className="mt-2 text-sm font-medium text-text">Ainda não há conversões.</p><p className="mt-1 text-xs text-subtle">Quando uma venda for atribuída, ela aparecerá aqui.</p></div>}
      </section>
    </div>
  );
};
