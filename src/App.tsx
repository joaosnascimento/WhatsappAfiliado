import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { ToastProvider, useToast } from './components/ui/Toast.tsx';
import { DashboardTab } from './components/DashboardTab.tsx';
import { AffiliatesTab } from './components/AffiliatesTab.tsx';
import { OffersTab } from './components/OffersTab.tsx';
import { DestinationsTab } from './components/DestinationsTab.tsx';
import { PublicationsTab } from './components/PublicationsTab.tsx';
import { AuditTab } from './components/AuditTab.tsx';
import { DocsTab } from './components/DocsTab.tsx';
import { SetupTab } from './components/SetupTab.tsx';
import { AssociateLinkModal } from './components/AssociateLinkModal.tsx';
import { AiMessageModal } from './components/AiMessageModal.tsx';
import type {
  MarketplaceAccount,
  Offer,
  Destination,
  Publication,
  IntegrationTestResult,
  MarketplaceType,
} from './types/affiliate.ts';
import type { AuditRecord } from './services/AuditService.ts';

type AuthUser = { id: string; email: string; workspaceId: string };

async function readJson<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

function AppContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [firstRunRedirected, setFirstRunRedirected] = useState(false);
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [whatsappSettings, setWhatsappSettings] = useState<any>(null);

  const [associateModalOffer, setAssociateModalOffer] = useState<Offer | null>(null);
  const [aiModalOffer, setAiModalOffer] = useState<Offer | null>(null);
  const [isTestingSuite, setIsTestingSuite] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('whatsappafiliado_token'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const logout = () => {
    const currentToken = token;
    setToken(null);
    setUser(null);
    localStorage.removeItem('whatsappafiliado_token');
    if (currentToken) {
      void fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` } }).catch(() => undefined);
    }
  };

  const loadData = async () => {
    if (!token) return;
    try {
      const responses = await Promise.all([
        apiFetch('/api/accounts'), apiFetch('/api/offers'), apiFetch('/api/destinations'),
        apiFetch('/api/publications'), apiFetch('/api/reports'), apiFetch('/api/audit'),
        apiFetch('/api/whatsapp/settings'),
      ]);
      if (responses.some((r) => r.status === 401)) { logout(); return; }
      const failedIndex = responses.findIndex((r) => !r.ok);
      if (failedIndex >= 0) {
        const failedData = await readJson<{error?:string}>(responses[failedIndex]);
        throw new Error(failedData.error || `Falha ao carregar dados (HTTP ${responses[failedIndex].status}).`);
      }

      const [accRes, offRes, destRes, pubRes, repRes, audRes, waRes] = await Promise.all(responses.map(readJson));
      setAccounts(Array.isArray(accRes) ? accRes : []);
      setOffers(Array.isArray(offRes) ? offRes : []);
      setDestinations(Array.isArray(destRes) ? destRes : []);
      setPublications(Array.isArray(pubRes) ? pubRes : []);
      setReports(repRes && typeof repRes === 'object' ? repRes : null);
      setAuditRecords(Array.isArray(audRes) ? audRes : []);
      setWhatsappSettings(waRes && typeof waRes === 'object' ? waRes : null);
    } catch (err) {
      console.error('Failed to load initial SaaS data:', err);
      toast('error','Não foi possível atualizar o painel',(err as Error).message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!token) { if (!cancelled) setAuthChecking(false); return; }
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('SESSION_INVALID');
        const data = await readJson<{user: AuthUser}>(res);
        if (!cancelled) setUser(data.user);
      } catch {
        localStorage.removeItem('whatsappafiliado_token');
        if (!cancelled) { setToken(null); setUser(null); }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (token && user) void loadData();
  }, [token, user]);

  useEffect(() => {
    if (!user || firstRunRedirected || whatsappSettings === null) return;
    const whatsappConfigured = whatsappSettings?.provider === 'evolution'
      ? Boolean(whatsappSettings?.evolutionApiUrl && whatsappSettings?.evolutionApiKey === 'configured' && whatsappSettings?.evolutionInstance)
      : Boolean(whatsappSettings?.provider);
    if (!whatsappConfigured) {
      setActiveTab('setup');
      setFirstRunRedirected(true);
    }
  }, [user, whatsappSettings, firstRunRedirected]);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      if (authMode === 'register') {
        const registerRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword }),
        });
        const registerData = await readJson(registerRes);
        if (!registerRes.ok) throw new Error(registerData.error || 'Não foi possível criar a conta.');
      }
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const loginData = await readJson<{token?: string; user?: AuthUser; error?: string}>(loginRes);
      if (!loginRes.ok || !loginData.token || !loginData.user) throw new Error(loginData.error || 'Credenciais inválidas.');
      localStorage.setItem('whatsappafiliado_token', loginData.token);
      setToken(loginData.token);
      setUser(loginData.user);
      setAuthPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível autenticar.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRunTests = async () => {
    setIsTestingSuite(true);
    try {
      const res = await apiFetch('/api/tests/run');
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Falha ao executar testes');
      setTestResults(data);
    } catch (err) {
      toast('error', 'Falha ao executar testes', (err as Error).message);
    } finally { setIsTestingSuite(false); }
  };

  const handleSaveWhatsApp = async (settings: any) => {
    const res = await apiFetch('/api/whatsapp/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(settings) });
    const data=await readJson(res); if(!res.ok) throw new Error(data.error||'Erro ao salvar WhatsApp');
    setWhatsappSettings({...whatsappSettings,...settings});
  };

  const handleSaveAccount = async (accountId: string, credentials: Record<string, string>) => {
    const res = await apiFetch(`/api/accounts/${accountId}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ credentials }) });
    if (!res.ok) { const err=await readJson(res); throw new Error(err.error||'Erro ao salvar credenciais'); }
    await loadData();
  };

  const handleTestIntegration = async (marketplace: 'SHOPEE'): Promise<IntegrationTestResult> => {
    const res = await apiFetch(`/api/test-integration/${marketplace}`, { method:'POST' });
    if (!res.ok) { const err=await readJson(res); throw new Error(err.error||'Erro no diagnóstico'); }
    return readJson(res);
  };

  const handleLiveSearch = async (params: { marketplace: MarketplaceType; keyword: string; category?: string }) => {
    const res = await apiFetch('/api/offers/search-live', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(params) });
    if (!res.ok) { const err=await readJson(res); throw new Error(err.error||'Erro na busca ao vivo'); }
    await loadData();
  };

  const handleManualMercadoLivre = async (payload: { originalUrl: string; title?: string; price: number }) => {
    const res = await apiFetch('/api/offers/manual-mercadolivre', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Não foi possível adicionar a oferta.');
    await loadData();
  };

  const handleAssociateMLLink = async (offerId: string, affiliateUrl: string) => {
    const res = await apiFetch(`/api/offers/${offerId}/associate-ml-link`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ affiliateUrl }) });
    if (!res.ok) { const err=await readJson(res); throw new Error(err.error||'Erro ao associar link'); }
    await loadData();
  };

  const handleGenerateAiMessage = async (offerId: string, destinationId?: string): Promise<string> => {
    const res = await apiFetch(`/api/offers/${offerId}/generate-ai-message`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ destinationId }) });
    if (!res.ok) { const err=await readJson(res); throw new Error(err.error||'Erro ao gerar mensagem'); }
    const data = await readJson<{message:string; aiUsed?:boolean; aiFallback?:boolean; warning?:string}>(res);
    if (data.aiFallback) toast('info', 'Mensagem gerada sem IA', data.warning || 'Foi usado o modelo determinístico para manter a publicação segura.');
    await loadData();
    return data.message;
  };

  const handlePublish = async (offerId: string, destinationId: string) => {
    const res = await apiFetch(`/api/offers/${offerId}/publish`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ destinationId }) });
    const data = await readJson<{aiFallback?:boolean; warning?:string}>(res);
    if (!res.ok) throw new Error((data as any).error || 'Erro na publicação');
    if (data.aiFallback) toast('info', 'Publicação criada com mensagem padrão', data.warning || 'A IA não estava disponível; a mensagem determinística foi usada.');
    await loadData();
  };

  const handleDeleteOffer = async (offerId: string) => {
    const res = await apiFetch('/api/offers/' + encodeURIComponent(offerId), { method:'DELETE' });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Não foi possível excluir a oferta.');
    await loadData();
  };

  const handleTriggerSend = async (publicationId: string) => {
    const res = await apiFetch('/api/publications/' + encodeURIComponent(publicationId) + '/send', { method:'POST' });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Não foi possível enviar a publicação agora.');
    await loadData();
  };

  const handleDeletePublication = async (publicationId: string) => {
    const res = await apiFetch('/api/publications/' + encodeURIComponent(publicationId), { method:'DELETE' });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Não foi possível excluir o registro.');
    await loadData();
  };

  const handleRetryPublication = async (publicationId: string) => {
    const res = await apiFetch('/api/publications/' + encodeURIComponent(publicationId) + '/retry', { method:'POST' });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'Não foi possível reenviar.');
    await loadData();
  };

  const handleAddDestination = async (dest: Partial<Destination>) => {
    const res = await apiFetch('/api/destinations', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dest) });
    if (!res.ok) { const err=await readJson(res); throw new Error(err.error||'Erro ao criar destino'); }
    await loadData();
  };

  if (authChecking) {
    return <div className="min-h-screen bg-bg text-text flex items-center justify-center"><div className="text-sm text-muted">Verificando sessão...</div></div>;
  }

  if (!token || !user) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4 py-8">
        <form onSubmit={handleAuth} className="w-full max-w-md bg-surface-1 border border-border rounded-xl p-8 shadow-card">
          <div className="text-center mb-7">
            <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-bg font-bold">WA</div>
            <h1 className="text-2xl font-bold text-text">Afiliados WhatsApp <span className="text-emerald-400">Pro</span></h1>
            <p className="text-sm text-muted mt-1">{authMode === 'login' ? 'Entre para acessar seu painel.' : 'Crie sua conta para começar.'}</p>
          </div>
          <label className="block text-xs font-medium text-text mb-2">E-mail</label>
          <input value={authEmail} onChange={(e)=>setAuthEmail(e.target.value)} type="email" required autoComplete="email" className="w-full mb-4 px-3 py-2.5 rounded-lg bg-surface-2 border border-border-strong text-text outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10" />
          <label className="block text-xs font-medium text-text mb-2">Senha</label>
          <input value={authPassword} onChange={(e)=>setAuthPassword(e.target.value)} type="password" required minLength={10} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} className="w-full mb-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-border-strong text-text outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10" />
          {authError && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{authError}</div>}
          <button disabled={authBusy} className="w-full min-h-11 rounded-md bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-bg font-semibold transition-colors focus-visible:ring-4 focus-visible:ring-brand-500/20 outline-none">{authBusy ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Criar conta'}</button>
          <button type="button" onClick={()=>{setAuthMode(authMode === 'login' ? 'register' : 'login');setAuthError('');}} className="w-full mt-3 text-sm text-emerald-400 hover:text-emerald-300">
            {authMode === 'login' ? 'Ainda não tenho conta — criar agora' : 'Já tenho uma conta — entrar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-brand-500 selection:text-bg">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onRunTests={handleRunTests} isTestingSuite={isTestingSuite} onLogout={logout} />
      <main className="flex-1 w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-8"><div className="animate-page-in">
        {activeTab === 'setup' && <SetupTab apiFetch={apiFetch} whatsappSettings={whatsappSettings} onSaveWhatsApp={handleSaveWhatsApp} onNavigate={setActiveTab} />}
        {activeTab === 'dashboard' && <DashboardTab reports={reports} accounts={accounts} whatsappSettings={whatsappSettings} apiFetch={apiFetch} onNavigateToOffers={()=>setActiveTab('offers')} onNavigateToAffiliates={()=>setActiveTab('affiliates')} onNavigateToSetup={()=>setActiveTab('setup')} onNavigateToQueue={()=>setActiveTab('queue')} />}
        {activeTab === 'affiliates' && <AffiliatesTab apiFetch={apiFetch} accounts={accounts} onSaveAccount={handleSaveAccount} onTestIntegration={handleTestIntegration} whatsappSettings={whatsappSettings} onSaveWhatsApp={handleSaveWhatsApp} />}
        {activeTab === 'offers' && <OffersTab offers={offers} destinations={destinations} onLiveSearch={handleLiveSearch} onManualAddMercadoLivre={handleManualMercadoLivre} onOpenAssociateModal={(offer)=>setAssociateModalOffer(offer)} onOpenAiMessageModal={(offer)=>setAiModalOffer(offer)} onQuickPublish={handlePublish} onDeleteOffer={handleDeleteOffer} />}
        {activeTab === 'destinations' && <DestinationsTab destinations={destinations} onAddDestination={handleAddDestination} apiFetch={apiFetch} />}
        {activeTab === 'queue' && <PublicationsTab publications={publications} onTriggerSend={handleTriggerSend} onDelete={handleDeletePublication} onRetry={handleRetryPublication} />}
        {activeTab === 'audit' && <AuditTab records={auditRecords} />}
        {activeTab === 'docs' && <DocsTab onRunTests={handleRunTests} testResults={testResults} isRunningTests={isTestingSuite} />}
      </div></main>
      <AssociateLinkModal offer={associateModalOffer} onClose={()=>setAssociateModalOffer(null)} onAssociate={handleAssociateMLLink} />
      <AiMessageModal offer={aiModalOffer} destinations={destinations} onClose={()=>setAiModalOffer(null)} onGenerateMessage={handleGenerateAiMessage} onPublish={handlePublish} />
    </div>
  );
}

export function App() { return <ToastProvider><AppContent /></ToastProvider>; }
export default App;
