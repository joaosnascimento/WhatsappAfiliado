import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { DashboardTab } from './components/DashboardTab.tsx';
import { AffiliatesTab } from './components/AffiliatesTab.tsx';
import { OffersTab } from './components/OffersTab.tsx';
import { DestinationsTab } from './components/DestinationsTab.tsx';
import { PublicationsTab } from './components/PublicationsTab.tsx';
import { AuditTab } from './components/AuditTab.tsx';
import { DocsTab } from './components/DocsTab.tsx';
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

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [whatsappSettings, setWhatsappSettings] = useState<any>(null);

  // Modals
  const [associateModalOffer, setAssociateModalOffer] = useState<Offer | null>(null);
  const [aiModalOffer, setAiModalOffer] = useState<Offer | null>(null);

  // Unit tests
  const [isTestingSuite, setIsTestingSuite] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // Initial data loader
  const loadData = async () => {
    try {
      const [accRes, offRes, destRes, pubRes, repRes, audRes, waRes] = await Promise.all([
        fetch('/api/accounts').then((r) => r.json()),
        fetch('/api/offers').then((r) => r.json()),
        fetch('/api/destinations').then((r) => r.json()),
        fetch('/api/publications').then((r) => r.json()),
        fetch('/api/reports').then((r) => r.json()),
        fetch('/api/audit').then((r) => r.json()),
        fetch('/api/whatsapp/settings').then((r) => r.json()),
      ]);

      setAccounts(accRes || []);
      setOffers(offRes || []);
      setDestinations(destRes || []);
      setPublications(pubRes || []);
      setReports(repRes || null);
      setAuditRecords(audRes || []);
      setWhatsappSettings(waRes || null);
    } catch (err) {
      console.error('Failed to load initial SaaS data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handler: Run Unit Tests
  const handleRunTests = async () => {
    setIsTestingSuite(true);
    try {
      const res = await fetch('/api/tests/run');
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      alert(`Falha ao executar suíte de testes: ${(err as Error).message}`);
    } finally {
      setIsTestingSuite(false);
    }
  };

  // Handler: Save Account
  const handleSaveWhatsApp = async (settings: any) => {
    const res = await fetch('/api/whatsapp/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});
    const data=await res.json(); if(!res.ok) throw new Error(data.error||'Erro ao salvar WhatsApp');
    setWhatsappSettings({...whatsappSettings,...settings});
  };

  const handleSaveAccount = async (accountId: string, credentials: Record<string, string>) => {
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao salvar credenciais');
    }
    await loadData();
  };

  // Handler: Test Integration Diagnostic
  const handleTestIntegration = async (marketplace: 'SHOPEE' | 'MERCADOLIVRE'): Promise<IntegrationTestResult> => {
    const res = await fetch(`/api/test-integration/${marketplace}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro no diagnóstico');
    }
    return res.json();
  };

  // Handler: Connect Mercado Livre OAuth
  const handleConnectMercadoLivre = async () => {
    const res = await fetch('/api/auth/mercadolivre/url');
    const data = await res.json();
    if (data.url) {
      window.open(data.url, 'ml_oauth_popup', 'width=650,height=750');
    } else {
      alert('Não foi possível obter a URL de autorização do Mercado Livre.');
    }
  };

  // Handler: Live Search
  const handleLiveSearch = async (params: {
    marketplace: MarketplaceType;
    keyword: string;
    category?: string;
  }) => {
    const res = await fetch('/api/offers/search-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro na busca ao vivo');
    }
    await loadData();
  };

  // Handler: Associate ML Link
  const handleAssociateMLLink = async (offerId: string, affiliateUrl: string) => {
    const res = await fetch(`/api/offers/${offerId}/associate-ml-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliateUrl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao associar link');
    }
    await loadData();
  };

  // Handler: Generate AI Message
  const handleGenerateAiMessage = async (offerId: string, destinationId?: string): Promise<string> => {
    const res = await fetch(`/api/offers/${offerId}/generate-ai-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao gerar mensagem');
    }
    const data = await res.json();
    await loadData();
    return data.message;
  };

  // Handler: Publish
  const handlePublish = async (offerId: string, destinationId: string) => {
    const res = await fetch(`/api/offers/${offerId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro na publicação');
    }
    await loadData();
  };

  // Handler: Add Destination
  const handleAddDestination = async (dest: Partial<Destination>) => {
    const res = await fetch('/api/destinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dest),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao criar destino');
    }
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        accounts={accounts}
        onRunTests={handleRunTests}
        isTestingSuite={isTestingSuite}
      />

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardTab
            reports={reports}
            onNavigateToOffers={() => setActiveTab('offers')}
            onNavigateToAffiliates={() => setActiveTab('affiliates')}
          />
        )}

        {activeTab === 'affiliates' && (
          <AffiliatesTab
            accounts={accounts}
            onSaveAccount={handleSaveAccount}
            onTestIntegration={handleTestIntegration}
            onConnectMercadoLivre={handleConnectMercadoLivre}
            whatsappSettings={whatsappSettings}
            onSaveWhatsApp={handleSaveWhatsApp}
          />
        )}

        {activeTab === 'offers' && (
          <OffersTab
            offers={offers}
            destinations={destinations}
            onLiveSearch={handleLiveSearch}
            onOpenAssociateModal={(offer) => setAssociateModalOffer(offer)}
            onOpenAiMessageModal={(offer) => setAiModalOffer(offer)}
            onQuickPublish={handlePublish}
          />
        )}

        {activeTab === 'destinations' && (
          <DestinationsTab
            destinations={destinations}
            onAddDestination={handleAddDestination}
          />
        )}

        {activeTab === 'queue' && (
          <PublicationsTab
            publications={publications}
            onTriggerSend={async () => {}}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTab records={auditRecords} />
        )}

        {activeTab === 'docs' && (
          <DocsTab
            onRunTests={handleRunTests}
            testResults={testResults}
            isRunningTests={isTestingSuite}
          />
        )}
      </main>

      {/* Modals */}
      <AssociateLinkModal
        offer={associateModalOffer}
        onClose={() => setAssociateModalOffer(null)}
        onAssociate={handleAssociateMLLink}
      />

      <AiMessageModal
        offer={aiModalOffer}
        destinations={destinations}
        onClose={() => setAiModalOffer(null)}
        onGenerateMessage={handleGenerateAiMessage}
        onPublish={handlePublish}
      />
    </div>
  );
}

export default App;
