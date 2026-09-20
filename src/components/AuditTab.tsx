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
      <div className="bg-surface-1 border border-border rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand-500/10 text-brand-300 border border-brand-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text tracking-tight">Trilha de Auditoria & Conformidade</h2>
            <p className="text-sm text-muted">
              Rastreamento ponta a ponta: Marketplace &rarr; Produto &rarr; Conta &rarr; Link Oficial &rarr; Destino &rarr; Publicação
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Records list */}
        <div className="bg-surface-1 border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted px-2">
            Disparos Auditados ({records.length})
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {records.map((rec) => (
              <button
                key={rec.id}
                onClick={() => setSelectedRecord(rec)}
                className={`w-full text-left p-3 rounded-md border transition cursor-pointer ${
                  selectedRecord?.id === rec.id
                    ? 'bg-surface-2 border-brand-500/50'
                    : 'bg-surface-soft border-border hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-bold px-1.5 py-0.5 rounded ${
                      rec.marketplace === 'SHOPEE'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}
                  >
                    {rec.marketplace}
                  </span>
                  <span className="text-sm text-muted">
                    {new Date(rec.publishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-text truncate">{rec.productTitle}</h4>
                <p className="text-sm text-muted mt-1 flex items-center gap-1">
                  Destino: <span className="text-slate-200">{rec.destinationName}</span>
                </p>
              </button>
            ))}

            {records.length === 0 && (
              <div className="text-center py-8 text-subtle text-sm">
                Nenhuma publicação auditada ainda.
              </div>
            )}
          </div>
        </div>

        {/* Selected Record Full Trace */}
        <div className="bg-surface-1 border border-border rounded-lg p-6 space-y-5">
          {selectedRecord ? (
            <>
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <span className="text-sm font-mono text-subtle">{selectedRecord.id}</span>
                  <h3 className="text-base font-bold text-text mt-0.5">{selectedRecord.productTitle}</h3>
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  {selectedRecord.publicationStatus}
                </span>
              </div>

              {/* Step-by-Step Visual Trace Pipeline */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-surface-2 text-brand-300 border border-border-strong flex items-center justify-center font-bold text-sm shrink-0">
                    1
                  </div>
                  <div className="flex-1 bg-surface-2/50 p-3 rounded-md border border-border text-sm">
                    <span className="text-muted block font-medium">Marketplace & Catálogo</span>
                    <span className="font-semibold text-text">
                      {selectedRecord.marketplace} &bull; Produto ID: {selectedRecord.productId}
                    </span>
                    <a
                      href={selectedRecord.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-text flex items-center gap-1 mt-1 truncate max-w-sm font-mono text-sm"
                    >
                      URL Original: {selectedRecord.originalUrl} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-surface-2 text-brand-300 border border-border-strong flex items-center justify-center font-bold text-sm shrink-0">
                    2
                  </div>
                  <div className="flex-1 bg-surface-2/50 p-3 rounded-md border border-border text-sm">
                    <span className="text-muted block font-medium">Conta de Afiliado & Link Oficial</span>
                    <span className="font-semibold text-text">
                      Conta ID: {selectedRecord.affiliateAccountId}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-muted">Link Atribuído:</span>
                      <a
                        href={selectedRecord.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-300 font-mono font-bold hover:underline"
                      >
                        {selectedRecord.affiliateUrl}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-surface-2 text-brand-300 border border-border-strong flex items-center justify-center font-bold text-sm shrink-0">
                    3
                  </div>
                  <div className="flex-1 bg-surface-2/50 p-3 rounded-md border border-border text-sm">
                    <span className="text-muted block font-medium">Destino de WhatsApp & SubIds</span>
                    <span className="font-semibold text-text">
                      {selectedRecord.destinationName} ({selectedRecord.destinationId})
                    </span>
                    {selectedRecord.trackingSubIds && (
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-sm">
                        <span className="text-muted">SubIds:</span>
                        {selectedRecord.trackingSubIds.map((s, i) => (
                          <span key={i} className="bg-surface-3 border-border-strong px-1.5 py-0.5 rounded text-slate-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-surface-2 text-brand-300 border border-border-strong flex items-center justify-center font-bold text-sm shrink-0">
                    4
                  </div>
                  <div className="flex-1 bg-[#0b141a] p-3.5 rounded-md border border-[#202c33] text-sm space-y-1">
                    <span className="text-muted block font-medium">Mensagem Redigida e Despachada</span>
                    <div className="text-text whitespace-pre-wrap leading-relaxed font-sans">
                      {selectedRecord.aiMessage}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-subtle text-sm">
              Selecione uma publicação para visualizar a árvore completa de auditoria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
