import React, { useState } from 'react';
import { useToast } from './ui/Toast.tsx';
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
  const toast=useToast();
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
      toast('error','A IA não conseguiu gerar a mensagem',(err as Error).message);
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
      toast('error','Publicação bloqueada','É necessário um link de afiliado validado.');
      return;
    }

    setIsPublishing(true);
    try {
      await onPublish(offer.id, selectedDestId);
      toast('success','Mensagem enviada','A oferta foi adicionada à fila do WhatsApp.');
      onClose();
    } catch (err) {
      toast('error','Falha no envio',(err as Error).message);
    } finally {
      setIsPublishing(false);
    }
  };

  const isReady = offer.status === 'AFFILIATE_LINK_READY' || offer.status === 'READY_TO_PUBLISH';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4">
      <div className="bg-surface-1 border border-border-strong rounded-lg max-w-xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-300 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-text text-base">Redação com IA &bull; WhatsApp</h3>
              <p className="text-sm text-muted">Gemini 3.8 Flash &bull; Estritamente Factual (Regra 18)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text p-1 rounded-lg hover:bg-surface-2 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fact check guarantee */}
        <div className="p-3 bg-surface-2 rounded-md border border-border flex items-center gap-2 text-sm text-text">
          <ShieldCheck className="w-4 h-4 text-brand-300 shrink-0" />
          <span>
            A IA recebe <strong>somente dados confirmados</strong>: Preço R$ {offer.price.toFixed(2)}, Desconto {offer.discount || 0}%, e Link de Afiliado oficial. Zero alucinação de cupons ou avaliações inexistentes.
          </span>
        </div>

        {/* Destination selector */}
        <div>
          <label className="block text-sm font-semibold text-text mb-1">
            Destino do WhatsApp para Personalização:
          </label>
          <select
            value={selectedDestId}
            onChange={(e) => setSelectedDestId(e.target.value)}
            className="w-full bg-surface-2 border border-border-strong rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-brand-500"
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
            <label className="text-sm font-semibold text-text">
              Pré-visualização do WhatsApp:
            </label>
            <button
              onClick={handleCopy}
              className="text-sm text-muted hover:text-text flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-brand-300" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiado' : 'Copiar Texto'}
            </button>
          </div>

          <div className="bg-[#0b141a] rounded-md p-4 border border-[#202c33] text-text font-sans text-sm whitespace-pre-wrap leading-relaxed shadow-inner max-h-60 overflow-y-auto">
            {message || (
              <span className="text-subtle italic">
                Nenhuma mensagem gerada ainda. Clique em "Gerar com IA" para redigir o texto com formatação otimizada para WhatsApp.
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            id="btn-regenerate-ai"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 bg-surface-2 hover:bg-surface-3 border-border-strong text-text font-medium text-sm rounded-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-brand-300 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Redigindo...' : 'Gerar com IA'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-semibold text-muted hover:text-text transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              id="btn-confirm-publish-modal"
              onClick={handleSendToWhatsApp}
              disabled={isPublishing || !isReady || !message}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-sm rounded-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
