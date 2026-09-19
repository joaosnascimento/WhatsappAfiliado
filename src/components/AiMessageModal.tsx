import React, { useState } from 'react';
import { X, Sparkles, Send, Copy, Check, ShieldCheck } from 'lucide-react';
import type { Offer, Destination } from '../types/affiliate.ts';

interface AiMessageModalProps {
  offer: Offer | null;
  destinations: Destination[];
  onClose: () => void;
  onGenerateMessage: (offerId: string, destinationId?: string) => Promise<string>;
  onPublish: (offerId: string, destinationId: string) => Promise<void>;
}

export const AiMessageModal: React.FC<AiMessageModalProps> = ({
  offer,
  destinations,
  onClose,
  onGenerateMessage,
  onPublish,
}) => {
  if (!offer) return null;

  const [message, setMessage] = useState(offer.ai_generated_message || '');
  const [selectedDestId, setSelectedDestId] = useState(destinations[0]?.id || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generated = await onGenerateMessage(offer.id, selectedDestId);
      setMessage(generated);
    } catch (err) {
      alert(`Erro na geração da IA: ${(err as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToWhatsApp = async () => {
    if (!offer.affiliate_url && offer.status !== 'AFFILIATE_LINK_READY') {
      alert('Bloqueio de Segurança: Não é permitido publicar sem link de afiliado validado.');
      return;
    }

    setIsPublishing(true);
    try {
      await onPublish(offer.id, selectedDestId);
      alert('Mensagem enviada com sucesso para a fila do WhatsApp!');
      onClose();
    } catch (err) {
      alert(`Falha no envio: ${(err as Error).message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const isReady = offer.status === 'AFFILIATE_LINK_READY' || offer.status === 'READY_TO_PUBLISH';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Redação com IA &bull; WhatsApp</h3>
              <p className="text-xs text-slate-400">Gemini 3.8 Flash &bull; Estritamente Factual (Regra 18)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fact check guarantee */}
        <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            A IA recebe <strong>somente dados confirmados</strong>: Preço R$ {offer.price.toFixed(2)}, Desconto {offer.discount || 0}%, e Link de Afiliado oficial. Zero alucinação de cupons ou avaliações inexistentes.
          </span>
        </div>

        {/* Destination selector */}
        <div>
          <label className="block text-xs font-semibold text-white mb-1">
            Destino do WhatsApp para Personalização:
          </label>
          <select
            value={selectedDestId}
            onChange={(e) => setSelectedDestId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.type === 'WHATSAPP_GROUP' ? 'Grupo' : 'Canal'})
              </option>
            ))}
          </select>
        </div>

        {/* WhatsApp Preview Bubble */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Pré-visualização do WhatsApp:
            </label>
            <button
              onClick={handleCopy}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiado' : 'Copiar Texto'}
            </button>
          </div>

          <div className="bg-[#0b141a] rounded-xl p-4 border border-[#202c33] text-slate-100 font-sans text-xs whitespace-pre-wrap leading-relaxed shadow-inner max-h-60 overflow-y-auto">
            {message || (
              <span className="text-slate-500 italic">
                Nenhuma mensagem gerada ainda. Clique em "Gerar com IA" para redigir o texto com formatação otimizada para WhatsApp.
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            id="btn-regenerate-ai"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Redigindo...' : 'Gerar com IA'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              id="btn-confirm-publish-modal"
              onClick={handleSendToWhatsApp}
              disabled={isPublishing || !isReady || !message}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isReady ? 'Requer link de afiliado oficial validado' : 'Enviar para WhatsApp'}
            >
              <Send className="w-3.5 h-3.5" />
              {isPublishing ? 'Disparando...' : 'Publicar no WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
