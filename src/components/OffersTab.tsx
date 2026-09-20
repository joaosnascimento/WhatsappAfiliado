import React, { useState } from 'react';
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
  onOpenAssociateModal: (offer: Offer) => void;
  onOpenAiMessageModal: (offer: Offer) => void;
  onQuickPublish: (offerId: string, destinationId: string) => Promise<void>;
}

export const OffersTab: React.FC<OffersTabProps> = ({
  offers,
  destinations,
  onLiveSearch,
  onOpenAssociateModal,
  onOpenAiMessageModal,
  onQuickPublish,
}) => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [liveSearchMarketplace, setLiveSearchMarketplace] = useState<MarketplaceType>('SHOPEE');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [mlUrl, setMlUrl] = useState('');
  const [mlTitle, setMlTitle] = useState('');
  const [mlPrice, setMlPrice] = useState('');
  const [mlBusy, setMlBusy] = useState(false);

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

  const handleLiveSearchTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingLive(true);
    try {
      await onLiveSearch({
        marketplace: liveSearchMarketplace,
        keyword: searchQuery,
      });
    } catch (err) {
      alert(`Falha na busca em tempo real: ${(err as Error).message}`);
    } finally {
      setIsSearchingLive(false);
    }
  };


  const handleAddMercadoLivre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mlUrl.trim()) return;
    setMlBusy(true);
    try {
      const res = await fetch('/api/offers/manual-mercadolivre', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ originalUrl:mlUrl.trim(), title:mlTitle.trim(), price:mlPrice ? Number(mlPrice) : 0 }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível adicionar a oferta.');
      setMlUrl(''); setMlTitle(''); setMlPrice('');
      window.location.reload();
    } catch (err) { alert((err as Error).message); } finally { setMlBusy(false); }
  };

  const handlePublishClick = async (offer: Offer) => {
    if (offer.status !== 'AFFILIATE_LINK_READY' && offer.status !== 'READY_TO_PUBLISH') {
      alert(
        `Bloqueio de Segurança: A oferta está no status '${offer.status}'. Conforme a Regra 17, apenas produtos com link de afiliado oficial validado podem ser publicados.`
      );
      return;
    }

    const destId = destinations[0]?.id || 'dest_pokemon';
    setPublishingId(offer.id);
    try {
      await onQuickPublish(offer.id, destId);
      alert('Publicado com sucesso no WhatsApp!');
    } catch (err) {
      alert(`Erro no envio: ${(err as Error).message}`);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Live Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Radar & Pipeline de Ofertas</h2>
            <p className="text-xs text-slate-400">
              Busca em tempo real nas APIs de catálogo e validação estrita de atribuição
            </p>
          </div>

          {/* Live Search Bar connecting directly to Shopee or Mercado Livre */}
          <form onSubmit={handleLiveSearchTrigger} className="flex items-center gap-2">
            <select
              value={liveSearchMarketplace}
              onChange={(e) => setLiveSearchMarketplace(e.target.value as MarketplaceType)}
              className="bg-slate-800 border border-slate-700 text-xs font-semibold text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="SHOPEE">Shopee Open API</option>
              
            </select>

            <div className="relative">
              <input
                id="input-live-search"
                type="text"
                placeholder="Buscar produto (ex: Pokémon, SSD)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>

            <button
              id="btn-trigger-live-search"
              type="submit"
              disabled={isSearchingLive}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {isSearchingLive ? 'Buscando API...' : 'Buscar na API'}
            </button>
          </form>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>

          {/* Marketplace filter */}
          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            {['ALL', 'SHOPEE', 'MERCADOLIVRE'].map((mp) => (
              <button
                key={mp}
                id={`filter-mp-${mp.toLowerCase()}`}
                onClick={() => setSelectedMarketplace(mp)}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedMarketplace === mp
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mp === 'ALL' ? 'Todos' : mp === 'SHOPEE' ? 'Shopee' : 'Mercado Livre'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            {['ALL', 'VALIDATED', 'AFFILIATE_LINK_READY', 'PUBLISHED'].map((st) => (
              <button
                key={st}
                id={`filter-st-${st.toLowerCase()}`}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                  selectedStatus === st
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
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

          <span className="text-slate-500 ml-auto font-medium">
            Exibindo {filteredOffers.length} ofertas
          </span>
        </div>
      </div>


      <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1"><h3 className="text-sm font-bold text-white">Mercado Livre — adicionar oferta</h3><p className="text-xs text-slate-400 mt-1">Cole o link do anúncio. Depois use <b className="text-emerald-400">Gerar / Associar Link de Afiliado</b> para vincular o link oficial.</p></div>
          <form onSubmit={handleAddMercadoLivre} className="flex flex-wrap gap-2 lg:max-w-3xl lg:flex-1">
            <input value={mlUrl} onChange={e=>setMlUrl(e.target.value)} placeholder="https://www.mercadolivre.com.br/..." className="flex-1 min-w-[280px] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" required />
            <input value={mlTitle} onChange={e=>setMlTitle(e.target.value)} placeholder="Nome (opcional)" className="w-44 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            <input value={mlPrice} onChange={e=>setMlPrice(e.target.value)} placeholder="Preço" type="number" min="0" step="0.01" className="w-28 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
            <button disabled={mlBusy} className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50"><Plus className="w-3.5 h-3.5 inline mr-1"/>{mlBusy?'Adicionando...':'Adicionar oferta'}</button>
          </form>
        </div>
      </div>

      {/* Offer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredOffers.map((offer) => {
          const isShopee = offer.marketplace === 'SHOPEE';
          const isReady = offer.status === 'AFFILIATE_LINK_READY' || offer.status === 'READY_TO_PUBLISH';
          const isPublished = offer.status === 'PUBLISHED';
          const needsLinkAssociation = offer.marketplace === 'MERCADOLIVRE' && !offer.affiliate_url;

          return (
            <div
              key={offer.id}
              className={`bg-slate-900 rounded-2xl border transition shadow-sm overflow-hidden flex flex-col justify-between ${
                isPublished
                  ? 'border-slate-800 opacity-90'
                  : isReady
                  ? 'border-emerald-500/40 hover:border-emerald-500/70'
                  : 'border-yellow-500/40 hover:border-yellow-500/70'
              }`}
            >
              {/* Card Header & Product Image */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isShopee
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                    }`}
                  >
                    {isShopee ? 'Shopee BR' : 'Mercado Livre'}
                  </span>

                  {/* Status Badge */}
                  {isReady ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Link Validado
                    </span>
                  ) : isPublished ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Publicado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pendente Link Oficial
                    </span>
                  )}
                </div>

                {/* Product Snapshot */}
                <div className="flex gap-3">
                  <img
                    src={offer.product.image}
                    alt={offer.product.title}
                    className="w-20 h-20 object-cover rounded-xl shrink-0 bg-slate-800 border border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                      {offer.product.title}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-base font-extrabold text-white">
                        R$ {offer.price.toFixed(2).replace('.', ',')}
                      </span>
                      {offer.original_price && offer.original_price > offer.price && (
                        <span className="text-xs text-slate-500 line-through">
                          R$ {offer.original_price.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>

                    {offer.discount && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded mt-0.5">
                        <TrendingDown className="w-3 h-3" /> {offer.discount}% OFF
                      </span>
                    )}
                  </div>
                </div>

                {/* Links Inspection Section */}
                <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-800 text-[11px] space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>URL Original:</span>
                    <a
                      href={offer.product.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-300 hover:text-white flex items-center gap-1 underline truncate max-w-[150px]"
                    >
                      Ver anúncio <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span>Link Afiliado:</span>
                    {offer.affiliate_url ? (
                      <a
                        href={offer.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 font-bold hover:underline truncate max-w-[160px]"
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
                {needsLinkAssociation && (
                  <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-[11px] text-yellow-300 flex items-start gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                    <span>
                      Regra 4: A API pública não gera link rastreado. Vincule o link oficial do portal (<code className="text-amber-200">meli.la</code>) para publicar.
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 pt-0 border-t border-slate-800/80 mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {/* If ML needs link association */}
                  {needsLinkAssociation ? (
                    <button
                      id={`btn-associate-link-${offer.id}`}
                      onClick={() => onOpenAssociateModal(offer)}
                      className="col-span-2 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Gerar / Associar Link de Afiliado
                    </button>
                  ) : (
                    <>
                      <button
                        id={`btn-open-ai-modal-${offer.id}`}
                        onClick={() => onOpenAiMessageModal(offer)}
                        className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Mensagem IA
                      </button>

                      <button
                        id={`btn-quick-publish-${offer.id}`}
                        onClick={() => handlePublishClick(offer)}
                        disabled={!isReady || publishingId === offer.id}
                        className="py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {publishingId === offer.id ? 'Enviando...' : isPublished ? 'Reenviar' : 'Publicar'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOffers.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-white">Nenhuma oferta localizada com os filtros atuais</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Use a barra de busca acima para consultar o catálogo em tempo real da Shopee Open API ou do Mercado Livre Brasil.
          </p>
        </div>
      )}
    </div>
  );
};
