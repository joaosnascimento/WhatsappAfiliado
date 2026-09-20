import React from 'react';
import { Send, CheckCircle2, Clock, XCircle, Users, ExternalLink, ShieldCheck } from 'lucide-react';
import type { Publication } from '../types/affiliate.ts';

interface PublicationsTabProps {
  publications: Publication[];
  onTriggerSend: (pubId: string) => Promise<void>;
}

export const PublicationsTab: React.FC<PublicationsTabProps> = ({
  publications,
  onTriggerSend,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Fila & Histórico de Disparos WhatsApp</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualização fiel das mensagens formatadas para WhatsApp e estado do gateway
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {publications.length} publicações registradas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {publications.map((pub) => {
          const isSent = pub.status === 'SENT';
          const isFailed = pub.status === 'FAILED';
          const isQueued = pub.status === 'QUEUED' || pub.status === 'SCHEDULED';
          const isShopee = pub.offer?.marketplace === 'SHOPEE';

          return (
            <div key={pub.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              {/* Publication Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isShopee
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                    }`}
                  >
                    {isShopee ? 'Shopee' : 'Mercado Livre'}
                  </span>
                  <span className="text-xs font-semibold text-slate-200">
                    {pub.destination?.name || 'Grupo WhatsApp'}
                  </span>
                </div>

                {/* Status badge */}
                {isSent ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 aria-hidden="true" className="w-3 h-3" /> Enviada
                  </span>
                ) : isFailed ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">
                    <XCircle aria-hidden="true" className="w-3 h-3" /> Falha
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                    <Clock aria-hidden="true" className="w-3 h-3" /> Na Fila
                  </span>
                )}
              </div>

              {/* WhatsApp Native Chat Bubble */}
              <div className="bg-[#0b141a] rounded-2xl p-4 border border-[#202c33] shadow-inner space-y-2">
                <div className="flex items-center justify-between border-b border-[#202c33] pb-2 text-[10px] text-slate-400">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck aria-hidden="true" className="w-3 h-3" /> Oferta Verificada
                  </span>
                  <span>
                    {pub.sent_at
                      ? new Date(pub.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'Agendada'}
                  </span>
                </div>

                <div className="text-slate-100 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                  {pub.message}
                </div>
              </div>

              {/* Link and SubId footer */}
              <div className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span>Link de Atribuição:</span>
                  <a
                    href={pub.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 font-mono font-semibold hover:underline flex items-center gap-1 truncate max-w-[200px]"
                  >
                    {pub.affiliate_url} <ExternalLink aria-hidden="true" className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>

                {pub.tracking_subids && pub.tracking_subids.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span>SubIds Ativos:</span>
                    <div className="flex gap-1">
                      {pub.tracking_subids.map((sub, i) => (
                        <span key={i} className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-300">
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
          <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
            <Send aria-hidden="true" className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-white">Fila de Disparos Vazia</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Acesse a aba <strong>Radar de Ofertas</strong>, selecione um produto com link validado e clique em <strong>Publicar</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
