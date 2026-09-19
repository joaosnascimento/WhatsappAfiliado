import React from 'react';
import { Share2, CheckCircle2, AlertCircle, ShieldCheck, Zap } from 'lucide-react';
import type { MarketplaceAccount } from '../types/affiliate.ts';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accounts: MarketplaceAccount[];
  onRunTests: () => void;
  isTestingSuite: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  accounts,
  onRunTests,
  isTestingSuite,
}) => {
  const shopeeAcc = accounts.find((a) => a.marketplace === 'SHOPEE');
  const mlAcc = accounts.find((a) => a.marketplace === 'MERCADOLIVRE');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'affiliates', label: 'Afiliados & APIs' },
    { id: 'offers', label: 'Radar de Ofertas' },
    { id: 'destinations', label: 'Destinos WhatsApp' },
    { id: 'queue', label: 'Fila WhatsApp' },
    { id: 'audit', label: 'Auditoria' },
    { id: 'docs', label: 'Documentação & Testes' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
              <Share2 className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg tracking-tight text-white">
                  Afiliados WhatsApp <span className="text-emerald-400">Pro</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  SaaS Real
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Mercado Livre Brasil &bull; Shopee Open API &bull; IA Gemini
              </p>
            </div>
          </div>

          {/* Quick status indicators */}
          <div className="hidden md:flex items-center gap-3">
            {/* ML Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              <span className="text-slate-300 font-medium">Mercado Livre:</span>
              <span className={mlAcc?.status === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-400'}>
                {mlAcc?.status === 'CONNECTED' ? 'Conectado' : 'Configurado (MLB)'}
              </span>
            </div>

            {/* Shopee Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              <span className="text-slate-300 font-medium">Shopee BR:</span>
              <span className={shopeeAcc?.status === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-400'}>
                {shopeeAcc?.status === 'CONNECTED' ? 'Open API Ativa' : 'Pronto p/ API'}
              </span>
            </div>

            {/* Test Suite Button */}
            <button
              id="header-btn-run-tests"
              onClick={onRunTests}
              disabled={isTestingSuite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-medium transition cursor-pointer disabled:opacity-50"
              title="Executa suíte de testes unitários reais"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {isTestingSuite ? 'Executando...' : 'Suíte de Testes'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
