import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, CheckCircle2, Search, ExternalLink, Filter } from 'lucide-react';
import type { AuditRecord } from '../services/AuditService.ts';

interface AuditTabProps {
  records: AuditRecord[];
}

export const AuditTab: React.FC<AuditTabProps> = ({ records }) => {
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(records[0] || null);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Trilha de Auditoria & Conformidade</h2>
            <p className="text-xs text-slate-400">
              Rastreamento ponta a ponta: Marketplace &rarr; Produto &rarr; Conta &rarr; Link Oficial &rarr; Destino &rarr; Publicação
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Records list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
            Disparos Auditados ({records.length})
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {records.map((rec) => (
              <button
                key={rec.id}
                onClick={() => setSelectedRecord(rec)}
                className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                  selectedRecord?.id === rec.id
                    ? 'bg-slate-800 border-emerald-500/50'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      rec.marketplace === 'SHOPEE'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}
                  >
                    {rec.marketplace}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(rec.publishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-white truncate">{rec.productTitle}</h4>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  Destino: <span className="text-slate-200">{rec.destinationName}</span>
                </p>
              </button>
            ))}

            {records.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                Nenhuma publicação auditada ainda.
              </div>
            )}
          </div>
        </div>

        {/* Selected Record Full Trace */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          {selectedRecord ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-mono text-slate-500">{selectedRecord.id}</span>
                  <h3 className="text-base font-bold text-white mt-0.5">{selectedRecord.productTitle}</h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {selectedRecord.publicationStatus}
                </span>
              </div>

              {/* Step-by-Step Visual Trace Pipeline */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="flex-1 bg-slate-800/50 p-3 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 block font-medium">Marketplace & Catálogo</span>
                    <span className="font-semibold text-white">
                      {selectedRecord.marketplace} &bull; Produto ID: {selectedRecord.productId}
                    </span>
                    <a
                      href={selectedRecord.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white flex items-center gap-1 mt-1 truncate max-w-sm font-mono text-[11px]"
                    >
                      URL Original: {selectedRecord.originalUrl} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="flex-1 bg-slate-800/50 p-3 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 block font-medium">Conta de Afiliado & Link Oficial</span>
                    <span className="font-semibold text-white">
                      Conta ID: {selectedRecord.affiliateAccountId}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-slate-400">Link Atribuído:</span>
                      <a
                        href={selectedRecord.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 font-mono font-bold hover:underline"
                      >
                        {selectedRecord.affiliateUrl}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div className="flex-1 bg-slate-800/50 p-3 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 block font-medium">Destino de WhatsApp & SubIds</span>
                    <span className="font-semibold text-white">
                      {selectedRecord.destinationName} ({selectedRecord.destinationId})
                    </span>
                    {selectedRecord.trackingSubIds && (
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px]">
                        <span className="text-slate-400">SubIds:</span>
                        {selectedRecord.trackingSubIds.map((s, i) => (
                          <span key={i} className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    4
                  </div>
                  <div className="flex-1 bg-[#0b141a] p-3.5 rounded-xl border border-[#202c33] text-xs space-y-1">
                    <span className="text-slate-400 block font-medium">Mensagem Redigida e Despachada</span>
                    <div className="text-slate-100 whitespace-pre-wrap leading-relaxed font-sans">
                      {selectedRecord.aiMessage}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-slate-500 text-xs">
              Selecione uma publicação para visualizar a árvore completa de auditoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
