import React, { useState } from 'react';
import { useToast } from './ui/Toast.tsx';
import {
  Search,
  Filter,
  Sparkles,
  Send,
  Link2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Offer, Destination, MarketplaceType } from '../types/affiliate.ts';

interface OffersTabProps {
  offers: Offer[];
  destinations: Destination[];
  onLiveSearch: (params: {
    marketplace: MarketplaceType;
    keyword: string;
    category?: string;
  }) => Promise<void>;
  onManualAddMercadoLivre: (payload: { originalUrl: string; title?: string; price: number }) => Promise<void>;
  onOpenAssociateModal: (offer: Offer) => void;
  onOpenAiMessageModal: (offer: Offer) => void;
  onQuickPublish: (offerId: string, destinationId: string) => Promise<void>;
  onDeleteOffer: (offerId: string) => Promise<void>;
}

export const OffersTab: React.FC<OffersTabProps> = ({
  offers,
  destinations,
  onLiveSearch,
  onManualAddMercadoLivre,
  onOpenAssociateModal,
  onOpenAiMessageModal,
  onQuickPublish,
  onDeleteOffer,
}) => {
  const toast = useToast();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [initialLoading,setInitialLoading]=useState(true);
  React.useEffect(()=>{const t=window.setTimeout(()=>setInitialLoading(false),300);return()=>window.clearTimeout(t)},[]);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<{type:'idle'|'loading'|'success'|'error'; message:string}>({type:'idle', message:''});
  const [liveSearchMarketplace, setLiveSearchMarketplace] = useState<MarketplaceType>('SHOPEE');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [mlUrl, setMlUrl] = useState('');
  const [mlTitle, setMlTitle] = useState('');
  const [mlPrice, setMlPrice] = useState('');
  const [mlBusy, setMlBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter offers locally
  const filteredOffers = offers.filter((offer) => {
    if (selectedMarketplace !== 'ALL' && offer.marketplace !== selectedMarketplace) return false;
    if (selectedStatus !== 'ALL' && offer.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = offer.product.title.toLowerCase().includes(q);
      const matchId = offer.product.external_product_id.toLowerCase().includes(q);
      if (!matchTitle && !matchId) return false;
    }
    return true;
  });

  const handleLiveSearchTrigger = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const keyword = searchQuery.trim();
    if (!keyword) {
      setSearchFeedback({type:'error', message:'Digite um produto ou palavra-chave antes de buscar.'});
      return;
    }
    if (isSearchingLive) return;
    setIsSearchingLive(true);
    setSearchFeedback({type:'loading', message: liveSearchMarketplace === 'MERCADOLIVRE' ? 'Iniciando busca automática no Mercado Livre…' : 'Iniciando busca automática na Shopee…'});
    try {
      await onLiveSearch({ marketplace: liveSearchMarketplace, keyword });
      setSearchFeedback({type:'success', message:'Busca concluída. As novas ofertas foram adicionadas ao pipeline.'});
    } catch (err) {
      setSearchFeedback({type:'error', message: err instanceof Error ? err.message : 'Não foi possível executar a busca.'});
    } finally {
      setIsSearchingLive(false);
    }
  };


  const handleAddMercadoLivre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mlUrl.trim()) return;
    setMlBusy(true);
    try {
      await onManualAddMercadoLivre({ originalUrl: mlUrl.trim(), title: mlTitle.trim(), price: mlPrice ? Number(mlPrice) : 0 });
      setMlUrl(''); setMlTitle(''); setMlPrice('');
      toast('success','Oferta adicionada','A oferta foi inserida no pipeline e a lista foi atualizada.');
    } catch (err) { toast('error','Não foi possível adicionar a oferta',(err as Error).message); } finally { setMlBusy(false); }
  };

  const handleDeleteOffer = async (offer: Offer) => {
    if (confirmDeleteId !== offer.id) { setConfirmDeleteId(offer.id); return; }
    setConfirmDeleteId(null);
    setDeletingId(offer.id);
    try { await onDeleteOffer(offer.id); }
    catch (err) { toast('error','Não foi possível excluir a oferta',(err as Error).message); }
    finally { setDeletingId(null); }
  };

  const handlePublishClick = async (offer: Offer) => {
    if (offer.status !== 'AFFILIATE_LINK_READY' && offer.status !== 'READY_TO_PUBLISH') {
      toast('error','Publicação bloqueada',`A oferta está no status '${offer.status}'. Apenas produtos com link de afiliado oficial validado podem ser publicados.`);
      return;
    }

    const destId = destinations[0]?.id || 'dest_pokemon';
    setPublishingId(offer.id);
    try {
      await onQuickPublish(offer.id, destId);
      toast('success','Oferta publicada','A mensagem foi adicionada à fila do WhatsApp.');
    } catch (err) {
      toast('error','Falha no envio',(err as Error).message);
    } finally {
      setPublishingId(null);
    }
  };

  if(initialLoading) return <div className="space-y-6" aria-busy="true"><div className="h-36 rounded-lg bg-surface-1 animate-pulse"/><div className="grid gap-4 md:grid-cols-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-56 rounded-lg bg-surface-1 animate-pulse"/>)}</div></div>;

  return (
    <div className="space-y-6">
      {/* Top Filter & Live Search Toolbar */}
      <div className="bg-surface-1 border border-border rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text tracking-tight">Radar & Pipeline de Ofertas</h2>
            <p className="text-sm text-muted">
              Busca automática por navegador no Mercado Livre e API na Shopee, com geração de afiliado e validação
            </p>
          </div>

          {/* Live Search Bar connecting directly to Shopee or Mercado Livre */}
          <form onSubmit={handleLiveSearchTrigger} className="flex items-center gap-2">
            <select
              value={liveSearchMarketplace}
              onChange={(e) => setLiveSearchMarketplace(e.target.value as MarketplaceType)}
              className="bg-surface-2 border border-border-strong text-sm font-semibold text-text rounded-md px-3 py-2 focus:outline-none focus:border-brand-500"
            >
              <option value="SHOPEE">Shopee Open API</option>
              <option value="MERCADOLIVRE">Mercado Livre automatizado</option>
              
            </select>

            <div className="relative">
              <input
                id="input-live-search"
                type="text"
                placeholder="Buscar produto (ex: Pokémon, SSD)..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (searchFeedback.type === 'error') setSearchFeedback({type:'idle', message:''}); }}
                className="bg-surface-2 border border-border-strong rounded-md pl-9 pr-4 py-2 text-sm text-text placeholder-slate-500 focus:outline-none focus:border-brand-500 w-full sm:w-64"
              />
              <Search className="w-4 h-4 text-subtle absolute left-3 top-2.5" />
            </div>

            <button
              id="btn-trigger-live-search"
              type="button"
              onClick={() => void handleLiveSearchTrigger()}
              disabled={isSearchingLive}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-bg font-bold text-sm rounded-md transition cursor-pointer disabled:opacity-50"
            >
              {isSearchingLive ? 'Buscando…' : 'Buscar automaticamente'}
            </button>
          </form>
        </div>

        {searchFeedback.type !== 'idle' && (
          <div role="status" aria-live="polite" className={
            searchFeedback.type === 'loading'
              ? 'rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-200'
              : searchFeedback.type === 'success'
                ? 'rounded-md border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-sm text-emerald-200'
                : 'rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200'
          }>{searchFeedback.message}</div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border text-sm">
          <span className="text-muted font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>

          {/* Marketplace filter */}
          <div className="flex items-center bg-surface-2 rounded-md p-1 border border-border-strong">
            {['ALL', 'SHOPEE', 'MERCADOLIVRE'].map((mp) => (
              <button
                key={mp}
                id={`filter-mp-${mp.toLowerCase()}`}
                onClick={() => setSelectedMarketplace(mp)}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedMarketplace === mp
                    ? 'bg-brand-500 text-bg font-bold'
                    : 'text-muted hover:text-text'
                }`}
              >
                {mp === 'ALL' ? 'Todos' : mp === 'SHOPEE' ? 'Shopee' : 'Mercado Livre'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap items-center bg-surface-2 rounded-md p-1 border border-border-strong">
            {['ALL', 'VALIDATED', 'AFFILIATE_LINK_READY', 'PUBLISHED'].map((st) => (
              <button
                key={st}
                id={`filter-st-${st.toLowerCase()}`}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                  selectedStatus === st
                    ? 'bg-surface-3 border-border-strong text-text font-bold'
                    : 'text-muted hover:text-text'
                }`}
              >
                {st === 'ALL'
                  ? 'Todos os Status'
                  : st === 'VALIDATED'
                  ? 'Pendente Link Oficial'
                  : st === 'AFFILIATE_LINK_READY'
                  ? 'Link Validado (Pronto)'
                  : 'Publicados'}
              </button>
            ))}
          </div>

          <span className="text-subtle ml-auto font-medium">
            Exibindo {filteredOffers.length} ofertas
          </span>
        </div>
      </div>


      <div className="bg-surface-1 border border-brand-500/20 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1"><h3 className="text-sm font-bold text-text">Mercado Livre — fallback manual</h3><p className="text-sm text-muted mt-1">Use apenas se a automação do navegador estiver temporariamente indisponível. O fluxo normal gera e vincula o link automaticamente.</p></div>
          <form onSubmit={handleAddMercadoLivre} className="flex flex-wrap gap-2 lg:max-w-3xl lg:flex-1">
            <input value={mlUrl} onChange={e=>setMlUrl(e.target.value)} placeholder="https://www.mercadolivre.com.br/..." className="flex-1 min-w-[280px] bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text" required />
            <input value={mlTitle} onChange={e=>setMlTitle(e.target.value)} placeholder="Nome (opcional)" className="w-44 bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text" />
            <input value={mlPrice} onChange={e=>setMlPrice(e.target.value)} placeholder="Preço" type="number" min="0" step="0.01" className="w-28 bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text" />
            <button disabled={mlBusy} className="px-4 py-2 bg-brand-500 text-bg font-bold text-sm rounded-md disabled:opacity-50"><Plus className="w-3.5 h-3.5 inline mr-1"/>{mlBusy?'Adicionando...':'Adicionar oferta'}</button>
          </form>
        </div>
      </div>

      {/* Offer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOffers.map((offer) => {
          const isShopee = offer.marketplace === 'SHOPEE';
          const isReady = offer.status === 'AFFILIATE_LINK_READY' || offer.status === 'READY_TO_PUBLISH';
          const isPublished = offer.status === 'PUBLISHED';
          const needsLinkAssociation = false;

          return (
            <div
              key={offer.id}
              className={`bg-surface-1 rounded-lg border transition shadow-sm overflow-hidden flex flex-col justify-between ${
                isPublished
                  ? 'border-border opacity-90'
                  : isReady
                  ? 'border-brand-500/40 hover:border-brand-500/70'
                  : 'border-yellow-500/40 hover:border-yellow-500/70'
              }`}
            >
              {/* Card Header & Product Image */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isShopee
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                    }`}
                  >
                    {isShopee ? 'Shopee BR' : 'Mercado Livre'}
                  </span>

                  {/* Status Badge */}
                  {isReady ? (
                    <span className="text-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Link Validado
                    </span>
                  ) : isPublished ? (
                    <span className="text-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Publicado
                    </span>
                  ) : (
                    <span className="text-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pendente Link Oficial
                    </span>
                  )}
                </div>

                {/* Product Snapshot */}
                <div className="flex gap-3">
                  <img
                    src={offer.product.image}
                    alt={offer.product.title}
                    className="w-20 h-20 object-cover rounded-md shrink-0 bg-surface-2 border border-border-strong"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-text line-clamp-2 leading-snug">
                      {offer.product.title}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-base font-extrabold text-text">
                        R$ {offer.price.toFixed(2).replace('.', ',')}
                      </span>
                      {offer.original_price && offer.original_price > offer.price && (
                        <span className="text-xs text-subtle line-through">
                          R$ {offer.original_price.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>

                    {offer.discount && (
                      <span className="inline-flex items-center gap-0.5 text-sm font-bold text-brand-300 bg-brand-500/10 px-1.5 py-0.2 rounded mt-0.5">
                        <TrendingDown className="w-3 h-3" /> {offer.discount}% OFF
                      </span>
                    )}
                  </div>
                </div>

                {/* Links Inspection Section */}
                <div className="bg-surface-2 rounded-md p-3 border border-border text-sm space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-muted">
                    <span>URL Original:</span>
                    <a
                      href={offer.product.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text hover:text-text flex items-center gap-1 underline truncate max-w-[150px]"
                    >
                      Ver anúncio <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-muted">
                    <span>Link Afiliado:</span>
                    {offer.affiliate_url ? (
                      <a
                        href={offer.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-300 font-bold hover:underline truncate max-w-[160px]"
                      >
                        {offer.affiliate_url}
                      </a>
                    ) : (
                      <span className="text-yellow-400 font-sans italic">
                        Ação necessária
                      </span>
                    )}
                  </div>
                </div>

                {/* Status reason notice if pending */}
                {offer.marketplace === 'MERCADOLIVRE' && !offer.affiliate_url && (
                  <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300 flex items-start gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>{offer.status_reason || 'A geração automática do link oficial está em processamento. O sistema tentará novamente antes de publicar.'}</span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 pt-0 border-t border-border/80 mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {/* If ML needs link association */}
                  {offer.marketplace === 'MERCADOLIVRE' && !isReady && (
                    <div className="col-span-2 py-2 text-center text-sm text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-md">
                      {offer.status_reason || 'Aguardando geração e validação do link oficial…'}
                    </div>
                  )}
                  {(

                    <>
                      <button
                        id={`btn-open-ai-modal-${offer.id}`}
                        onClick={() => onOpenAiMessageModal(offer)}
                        className="py-2 bg-surface-2 hover:bg-surface-3 border-border-strong text-text font-medium text-sm rounded-md border border-border-strong transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-brand-300" />
                        Mensagem IA
                      </button>

                      <button
                        id={`btn-quick-publish-${offer.id}`}
                        onClick={() => handlePublishClick(offer)}
                        disabled={!isReady || publishingId === offer.id}
                        className="py-2 bg-brand-500 hover:bg-brand-400 text-bg font-bold text-sm rounded-md transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {publishingId === offer.id ? 'Enviando...' : isPublished ? 'Reenviar' : 'Publicar'}
                      </button>
                    </>
                  )}
                <button
                  type="button"
                  onClick={() => void handleDeleteOffer(offer)}
                  disabled={deletingId === offer.id}
                  className="col-span-2 py-2 rounded-md border border-rose-500/20 bg-rose-500/5 text-rose-300 text-sm font-semibold hover:bg-rose-500/10 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                  {deletingId === offer.id ? 'Excluindo...' : 'Excluir oferta capturada'}
                </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOffers.length === 0 && (
        <div className="bg-surface-1 border border-border rounded-lg p-12 text-center text-muted space-y-3">
          <AlertCircle className="w-8 h-8 text-subtle mx-auto" />
          <h3 className="text-base font-semibold text-text">Nenhuma oferta localizada com os filtros atuais</h3>
          <p className="text-xs text-subtle max-w-sm mx-auto">
            Use a busca automática para descobrir produtos e gerar links de afiliado. O Mercado Livre usa a sessão conectada no navegador.
          </p>
        </div>
      )}
    </div>
  );
};
