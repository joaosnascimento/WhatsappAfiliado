import React,{useEffect,useState} from 'react';
import { useToast } from './ui/Toast.tsx';
import { Send, CheckCircle2, Clock, XCircle, Users, ExternalLink, ShieldCheck, Trash2, RefreshCw } from 'lucide-react';
import type { Publication } from '../types/affiliate.ts';

interface PublicationsTabProps {
  publications: Publication[];
  onTriggerSend: (pubId: string) => Promise<void>;
  onDelete: (pubId: string) => Promise<void>;
  onRetry: (pubId: string) => Promise<void>;
}

export const PublicationsTab: React.FC<PublicationsTabProps> = ({
  publications,
  onTriggerSend,
  onDelete,
  onRetry,
}) => {
  const toast=useToast();
  const [initialLoading,setInitialLoading]=useState(true);
  const [busyAction,setBusyAction]=useState<string | null>(null);
  useEffect(()=>{const t=window.setTimeout(()=>setInitialLoading(false),300);return()=>window.clearTimeout(t)},[]);
  const runAction = async (key: string, action: () => Promise<void>, successTitle: string) => {
    setBusyAction(key);
    try {
      await action();
      toast('success', successTitle, 'A fila foi atualizada.');
    } catch (error) {
      toast('error', 'Ação não concluída', error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusyAction(null);
    }
  };

  if(initialLoading) return <div className="space-y-6" aria-busy="true"><div className="h-28 rounded-lg bg-surface-1 animate-pulse"/><div className="grid gap-5 md:grid-cols-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-64 rounded-lg bg-surface-1 animate-pulse"/>)}</div></div>;
  return (
    <div className="space-y-6">
      <div className="bg-surface-1 border border-border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text tracking-tight">Fila & Histórico de Disparos WhatsApp</h2>
            <p className="text-sm text-muted mt-0.5">
              Visualização fiel das mensagens formatadas para WhatsApp e estado do gateway
            </p>
          </div>
          <span className="text-sm text-muted font-medium bg-surface-2 px-3 py-1 rounded-full border border-border-strong">
            {publications.length} publicações registradas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {publications.map((pub) => {
          const isSent = pub.status === 'SENT';
          const isFailed = pub.status === 'FAILED';
          const isQueued = pub.status === 'QUEUED' || pub.status === 'SCHEDULED';
          const isProcessing = pub.status === 'PROCESSING';
          const isRetrying = pub.status === 'RETRYING';
          const isCancelled = pub.status === 'CANCELLED';
          const isExpired = pub.status === 'EXPIRED';
          const isShopee = pub.offer?.marketplace === 'SHOPEE';

          return (
            <div key={pub.id} className="bg-surface-1 border border-border rounded-lg p-5 space-y-4 shadow-sm">
              {/* Publication Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                      isShopee
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                    }`}
                  >
                    {isShopee ? 'Shopee' : 'Mercado Livre'}
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {pub.destination?.name || 'Grupo WhatsApp'}
                  </span>
                </div>

                {/* Status badge */}
                {isSent ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/30">
                    <CheckCircle2 aria-hidden="true" className="w-3 h-3" /> Enviada
                  </span>
                ) : isFailed ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">
                    <XCircle aria-hidden="true" className="w-3 h-3" /> Falha
                  </span>
                ) : isRetrying ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    <RefreshCw aria-hidden="true" className="w-3 h-3 animate-spin" /> Tentando novamente
                  </span>
                ) : isProcessing ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">
                    <Send aria-hidden="true" className="w-3 h-3 animate-pulse" /> Processando
                  </span>
                ) : isCancelled ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold bg-slate-500/20 text-slate-300 px-2 py-0.5 rounded-full border border-slate-500/30">
                    <XCircle aria-hidden="true" className="w-3 h-3" /> Cancelada
                  </span>
                ) : isExpired ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30">
                    <Clock aria-hidden="true" className="w-3 h-3" /> Expirada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                    <Clock aria-hidden="true" className="w-3 h-3" /> Na Fila
                  </span>
                )}
              </div>

              {/* WhatsApp Native Chat Bubble */}
              <div className="bg-[#0b141a] rounded-lg p-4 border border-[#202c33] shadow-inner space-y-2">
                <div className="flex items-center justify-between border-b border-[#202c33] pb-2 text-sm text-muted">
                  <span className="font-semibold text-brand-300 flex items-center gap-1">
                    <ShieldCheck aria-hidden="true" className="w-3 h-3" /> Oferta Verificada
                  </span>
                  <span>
                    {pub.sent_at
                      ? new Date(pub.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'Agendada'}
                  </span>
                </div>

                <div className="text-text font-sans text-sm whitespace-pre-wrap leading-relaxed">
                  {pub.message}
                </div>
              </div>

              {isQueued && (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void runAction(pub.id + ':send', () => onTriggerSend(pub.id), 'Envio solicitado')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50"
                  >
                    <Send className={busyAction === pub.id + ':send' ? 'h-3.5 w-3.5 animate-pulse' : 'h-3.5 w-3.5'} />
                    {busyAction === pub.id + ':send' ? 'Enviando...' : 'Enviar agora'}
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void runAction(pub.id + ':cancel', () => onDelete(pub.id), 'Publicação cancelada')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 border border-rose-500/20 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {busyAction === pub.id + ':cancel' ? 'Cancelando...' : 'Cancelar'}
                  </button>
                </div>
              )}

              {isRetrying && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void runAction(pub.id + ':cancel-retry', () => onDelete(pub.id), 'Tentativa cancelada')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 border border-rose-500/20 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancelar tentativa
                  </button>
                </div>
              )}

              {isFailed && (
                <div className="space-y-2">
                  <div className="text-sm text-rose-300">{pub.error_message || 'O envio falhou.'}</div>
                  <div className="flex justify-end gap-2">
                    <button type="button" disabled={busyAction !== null} onClick={() => void runAction(pub.id + ':retry', () => onRetry(pub.id), 'Reenvio solicitado')} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-3 py-2 text-sm font-semibold text-brand-200 border border-brand-500/20 disabled:opacity-50"><RefreshCw className={busyAction === pub.id + ':retry' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> {busyAction === pub.id + ':retry' ? 'Reenviando...' : 'Reenviar'}</button>
                    <button type="button" disabled={busyAction !== null} onClick={() => void runAction(pub.id + ':delete', () => onDelete(pub.id), 'Publicação excluída')} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 border border-rose-500/20 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> {busyAction === pub.id + ':delete' ? 'Arquivando...' : 'Arquivar falha'}</button>
                  </div>
                </div>
              )}

              {/* Link and SubId footer */}
              <div className="text-sm text-muted space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span>Link de Atribuição:</span>
                  <a
                    href={pub.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-300 font-mono font-semibold hover:underline flex items-center gap-1 truncate max-w-[200px]"
                  >
                    {pub.affiliate_url} <ExternalLink aria-hidden="true" className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>

                {pub.tracking_subids && pub.tracking_subids.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span>SubIds Ativos:</span>
                    <div className="flex gap-1">
                      {pub.tracking_subids.map((sub, i) => (
                        <span key={i} className="text-sm bg-surface-2 px-1.5 py-0.5 rounded font-mono text-text">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {publications.length === 0 && (
          <div className="col-span-2 bg-surface-1 border border-border rounded-lg p-12 text-center text-muted space-y-2">
            <Send aria-hidden="true" className="w-8 h-8 text-subtle mx-auto" />
            <h3 className="text-base font-semibold text-text">Fila de Disparos Vazia</h3>
            <p className="text-xs text-subtle max-w-sm mx-auto">
              Acesse a aba <strong>Radar de Ofertas</strong>, selecione um produto com link validado e clique em <strong>Publicar</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
