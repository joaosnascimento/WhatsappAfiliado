import React, { useState } from 'react';
import { useToast } from './ui/Toast.tsx';
import {
  ShieldCheck,
  Key,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Lock,
  Zap,
  Info,
} from 'lucide-react';
import type { MarketplaceAccount, IntegrationTestResult } from '../types/affiliate.ts';

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface AffiliatesTabProps {
  apiFetch: ApiFetch;
  accounts: MarketplaceAccount[];
  onSaveAccount: (accountId: string, credentials: Record<string, string>) => Promise<void>;
  onTestIntegration: (marketplace: 'SHOPEE') => Promise<IntegrationTestResult>;
  whatsappSettings?: any;
  onSaveWhatsApp: (settings:any)=>Promise<void>;
}

export const AffiliatesTab: React.FC<AffiliatesTabProps> = ({
  apiFetch,
  accounts,
  onSaveAccount,
  onTestIntegration,
  whatsappSettings,
  onSaveWhatsApp,
}) => {
  const shopeeAcc = accounts.find((a) => a.marketplace === 'SHOPEE');
  const mlAcc = accounts.find((a) => a.marketplace === 'MERCADOLIVRE');
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [mlBusy, setMlBusy] = useState(false);
  const refreshMlStatus = async () => {
    try { const r = await apiFetch('/api/mercadolivre/status'); const d = await r.json().catch(() => ({})); if (r.ok) setMlStatus(d); } catch {}
  };
  const connectMl = async () => {
    setMlBusy(true);
    try { const r = await apiFetch('/api/mercadolivre/connect', { method: 'POST' }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Não foi possível conectar.'); setMlStatus(d); toast('success','Conexão iniciada',d.message || 'A conexão foi iniciada.'); }
    catch (e) { toast('error','Falha na conexão',(e as Error).message); } finally { setMlBusy(false); }
  };
  const disconnectMl = async () => {
    setMlBusy(true);
    try { const r = await apiFetch('/api/mercadolivre/disconnect', { method: 'POST' }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Não foi possível desconectar.'); setMlStatus(d); }
    catch (e) { toast('error','Falha ao configurar WhatsApp',(e as Error).message); } finally { setMlBusy(false); }
  };

  // Form states
  const [shopeeAppId, setShopeeAppId] = useState(shopeeAcc?.credentials_encrypted?.shopee_app_id || '');
  const [shopeeSecret, setShopeeSecret] = useState('');

  const [isSavingShopee, setIsSavingShopee] = useState(false);
  const [testingMarketplace, setTestingMarketplace] = useState<'SHOPEE' | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<IntegrationTestResult | null>(null);
  const [waProvider,setWaProvider]=useState(whatsappSettings?.provider||'evolution');
  const [waUrl,setWaUrl]=useState(whatsappSettings?.evolutionApiUrl||'');
  const [waKey,setWaKey]=useState('');
  const [waInstance,setWaInstance]=useState(whatsappSettings?.evolutionInstance||'');
  const [waSaving,setWaSaving]=useState(false);

  React.useEffect(() => { void refreshMlStatus(); const t = window.setInterval(() => void refreshMlStatus(), 8000); return () => window.clearInterval(t); }, []);

  const handleSaveShopee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingShopee(true);
    try {
      await onSaveAccount('acc_shopee_br', {
        shopee_app_id: shopeeAppId,
        shopee_secret: shopeeSecret || shopeeAcc?.credentials_encrypted?.shopee_secret || '',
      });
      toast('success','Credenciais salvas','As credenciais da Shopee foram atualizadas.');
    } catch (err) {
      toast('error','Erro ao salvar',(err as Error).message);
    } finally {
      setIsSavingShopee(false);
    }
  };

  const handleRunDiagnostic = async (marketplace: 'SHOPEE') => {
    setTestingMarketplace(marketplace);
    try {
      const result = await onTestIntegration(marketplace);
      setDiagnosticResult(result);
    } catch (err) {
      toast('error','Diagnóstico falhou',(err as Error).message);
    } finally {
      setTestingMarketplace(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Overview Notice */}
      <div className="bg-surface-1 border border-border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text tracking-tight">
              Gerenciamento de Integrações de Afiliados
            </h2>
            <p className="text-sm text-text mt-1 leading-relaxed">
              Configure apenas as integrações que realmente estão ativas. O Mercado Livre usa o fluxo oficial de geração de link no Portal de Afiliados, sem OAuth DevCenter ou dependência do catálogo MLB.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface-1 border border-border rounded-lg p-6 space-y-4">
        <div><h3 className="font-bold text-text">WhatsApp / Evolution API</h3><p className="text-sm text-muted mt-1">Configuração por workspace; a chave fica criptografada no banco.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={waProvider} onChange={e=>setWaProvider(e.target.value)} className="bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text">
            <option value="evolution">Evolution API</option><option value="cloud">Meta Cloud API</option>
          </select>
          <input value={waUrl} onChange={e=>setWaUrl(e.target.value)} placeholder="https://sua-evolution" className="bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text" />
          <input value={waInstance} onChange={e=>setWaInstance(e.target.value)} placeholder="Nome da instância" className="bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text" />
        </div>
        <div className="flex gap-3">
          <input type="password" value={waKey} onChange={e=>setWaKey(e.target.value)} placeholder={whatsappSettings?.evolutionApiKey==='configured'?'Chave já configurada':'Evolution API Key'} className="flex-1 bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text" />
          <button disabled={waSaving} onClick={async()=>{setWaSaving(true);try{await onSaveWhatsApp({provider:waProvider,evolutionApiUrl:waUrl,evolutionApiKey:waKey,evolutionInstance:waInstance});toast('success','WhatsApp configurado','A configuração foi salva.')}catch(e){alert((e as Error).message)}finally{setWaSaving(false)}}} className="px-4 py-2 bg-brand-500 text-slate-950 rounded-md text-sm font-bold">{waSaving?'Salvando...':'Salvar WhatsApp'}</button>
        </div>
      </div>

      <div className="bg-surface-1 border border-brand-500/30 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-md bg-brand-500/10 text-brand-300 border border-brand-500/30 flex items-center justify-center font-bold text-xl">ML</div>
              <div>
                <h3 className="font-bold text-text text-lg">Mercado Livre</h3>
                <p className="text-sm text-muted">Automação pelo navegador usando sua sessão autenticada.</p>
              </div>
              <span className={`text-sm uppercase font-bold px-2 py-1 rounded-full border ${(mlStatus?.status === 'CONNECTED' || mlAcc?.status === 'CONNECTED') ? 'text-brand-200 bg-brand-500/10 border-brand-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
                {(mlStatus?.status === 'CONNECTED' || mlAcc?.status === 'CONNECTED') ? 'Conectado' : mlStatus?.status === 'LOGIN_REQUIRED' ? 'Login necessário' : 'Desconectado'}
              </span>
            </div>
            <p className="text-sm text-text mt-4 max-w-3xl leading-relaxed">
              O WhatsappAfiliado abre um Chromium, você entra normalmente na sua conta e a sessão é salva de forma protegida. Depois disso, o sistema pode pesquisar produtos, abrir o Gerador de Links, gerar o link de afiliado e continuar o pipeline automaticamente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={connectMl} disabled={mlBusy} className="px-4 py-2.5 bg-brand-500 hover:bg-brand-400 text-slate-950 rounded-md text-sm font-bold disabled:opacity-50">{mlBusy ? 'Abrindo navegador...' : 'Conectar Mercado Livre'}</button>
            <button onClick={refreshMlStatus} disabled={mlBusy} className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border-border-strong border border-border-strong text-text rounded-md text-sm font-semibold">Atualizar</button>
            {(mlStatus?.status === 'CONNECTED' || mlAcc?.status === 'CONNECTED') && <button onClick={disconnectMl} disabled={mlBusy} className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border-border-strong border border-border-strong text-rose-300 rounded-md text-sm font-semibold">Desconectar</button>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md bg-surface-2/70 border border-border p-3"><strong className="text-text">1. Login</strong><p className="text-muted mt-1">Feito no próprio Mercado Livre, sem senha armazenada pelo sistema.</p></div>
          <div className="rounded-md bg-surface-2/70 border border-border p-3"><strong className="text-text">2. Link</strong><p className="text-muted mt-1">O Gerador de Links é operado automaticamente pelo navegador.</p></div>
          <div className="rounded-md bg-surface-2/70 border border-border p-3"><strong className="text-text">3. WhatsApp</strong><p className="text-muted mt-1">Link → IA → deduplicação → fila de publicação.</p></div>
        </div>
      </div>

      {/* 2 Dedicated Marketplace Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SHOPEE CARD */}
        <div className="bg-surface-1 border border-border rounded-lg p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-2xl">
                🟠
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-text text-lg">Shopee Brasil</h3>
                  <span className="text-sm uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    Affiliate Open API
                  </span>
                </div>
                <p className="text-sm text-muted">GraphQL + Assinatura Criptográfica SHA-256</p>
              </div>
            </div>

            {/* Status badge */}
            <div className="text-right">
              {shopeeAcc?.status === 'CONNECTED' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Open API Ativa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-surface-3 border-border-strong text-text">
                  Aguardando App ID
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-md bg-surface-2 border border-border text-sm text-text leading-relaxed">
            <strong className="text-text block mb-1">Mecanismo Oficial:</strong>
            A Shopee Affiliate Open API opera em <code className="text-orange-300">open-api.affiliate.shopee.com.br/graphql</code>. Cada requisição é assinada com SHA-256 no header de autorização, permitindo geração nativa de short links com até 5 SubIds de rastreamento.
          </div>

          {/* Form */}
          <form onSubmit={handleSaveShopee} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Shopee Affiliate App ID
              </label>
              <input
                id="shopee-input-app-id"
                type="text"
                placeholder="Ex: 1092837482"
                value={shopeeAppId}
                onChange={(e) => setShopeeAppId(e.target.value)}
                className="w-full bg-surface-2 border border-border-strong rounded-md px-3.5 py-2.5 text-sm text-text placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Shopee Affiliate Secret Key
              </label>
              <input
                id="shopee-input-secret"
                type="password"
                placeholder={shopeeAcc?.credentials_encrypted?.shopee_secret ? '••••••••••••••••' : 'Chave secreta para assinatura'}
                value={shopeeSecret}
                onChange={(e) => setShopeeSecret(e.target.value)}
                className="w-full bg-surface-2 border border-border-strong rounded-md px-3.5 py-2.5 text-sm text-text placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Endpoint GraphQL do Brasil
              </label>
              <input
                type="text"
                disabled
                value="https://open-api.affiliate.shopee.com.br/graphql"
                className="w-full bg-surface-2 border border-border rounded-md px-3.5 py-2.5 text-sm text-muted font-mono cursor-not-allowed"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                id="btn-save-shopee-config"
                type="submit"
                disabled={isSavingShopee}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 border-border-strong border border-border-strong text-sm font-semibold text-text rounded-md transition cursor-pointer disabled:opacity-50"
              >
                {isSavingShopee ? 'Salvando...' : 'Salvar Credenciais Shopee'}
              </button>

              <button
                id="btn-test-shopee-integration"
                type="button"
                onClick={() => handleRunDiagnostic('SHOPEE')}
                disabled={testingMarketplace === 'SHOPEE'}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-text text-sm font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingMarketplace === 'SHOPEE' ? 'animate-spin' : ''}`} />
                Testar Integração
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Live Diagnostic Results Drawer/Box */}
      {diagnosticResult && (
        <div className="bg-surface-1 border border-brand-500/40 rounded-lg p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-300" />
              <h3 className="font-bold text-text text-base">
                Resultado do Diagnóstico de Integração &bull; {diagnosticResult.marketplace}
              </h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${
                diagnosticResult.overall_status === 'SUCCESS'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {diagnosticResult.overall_status}
            </span>
          </div>

          <div className="divide-y divide-slate-800">
            {diagnosticResult.steps.map((step, idx) => (
              <div key={idx} className="py-3 flex items-start gap-3">
                <div className="mt-0.5">
                  {step.status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-brand-300" />}
                  {step.status === 'WARNING' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {step.status === 'ERROR' && <XCircle className="w-4 h-4 text-rose-400" />}
                  {step.status === 'PENDING' && <RefreshCw className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text">{step.step}</span>
                    <span
                      className={`text-sm font-bold px-1.5 py-0.5 rounded ${
                        step.status === 'SUCCESS'
                          ? 'text-brand-300 bg-brand-500/10'
                          : step.status === 'WARNING'
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-0.5">{step.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
