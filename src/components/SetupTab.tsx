import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, RefreshCw, QrCode, Send, Settings2, Smartphone, Users, Zap } from 'lucide-react';

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface SetupTabProps { apiFetch: ApiFetch; whatsappSettings: any; onSaveWhatsApp: (settings:any)=>Promise<void>; onNavigate: (tab:string)=>void; }
type Group = { id:string; subject?:string; size?:number };

const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500";
const cardClass = "rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm";

export const SetupTab: React.FC<SetupTabProps> = ({ apiFetch, whatsappSettings, onSaveWhatsApp, onNavigate }) => {
  const [provider, setProvider] = useState(whatsappSettings?.provider || 'evolution');
  const [url, setUrl] = useState(whatsappSettings?.evolutionApiUrl || '');
  const [key, setKey] = useState('');
  const [instance, setInstance] = useState(whatsappSettings?.evolutionInstance || 'whatsappafiliado');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('unknown');
  const [statusError, setStatusError] = useState('');
  const [qr, setQr] = useState('');
  const [qrBusy, setQrBusy] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsBusy, setGroupsBusy] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [testText, setTestText] = useState('TESTE DO WHATSAPPAFILIADO\\n\\nMensagem enviada diretamente pela interface.');
  const [testBusy, setTestBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (whatsappSettings?.evolutionApiUrl) setUrl(whatsappSettings.evolutionApiUrl);
    if (whatsappSettings?.evolutionInstance) setInstance(whatsappSettings.evolutionInstance);
    if (whatsappSettings?.provider) setProvider(whatsappSettings.provider);
  }, [whatsappSettings]);

  const showToast = (message:string) => { setToast(message); window.setTimeout(()=>setToast(''),3500); };

  const checkStatus = async () => {
    try {
      const res = await apiFetch('/api/whatsapp/status');
      const data = await res.json();
      setStatus(data.state || 'error');
      setStatusError(res.ok ? '' : (data.error || 'Não foi possível verificar a conexão.'));
    } catch (e) { setStatus('error'); setStatusError((e as Error).message); }
  };

  useEffect(() => { void checkStatus(); const timer=window.setInterval(()=>void checkStatus(),10000); return ()=>window.clearInterval(timer); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await onSaveWhatsApp({ provider, evolutionApiUrl:url.trim(), evolutionApiKey:key || (whatsappSettings?.evolutionApiKey === 'configured' ? 'configured' : ''), evolutionInstance:instance.trim() });
      setKey('');
      showToast('Integração salva com segurança.');
      await checkStatus();
    } catch(e) { showToast((e as Error).message); }
    finally { setSaving(false); }
  };

  const connect = async () => {
    setQrBusy(true);
    try {
      const res = await apiFetch('/api/whatsapp/connect',{method:'POST'});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || 'Não foi possível iniciar a conexão.');
      if(data.qrcode) setQr(data.qrcode);
      setStatus(data.state || 'connecting');
      showToast(data.qrcode ? 'QR Code pronto. Escaneie pelo WhatsApp.' : 'Conexão iniciada.');
    } catch(e) { showToast((e as Error).message); }
    finally { setQrBusy(false); }
  };

  const refreshQr = async () => {
    setQrBusy(true);
    try {
      const res=await apiFetch('/api/whatsapp/qrcode');
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || 'Não foi possível gerar o QR Code.');
      setQr(data.qrcode || '');
      setStatus('connecting');
    } catch(e) { showToast((e as Error).message); }
    finally { setQrBusy(false); }
  };

  const loadGroups = async () => {
    setGroupsBusy(true);
    try {
      const res=await apiFetch('/api/whatsapp/groups');
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || 'Não foi possível listar os grupos.');
      setGroups(Array.isArray(data) ? data : []);
      showToast((Array.isArray(data) ? data.length : 0) + ' grupos encontrados.');
    } catch(e) { showToast((e as Error).message); }
    finally { setGroupsBusy(false); }
  };

  const sendTest = async () => {
    if(!selectedGroup) { showToast('Selecione um grupo primeiro.'); return; }
    setTestBusy(true);
    try {
      const res=await apiFetch('/api/whatsapp/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selectedGroup,text:testText})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error || 'Falha ao enviar.');
      showToast('Mensagem de teste enviada.');
    } catch(e) { showToast((e as Error).message); }
    finally { setTestBusy(false); }
  };

  const connected = status === 'open';

  return (
    <div className="space-y-6">
      {toast && <div className="fixed right-5 top-5 z-50 rounded-xl border border-emerald-500/30 bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">{toast}</div>}

      <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400"><Zap className="h-4 w-4"/> Central de configuração</div>
            <h1 className="text-2xl font-bold text-white">Coloque tudo para funcionar sem terminal</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">Conecte WhatsApp, gere o QR Code, descubra grupos e faça um envio de teste diretamente daqui.</p>
          </div>
          <div className={connected ? "rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3" : "rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3"}>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">{connected ? <CheckCircle2 className="h-5 w-5 text-emerald-400"/> : <CircleAlert className="h-5 w-5 text-amber-400"/>}{connected ? 'WhatsApp conectado' : status === 'connecting' ? 'Aguardando QR / conexão' : 'WhatsApp não conectado'}</div>
            <div className="mt-1 text-xs text-slate-400">{statusError || (connected ? 'Instância: ' + instance : 'Use o botão conectar para iniciar.')}</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={cardClass + " xl:col-span-2"}>
          <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Settings2 className="h-5 w-5"/></div><div><h2 className="font-bold text-white">Conexão WhatsApp</h2><p className="text-xs text-slate-400">As credenciais ficam no workspace e nunca vão para o navegador.</p></div></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-xs font-medium text-slate-300">Provedor<select value={provider} onChange={e=>setProvider(e.target.value)} className={inputClass+" mt-2"}><option value="evolution">Evolution API — grupos WhatsApp</option><option value="cloud">Meta Cloud API</option></select></label>
            <label className="text-xs font-medium text-slate-300">Nome da instância<input value={instance} onChange={e=>setInstance(e.target.value)} className={inputClass+" mt-2"} placeholder="whatsappafiliado"/></label>
            <label className="text-xs font-medium text-slate-300 md:col-span-2">URL da Evolution API<input value={url} onChange={e=>setUrl(e.target.value)} className={inputClass+" mt-2"} placeholder="http://localhost:8080 ou https://evolution.seudominio.com"/></label>
            <label className="text-xs font-medium text-slate-300 md:col-span-2">Chave da API<input type="password" value={key} onChange={e=>setKey(e.target.value)} className={inputClass+" mt-2"} placeholder={whatsappSettings?.evolutionApiKey === 'configured' ? 'Chave já configurada — deixe vazio para manter' : 'AUTHENTICATION_API_KEY'}/></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={save} disabled={saving} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{saving?'Salvando...':'Salvar integração'}</button>
            <button onClick={connect} disabled={qrBusy} className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 disabled:opacity-50"><Smartphone className="h-4 w-4"/>{qrBusy?'Gerando...':'Conectar WhatsApp / QR Code'}</button>
            <button onClick={()=>void checkStatus()} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800"><RefreshCw className="h-4 w-4"/>Atualizar status</button>
          </div>
        </section>

        <section className={cardClass+" flex flex-col items-center justify-center min-h-[320px]"}>
          {qr ? <><div className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><QrCode className="h-5 w-5 text-emerald-400"/>Escaneie no WhatsApp</div><img src={qr} alt="QR Code para conectar o WhatsApp" className="h-64 w-64 rounded-xl bg-white p-2"/><button onClick={refreshQr} disabled={qrBusy} className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400"><RefreshCw className={qrBusy?'h-3.5 w-3.5 animate-spin':'h-3.5 w-3.5'}/>Gerar novo QR</button></> : <div className="text-center"><QrCode className="mx-auto h-12 w-12 text-slate-600"/><p className="mt-3 text-sm font-semibold text-slate-300">QR Code aparecerá aqui</p><p className="mt-1 text-xs text-slate-500">Clique em “Conectar WhatsApp / QR Code”.</p></div>}
        </section>
      </div>

      <section className={cardClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><h2 className="font-bold text-white">Grupos do WhatsApp</h2><p className="text-xs text-slate-400">Nada de copiar JID pelo CMD. A aplicação consulta a Evolution e deixa você escolher o grupo.</p></div>
          <button onClick={loadGroups} disabled={groupsBusy || !connected} className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Users className="h-4 w-4"/>{groupsBusy?'Buscando...':'Buscar meus grupos'}</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {groups.map(g=><button key={g.id} onClick={()=>setSelectedGroup(g.id)} className={selectedGroup===g.id?"rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-4 text-left":"rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-left hover:border-slate-700"}><div className="font-semibold text-white">{g.subject || 'Grupo sem nome'}</div><div className="mt-1 font-mono text-[11px] text-slate-500">{g.id}</div>{typeof g.size==='number'&&<div className="mt-2 text-xs text-slate-400">{g.size} participantes</div>}</button>)}
          {!groups.length && <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500 md:col-span-2">Conecte o WhatsApp e clique em “Buscar meus grupos”.</div>}
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex items-center gap-3"><Send className="h-5 w-5 text-emerald-400"/><div><h2 className="font-bold text-white">Teste de envio</h2><p className="text-xs text-slate-400">Valide a integração sem abrir PowerShell.</p></div></div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <select value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)} className={inputClass+" lg:col-span-1"}><option value="">Selecione um grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.subject || g.id}</option>)}</select>
          <textarea value={testText} onChange={e=>setTestText(e.target.value)} className={inputClass+" min-h-24 lg:col-span-1"} />
          <button onClick={sendTest} disabled={testBusy || !selectedGroup || !connected} className="flex min-h-24 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 font-bold text-slate-950 disabled:opacity-50"><Send className="h-4 w-4"/>{testBusy?'Enviando...':'Enviar mensagem de teste'}</button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-bold text-white">Próximas configurações</h2><p className="text-xs text-slate-400">O restante do sistema também é operado pelo painel.</p></div><div className="flex gap-2"><button onClick={()=>onNavigate('affiliates')} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-white">Mercado Livre / Shopee</button><button onClick={()=>onNavigate('destinations')} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-white">Automação e destinos</button></div></div>
      </section>
    </div>
  );
};
