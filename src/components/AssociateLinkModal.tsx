import React, { useState } from 'react';
import { X, ShieldCheck, Link2, AlertCircle, CheckCircle2, ExternalLink, ClipboardPaste, Sparkles } from 'lucide-react';
import type { Offer } from '../types/affiliate.ts';

interface AssociateLinkModalProps {
  offer: Offer | null;
  onClose: () => void;
  onAssociate: (offerId: string, affiliateUrl: string) => Promise<void>;
}

export const AssociateLinkModal: React.FC<AssociateLinkModalProps> = ({
  offer,
  onClose,
  onAssociate,
}) => {
  if (!offer) return null;

  const [urlInput, setUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);

  const handlePasteClipboard = async () => {
    setErrorMsg(null);
    setIsReadingClipboard(true);
    try {
      if (!navigator.clipboard?.readText) throw new Error('O navegador não permite leitura automática da área de transferência.');
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) throw new Error('A área de transferência está vazia.');
      setUrlInput(text);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Não foi possível ler a área de transferência.');
    } finally { setIsReadingClipboard(false); }
  };

  const openOfficialGenerator = () => {
    window.open('https://www.mercadolivre.com.br/afiliados/linkbuilder', '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMsg('Informe a URL de afiliado oficial.');
      return;
    }

    if (trimmed === offer.product.original_url.trim()) {
      setErrorMsg(
        'A URL informada é idêntica à URL comum do anúncio. É estritamente proibido publicar uma URL comum fingindo ser link de afiliado (Regra 4).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onAssociate(offer.id, trimmed);
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold">
              ML
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Associar Link de Afiliado Oficial
              </h3>
              <p className="text-xs text-slate-400">Mercado Livre Brasil &bull; Atribuição Segura</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product snapshot */}
        <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-800">
          <img
            src={offer.product.image}
            alt={offer.product.title}
            className="w-12 h-12 object-cover rounded-lg shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-white truncate">{offer.product.title}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-emerald-400">
                R$ {offer.price.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">ID: {offer.product.external_product_id}</span>
            </div>
          </div>
        </div>

        {/* Security Rule Explanation */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200/90 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Regra de Segurança Inviolável (Regra 4)
          </div>
          O sistema jamais publica produtos com URL comum ou parâmetros fictícios. Obtenha o link de afiliado oficial no painel de afiliados do Mercado Livre (ex: <code className="bg-slate-900/60 px-1 py-0.5 rounded text-amber-300">https://meli.la/...</code>) e cole abaixo para liberar a publicação.
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200/90 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-emerald-300 mb-1"><ShieldCheck className="w-4 h-4" /> Geração oficial</div>
          Abra o gerador oficial do Mercado Livre, gere o link e depois use <strong>Colar automaticamente</strong>. O sistema valida o link antes de liberar a publicação.
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={openOfficialGenerator} className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2"><ExternalLink className="w-3.5 h-3.5" /> Abrir gerador oficial</button>
          <button type="button" onClick={handlePasteClipboard} disabled={isReadingClipboard} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 disabled:opacity-50"><ClipboardPaste className="w-3.5 h-3.5" /> {isReadingClipboard ? 'Lendo...' : 'Colar automaticamente'}</button>
        </div>

        {/* Original URL link */}
        <div className="text-xs text-slate-400">
          <span>URL Original do Anúncio:</span>
          <a
            href={offer.product.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-slate-300 hover:text-yellow-400 truncate mt-0.5 font-mono text-[11px]"
          >
            {offer.product.original_url}
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white mb-1">
              Link de Afiliado Oficial (meli.la ou link rastreado)
            </label>
            <input
              id="input-affiliate-url-modal"
              type="url"
              required
              placeholder="https://meli.la/2Kx9QmP"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 font-mono"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-confirm-associate-link"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Validando...' : 'Validar e Vincular Link'}
            </button>
          </div>
        </form>
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Depois da vinculação, IA, deduplicação e publicação continuam automáticas.</div>
      </div>
    </div>
  );
};
