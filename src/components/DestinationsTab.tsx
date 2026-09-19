import React, { useState } from 'react';
import { Users, Radio, Plus, CheckCircle2, Clock, Layers, ShieldCheck, Tag } from 'lucide-react';
import type { Destination, MarketplaceType } from '../types/affiliate.ts';

interface DestinationsTabProps {
  destinations: Destination[];
  onAddDestination: (dest: Partial<Destination>) => Promise<void>;
}

export const DestinationsTab: React.FC<DestinationsTabProps> = ({
  destinations,
  onAddDestination,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'WHATSAPP_GROUP' | 'WHATSAPP_CHANNEL'>('WHATSAPP_GROUP');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [marketplaces, setMarketplaces] = useState<MarketplaceType[]>(['SHOPEE', 'MERCADOLIVRE']);
  const [keywords, setKeywords] = useState('Pokémon, TCG, SSD, Gamer, Tech');
  const [frequency, setFrequency] = useState(45);
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('22:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddDestination({
        name,
        type,
        identifier: identifier || `120363${Date.now()}@${type === 'WHATSAPP_GROUP' ? 'g.us' : 'newsletter'}`,
        description,
        marketplaces,
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        frequency_minutes: Number(frequency),
        time_start: timeStart,
        time_end: timeEnd,
        priority: 'HIGH',
        is_active: true,
      });

      setName('');
      setDescription('');
      setIdentifier('');
      setShowForm(false);
    } catch (err) {
      alert(`Erro ao criar destino: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMarketplace = (mp: MarketplaceType) => {
    if (marketplaces.includes(mp)) {
      if (marketplaces.length > 1) {
        setMarketplaces(marketplaces.filter((m) => m !== mp));
      }
    } else {
      setMarketplaces([...marketplaces, mp]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Destinos de WhatsApp</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Grupos VIP e canais com regras de frequência, filtros temáticos e tags de SubId
          </p>
        </div>

        <button
          id="btn-add-destination"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Destino WhatsApp
        </button>
      </div>

      {/* Creation Form Modal/Card */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-base font-bold text-white">Cadastrar Grupo ou Canal de WhatsApp</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Destino</label>
              <input
                type="text"
                required
                placeholder="Ex: Achadinhos Tech & Hardware"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Destino</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="WHATSAPP_GROUP">Grupo de WhatsApp (g.us)</option>
                <option value="WHATSAPP_CHANNEL">Canal / Newsletter (newsletter)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                JID / Identificador WhatsApp (Opcional)
              </label>
              <input
                type="text"
                placeholder="120363198822001122@g.us"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Palavras-chave de Afinidade (separadas por vírgula)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Intervalo Mínimo de Envio (minutos)
              </label>
              <input
                type="number"
                min="10"
                max="1440"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Início</label>
                <input
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Término</label>
                <input
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Marketplaces Checkbox */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Marketplaces Permitidos neste Destino:
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaces.includes('SHOPEE')}
                  onChange={() => toggleMarketplace('SHOPEE')}
                  className="rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-0"
                />
                🟠 Shopee Brasil
              </label>
              <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaces.includes('MERCADOLIVRE')}
                  onChange={() => toggleMarketplace('MERCADOLIVRE')}
                  className="rounded bg-slate-800 border-slate-700 text-yellow-400 focus:ring-0"
                />
                🟡 Mercado Livre Brasil
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
            >
              {isSubmitting ? 'Cadastrando...' : 'Salvar Destino'}
            </button>
          </div>
        </form>
      )}

      {/* Destinations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {destinations.map((dest) => (
          <div key={dest.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  {dest.type === 'WHATSAPP_GROUP' ? <Users className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{dest.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">{dest.identifier}</span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Ativo
              </span>
            </div>

            {dest.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{dest.description}</p>
            )}

            {/* Config chips */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Horário de Operação</span>
                <span className="font-semibold text-white flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-emerald-400" /> {dest.time_start} às {dest.time_end}
                </span>
              </div>

              <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Frequência Mínima</span>
                <span className="font-semibold text-white mt-0.5 block">
                  A cada {dest.frequency_minutes} minutos
                </span>
              </div>
            </div>

            {/* Allowed Marketplaces */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span>Marketplaces:</span>
              <div className="flex gap-2">
                {dest.marketplaces.map((mp) => (
                  <span
                    key={mp}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      mp === 'SHOPEE'
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                    }`}
                  >
                    {mp === 'SHOPEE' ? '🟠 Shopee' : '🟡 Mercado Livre'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
