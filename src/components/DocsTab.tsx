import React, { useState } from 'react';
import { BookOpen, ShieldCheck, CheckCircle2, XCircle, Play, FileText, Code2 } from 'lucide-react';

interface DocsTabProps {
  onRunTests: () => Promise<any>;
  testResults: {
    total: number;
    passed: number;
    failed: number;
    results: Array<{ name: string; success: boolean; error?: string }>;
  } | null;
  isRunningTests: boolean;
}

export const DocsTab: React.FC<DocsTabProps> = ({
  onRunTests,
  testResults,
  isRunningTests,
}) => {
  const [docMarketplace, setDocMarketplace] = useState<'SHOPEE' | 'MERCADOLIVRE'>('SHOPEE');

  return (
    <div className="space-y-6">
      {/* Test Suite Runner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Suíte de Testes Unitários de Integração (Regra 7 & 32)
              </h2>
              <p className="text-xs text-slate-400">
                Validação automatizada de SHA-256, regras de bloqueio de links comuns, deduplicação e factualidade da IA.
              </p>
            </div>
          </div>

          <button
            id="btn-run-unit-tests"
            onClick={onRunTests}
            disabled={isRunningTests}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
            {isRunningTests ? 'Executando Testes...' : 'Executar Suíte de Testes'}
          </button>
        </div>

        {/* Test Results Output */}
        {testResults && (
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
              <span className="font-semibold text-white">
                Resultado: {testResults.passed} / {testResults.total} testes passaram
              </span>
              <span
                className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  testResults.failed === 0
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {testResults.failed === 0 ? 'TODOS OS TESTES APROVADOS' : `${testResults.failed} FALHAS`}
              </span>
            </div>

            <div className="divide-y divide-slate-700/50">
              {testResults.results.map((res, idx) => (
                <div key={idx} className="py-2 flex items-start gap-2.5 text-xs">
                  {res.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span className={res.success ? 'text-slate-200' : 'text-rose-300 font-semibold'}>
                      {res.name}
                    </span>
                    {res.error && <p className="text-[11px] text-rose-400 mt-0.5 font-mono">{res.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Embedded Documentation Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-300" />
            <h3 className="text-base font-bold text-white">Documentação Técnica das Integrações</h3>
          </div>

          <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
            <button
              id="doc-tab-shopee"
              onClick={() => setDocMarketplace('SHOPEE')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                docMarketplace === 'SHOPEE'
                  ? 'bg-orange-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Shopee Affiliate Open API
            </button>
            <button
              id="doc-tab-ml"
              onClick={() => setDocMarketplace('MERCADOLIVRE')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                docMarketplace === 'MERCADOLIVRE'
                  ? 'bg-yellow-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mercado Livre Brasil & OAuth
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        {docMarketplace === 'SHOPEE' ? (
          <div className="prose prose-invert max-w-none text-xs text-slate-300 space-y-4 leading-relaxed">
            <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-200">
              <strong>Endpoint Oficial Brasil:</strong> <code className="text-white">https://open-api.affiliate.shopee.com.br/graphql</code>
            </div>

            <h4 className="text-sm font-bold text-white">1. Autenticação por Assinatura Criptográfica SHA-256</h4>
            <p>
              A Shopee Affiliate Open API não usa tokens estáticos. Cada requisição calcula um hash SHA-256 utilizando:
              <br />
              <code className="text-orange-300 bg-slate-800 px-1.5 py-0.5 rounded mt-1 inline-block">
                SHA256(AppId + Timestamp + PayloadJSON + Secret)
              </code>
            </p>

            <h4 className="text-sm font-bold text-white">2. Header Obrigatório</h4>
            <pre className="bg-slate-950 p-3 rounded-xl text-slate-300 overflow-x-auto font-mono text-[11px]">
              Authorization: SHA256 Credential={'{APP_ID}'}, Timestamp={'{TIMESTAMP}'}, Signature={'{HEX_HASH}'}
            </pre>

            <h4 className="text-sm font-bold text-white">3. Geração de Links de Afiliado com SubIds</h4>
            <p>
              A mutation <code className="text-white">generateShortLink</code> recebe a URL original e até 5 SubIds alfanuméricos:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">subId[0]:</strong> Canal ('whatsapp')</li>
              <li><strong className="text-slate-200">subId[1]:</strong> Identificador do grupo/destino</li>
              <li><strong className="text-slate-200">subId[2]:</strong> Campanha ou tema</li>
              <li><strong className="text-slate-200">subId[3]:</strong> Categoria do produto</li>
              <li><strong className="text-slate-200">subId[4]:</strong> Identificador da execução</li>
            </ul>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none text-xs text-slate-300 space-y-4 leading-relaxed">
            <div className="p-3.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-200">
              <strong>Distinção Crítica:</strong> A API DevCenter (<code className="text-white">api.mercadolibre.com</code>) é focada no catálogo público e vendedores. O Programa de Afiliados opera em plataforma separada.
            </div>

            <h4 className="text-sm font-bold text-white">1. Fluxo OAuth 2.0</h4>
            <p>
              O sistema conecta com o DevCenter via autorização padrão:
              <br />
              <code className="text-yellow-300 bg-slate-800 px-1.5 py-0.5 rounded mt-1 inline-block font-mono text-[11px]">
                https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=...
              </code>
            </p>

            <h4 className="text-sm font-bold text-white">2. Regra de Segurança Inviolável (Regra 4)</h4>
            <p>
              Conforme as diretrizes da plataforma, o sistema <strong>nunca inventa parâmetros fictícios</strong> e nunca transforma uma URL normal em link de afiliado adicionando querystrings arbitrárias.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>O produto é localizado na API oficial do Mercado Livre e armazenado com sua URL original.</li>
              <li>O status inicial permanece como <code className="text-yellow-400">VALIDATED</code>.</li>
              <li>O link oficial de afiliado (<code className="text-amber-300">meli.la</code> ou link com tag oficial <code className="text-amber-300">matt_tool</code>) deve ser validado antes de qualquer publicação automática.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
