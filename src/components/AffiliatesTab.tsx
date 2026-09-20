import React, { useState } from 'react';
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

interface AffiliatesTabProps {
  accounts: MarketplaceAccount[];
  onSaveAccount: (accountId: string, credentials: Record<string, string>) => Promise<void>;
  onTestIntegration: (marketplace: 'SHOPEE' | 'MERCADOLIVRE') => Promise<IntegrationTestResult>;
  whatsappSettings?: any;
  onSaveWhatsApp: (settings:any)=>Promise<void>;
}

export const AffiliatesTab: React.FC<AffiliatesTabProps> = ({
  accounts,
  onSaveAccount,
  onTestIntegration,
  onConnectMercadoLivre,
  whatsappSettings,
  onSaveWhatsApp,
}) => {
  const mlAcc = accounts.find((a) => a.marketplace === 'MERCADOLIVRE');
  const shopeeAcc = accounts.find((a) => a.marketplace === 'SHOPEE');

  // Form states
  const [shopeeAppId, setShopeeAppId] = useState(shopeeAcc?.credentials_encrypted?.shopee_app_id || '');
  const [shopeeSecret, setShopeeSecret] = useState('');

  const [isSavingShopee, setIsSavingShopee] = useState(false);
  const [testingMarketplace, setTestingMarketplace] = useState<'SHOPEE' | 'MERCADOLIVRE' | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<IntegrationTestResult | null>(null);
  const [waProvider,setWaProvider]=useState(whatsappSettings?.provider||'evolution');
  const [waUrl,setWaUrl]=useState(whatsappSettings?.evolutionApiUrl||'');
  const [waKey,setWaKey]=useState('');
  const [waInstance,setWaInstance]=useState(whatsappSettings?.evolutionInstance||'');
  const [waSaving,setWaSaving]=useState(false);

  const handleSaveShopee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingShopee(true);
    try {
      await onSaveAccount('acc_shopee_br', {
        shopee_app_id: shopeeAppId,
        shopee_secret: shopeeSecret || shopeeAcc?.credentials_encrypted?.shopee_secret || '',
      });
      alert('Credenciais da Shopee Open API salvas com sucesso.');
    } catch (err) {
      alert(`Erro ao salvar: ${(err as Error).message}`);
    } finally {
      setIsSavingShopee(false);
    }
  };

  const handleRunDiagnostic = async (marketplace: 'SHOPEE' => {
    setTestingMarketplace(marketplace);
    try {
      const result = await onTestIntegration(marketplace);
      setDiagnosticResult(result);
    } catch (err) {
      alert(`Erro ao executar diagnóstico: ${(err as Error).message}`);
    } finally {
      setTestingMarketplace(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Overview Notice */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Gerenciamento de Integrações de Afiliados
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Cada marketplace possui infraestrutura, segurança e modelos de autenticação completamente isolados. Configure as credenciais oficiais para permitir buscas automáticas de catálogo, cálculo de assinaturas criptográficas e validação estrita de atribuição.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div><h3 className="font-bold text-white">WhatsApp / Evolution API</h3><p className="text-xs text-slate-400 mt-1">Configuração por workspace; a chave fica criptografada no banco.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={waProvider} onChange={e=>setWaProvider(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
            <option value="evolution">Evolution API</option><option value="cloud">Meta Cloud API</option>
          </select>
          <input value={waUrl} onChange={e=>setWaUrl(e.target.value)} placeholder="https://sua-evolution" className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
          <input value={waInstance} onChange={e=>setWaInstance(e.target.value)} placeholder="Nome da instância" className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
        </div>
        <div className="flex gap-3">
          <input type="password" value={waKey} onChange={e=>setWaKey(e.target.value)} placeholder={whatsappSettings?.evolutionApiKey==='configured'?'Chave já configurada':'Evolution API Key'} className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
          <button disabled={waSaving} onClick={async()=>{setWaSaving(true);try{await onSaveWhatsApp({provider:waProvider,evolutionApiUrl:waUrl,evolutionApiKey:waKey,evolutionInstance:waInstance});alert('WhatsApp configurado.')}catch(e){alert((e as Error).message)}finally{setWaSaving(false)}}} className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold">{waSaving?'Salvando...':'Salvar WhatsApp'}</button>
        </div>
      </div>

      {/* 2 Dedicated Marketplace Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SHOPEE CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-2xl">
                🟠
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-lg">Shopee Brasil</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    Affiliate Open API
                  </span>
                </div>
                <p className="text-xs text-slate-400">GraphQL + Assinatura Criptográfica SHA-256</p>
              </div>
            </div>

            {/* Status badge */}
            <div className="text-right">
              {shopeeAcc?.status === 'CONNECTED' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Open API Ativa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
                  Aguardando App ID
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <strong className="text-white block mb-1">Mecanismo Oficial:</strong>
            A Shopee Affiliate Open API opera em <code className="text-orange-300">open-api.affiliate.shopee.com.br/graphql</code>. Cada requisição é assinada com SHA-256 no header de autorização, permitindo geração nativa de short links com até 5 SubIds de rastreamento.
          </div>

          {/* Form */}
          <form onSubmit={handleSaveShopee} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Shopee Affiliate App ID
              </label>
              <input
                id="shopee-input-app-id"
                type="text"
                placeholder="Ex: 1092837482"
                value={shopeeAppId}
                onChange={(e) => setShopeeAppId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Shopee Affiliate Secret Key
              </label>
              <input
                id="shopee-input-secret"
                type="password"
                placeholder={shopeeAcc?.credentials_encrypted?.shopee_secret ? '••••••••••••••••' : 'Chave secreta para assinatura'}
                value={shopeeSecret}
                onChange={(e) => setShopeeSecret(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Endpoint GraphQL do Brasil
              </label>
              <input
                type="text"
                disabled
                value="https://open-api.affiliate.shopee.com.br/graphql"
                className="w-full bg-slate-800/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono cursor-not-allowed"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                id="btn-save-shopee-config"
                type="submit"
                disabled={isSavingShopee}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {isSavingShopee ? 'Salvando...' : 'Salvar Credenciais Shopee'}
              </button>

              <button
                id="btn-test-shopee-integration"
                type="button"
                onClick={() => handleRunDiagnostic('SHOPEE')}
                disabled={testingMarketplace === 'SHOPEE'}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-base">
                Resultado do Diagnóstico de Integração &bull; {diagnosticResult.marketplace}
              </h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                diagnosticResult.overall_status === 'SUCCESS'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
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
                  {step.status === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {step.status === 'WARNING' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  {step.status === 'ERROR' && <XCircle className="w-4 h-4 text-rose-400" />}
                  {step.status === 'PENDING' && <RefreshCw className="w-4 h-4 text-blue-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{step.step}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        step.status === 'SUCCESS'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : step.status === 'WARNING'
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{step.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
