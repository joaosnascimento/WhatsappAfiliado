import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, CircleAlert, Loader2, MessageCircle, QrCode, RefreshCw, Send, ShieldCheck, Smartphone, Users } from 'lucide-react';

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface SetupTabProps { apiFetch: ApiFetch; whatsappSettings: any; onSaveWhatsApp: (settings:any)=>Promise<void>; onNavigate: (tab:string)=>void; }
type Group = { id:string; subject?:string; size?:number };

const input = "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10";
const card = "rounded-3xl border border-slate-800 bg-slate-900/80";
const button = "rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const SetupTab: React.FC<SetupTabProps> = ({ apiFetch, whatsappSettings, onSaveWhatsApp, onNavigate }) => {
  const [url,setUrl]=useState(whatsappSettings?.evolutionApiUrl || 'http://localhost:8080');
  const [key,setKey]=useState('');
  const [instance,setInstance]=useState(whatsappSettings?.evolutionInstance || 'whatsappafiliado');
  const [saving,setSaving]=useState(false);
  const [status,setStatus]=useState('unknown');
  const [statusError,setStatusError]=useState('');
  const [qr,setQr]=useState('');
  const [busy,setBusy]=useState(false);
  const [groups,setGroups]=useState<Group[]>([]);
  const [selectedGroup,setSelectedGroup]=useState('');
  const [testBusy,setTestBusy]=useState(false);
  const [message,setMessage]=useState('Teste enviado pelo WhatsappAfiliado.');
  const [notice,setNotice]=useState('');
  const configured=Boolean(whatsappSettings?.provider==='evolution' && whatsappSettings?.evolutionApiUrl && whatsappSettings?.evolutionApiKey==='configured' && whatsappSettings?.evolutionInstance);
  const connected=status==='open';

  useEffect(()=>{ if(whatsappSettings?.evolutionApiUrl)setUrl(whatsappSettings.evolutionApiUrl); if(whatsappSettings?.evolutionInstance)setInstance(whatsappSettings.evolutionInstance); },[whatsappSettings]);

  const notify=(text:string)=>{setNotice(text);window.setTimeout(()=>setNotice(''),3500);};
  const read=async(r:Response)=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Não foi possível concluir a ação.');return d;};

  const check=async()=>{
    try{const r=await apiFetch('/api/whatsapp/status');const d=await r.json().catch(()=>({}));setStatus(d.state||'error');setStatusError(r.ok?'':(d.error||''));}
    catch(e){setStatus('error');setStatusError((e as Error).message);}
  };
  useEffect(()=>{void check();const t=window.setInterval(()=>void check(),7000);return()=>window.clearInterval(t);},[]);
  useEffect(()=>{if(connected){setQr('');void loadGroups();}},[connected]);

  const save=async()=>{
    setSaving(true);
    try{await onSaveWhatsApp({provider:'evolution',evolutionApiUrl:url.trim(),evolutionApiKey:key||undefined,evolutionInstance:instance.trim()});setKey('');notify('WhatsApp configurado.');await check();}
    catch(e){notify((e as Error).message);}finally{setSaving(false);}
  };

  const connect=async()=>{
    setBusy(true);
    try{const d=await read(await apiFetch('/api/whatsapp/connect',{method:'POST'}));setQr(d.qrcode||'');setStatus(d.state||'connecting');notify(d.qrcode?'Leia o QR Code com seu celular.':'Conexão iniciada.');}
    catch(e){notify((e as Error).message);}finally{setBusy(false);}
  };
  const refreshQr=async()=>{
    setBusy(true);
    try{const d=await read(await apiFetch('/api/whatsapp/qrcode'));setQr(d.qrcode||'');setStatus('connecting');}
    catch(e){notify((e as Error).message);}finally{setBusy(false);}
  };
  const loadGroups=async()=>{
    try{const d=await read(await apiFetch('/api/whatsapp/groups'));setGroups(Array.isArray(d)?d:[]);}
    catch(e){setGroups([]);}
  };
  const sendTest=async()=>{
    if(!selectedGroup)return;
    setTestBusy(true);
    try{await read(await apiFetch('/api/whatsapp/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selectedGroup,text:message})}));notify('Mensagem enviada com sucesso.');}
    catch(e){notify((e as Error).message);}finally{setTestBusy(false);}
  };

  const stateLabel=connected?'Conectado':status==='connecting'?'Aguardando leitura':configured?'Pronto para conectar':'Configuração necessária';
  const stateClass=connected?'text-emerald-300 bg-emerald-500/10 border-emerald-500/20':status==='connecting'?'text-amber-300 bg-amber-500/10 border-amber-500/20':'text-slate-300 bg-slate-800 border-slate-700';

  return <div className="mx-auto max-w-5xl space-y-6">
    {notice&&<div className="fixed right-5 top-20 z-50 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">{notice}</div>}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Primeiros passos</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Vamos deixar tudo funcionando.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Conecte seu WhatsApp uma vez. Depois, o painel cuida do restante.</p></div>
      <span className={"inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold "+stateClass}><span className={"h-2 w-2 rounded-full "+(connected?'bg-emerald-400':status==='connecting'?'bg-amber-400':'bg-slate-500')}/>{stateLabel}</span>
    </div>

    <div className={card+" p-6 sm:p-8"}>
      <div className="mb-7 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><MessageCircle className="h-5 w-5"/></div><div><h2 className="font-semibold text-white">1. Conecte o WhatsApp</h2><p className="mt-1 text-xs text-slate-400">Você só precisa fazer isso na primeira vez.</p></div></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div><label className="mb-1.5 block text-xs font-medium text-slate-300">Endereço da Evolution API</label><input value={url} onChange={e=>setUrl(e.target.value)} className={input} placeholder="http://localhost:8080"/><p className="mt-1.5 text-[11px] text-slate-500">Se você está usando a configuração local, deixe como está.</p></div>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-300">Chave da API</label><input value={key} onChange={e=>setKey(e.target.value)} type="password" className={input} placeholder={configured?'Chave já salva — não precisa preencher novamente':'Cole sua chave da Evolution API'}/></div>
          <div><label className="mb-1.5 block text-xs font-medium text-slate-300">Nome da conexão</label><input value={instance} onChange={e=>setInstance(e.target.value)} className={input}/></div>
          <button onClick={save} disabled={saving||!url||!instance||( !configured&&!key)} className={button+" bg-emerald-500 text-slate-950 hover:bg-emerald-400"}>{saving?<><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Salvando...</>:configured?'Salvar alterações':'Salvar e continuar'}</button>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-emerald-400"/> Seus dados ficam protegidos</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">A chave da API é armazenada no servidor e não é exibida novamente.</p>
        </div>
      </div>
    </div>

    <div className={card+" p-6 sm:p-8"}>
      <div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Smartphone className="h-5 w-5"/></div><div><h2 className="font-semibold text-white">2. Conecte seu celular</h2><p className="mt-1 text-xs text-slate-400">Clique no botão e escaneie o QR Code pelo WhatsApp.</p></div></div>
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_260px]">
        <div>
          {!configured?<div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center"><p className="text-sm text-slate-300">Primeiro salve a configuração acima.</p></div>:
          connected?<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"><Check className="h-5 w-5"/></div><div><p className="font-semibold text-white">WhatsApp conectado</p><p className="text-xs text-slate-400">Sua automação já pode enviar ofertas.</p></div></div></div>:
          <><button onClick={connect} disabled={busy} className={button+" bg-white text-slate-950 hover:bg-slate-200"}>{busy?<><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Gerando QR Code...</>:<><QrCode className="mr-2 inline h-4 w-4"/>Gerar QR Code</>}</button>{statusError&&<div className="mt-4 flex gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300"><CircleAlert className="h-4 w-4 shrink-0"/>{statusError}</div>}<ol className="mt-5 space-y-2 text-xs text-slate-400"><li><b className="text-white">1.</b> Abra o WhatsApp no celular.</li><li><b className="text-white">2.</b> Vá em <span className="text-slate-200">Aparelhos conectados → Conectar aparelho</span>.</li><li><b className="text-white">3.</b> Aponte a câmera para o código.</li></ol></>}
        </div>
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-800 bg-white p-4">
          {qr?<img src={qr} alt="QR Code para conectar o WhatsApp" className="h-56 w-56 object-contain"/>:<div className="text-center text-slate-400"><QrCode className="mx-auto h-12 w-12 text-slate-300"/><p className="mt-3 text-xs">{connected?'Conexão ativa':'O QR Code aparecerá aqui'}</p>{status==='connecting'&&<button onClick={refreshQr} className="mt-3 text-xs font-semibold text-emerald-600"><RefreshCw className="mr-1 inline h-3 w-3"/>Atualizar código</button>}</div>}
        </div>
      </div>
    </div>

    {connected&&<div className={card+" p-6 sm:p-8"}>
      <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Users className="h-5 w-5"/></div><div><h2 className="font-semibold text-white">3. Escolha onde enviar</h2><p className="mt-1 text-xs text-slate-400">Não precisa copiar nenhum código do WhatsApp.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><select value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)} className={input}><option value="">Selecione um grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.subject||g.id}</option>)}</select><button onClick={loadGroups} className={button+" border border-slate-700 text-white hover:bg-slate-800"}><RefreshCw className="mr-2 inline h-4 w-4"/>Atualizar grupos</button></div>
      {selectedGroup&&<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={message} onChange={e=>setMessage(e.target.value)} className={input}/><button onClick={sendTest} disabled={testBusy} className={button+" bg-emerald-500 text-slate-950 hover:bg-emerald-400"}>{testBusy?<Loader2 className="h-4 w-4 animate-spin"/>:<><Send className="mr-2 inline h-4 w-4"/>Enviar teste</>}</button></div>}
    </div>}

    {connected&&<div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-white">WhatsApp pronto.</p><p className="text-xs text-slate-500">Agora configure seus marketplaces e deixe as ofertas fluírem.</p></div><button onClick={()=>onNavigate('affiliates')} className={button+" bg-slate-800 text-white hover:bg-slate-700"}>Configurar marketplaces <ChevronRight className="ml-1 inline h-4 w-4"/></button></div>}
  </div>;
};