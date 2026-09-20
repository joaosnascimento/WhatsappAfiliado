import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, CircleAlert, Loader2, MessageCircle, QrCode, RefreshCw, Send, ShieldCheck, Smartphone, Users } from 'lucide-react';

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
interface SetupTabProps { apiFetch: ApiFetch; whatsappSettings: any; onSaveWhatsApp: (settings:any)=>Promise<void>; onNavigate: (tab:string)=>void; }
type Group = { id:string; subject?:string; size?:number };

const input = "w-full rounded-md border border-border-strong bg-bg px-4 py-3 text-sm text-text outline-none focus:border-brand-500 focus:ring-2 focus:ring-emerald-500/10";
const card = "rounded-lg border border-border bg-surface-1";
const button = "rounded-md px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

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
    try{const r=await apiFetch('/api/whatsapp/status');const d=await r.json().catch(()=>({}));setStatus(d.state||'error');setStatusError(r.ok?'':(d.error||''));if((d.state||'').toLowerCase()!=='open'){setQr('');setGroups([]);setSelectedGroup('');}}
    catch(e){setStatus('error');setStatusError((e as Error).message);setQr('');setGroups([]);setSelectedGroup('');}
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
    try{const d=await read(await apiFetch('/api/whatsapp/connect',{method:'POST'}));setQr(d.qrcode||'');setStatus(d.state||'connecting');setStatusError('');notify(d.state==='open'?'WhatsApp já estava conectado.':d.qrcode?'Leia o QR Code com seu celular.':'Reconexão iniciada.');}
    catch(e){setStatus('error');setStatusError((e as Error).message);notify((e as Error).message);}finally{setBusy(false);}
  };
  const disconnect=async()=>{
    setBusy(true);
    try{await read(await apiFetch('/api/whatsapp/disconnect',{method:'POST'}));setQr('');setGroups([]);setSelectedGroup('');setStatus('close');setStatusError('');notify('WhatsApp desconectado. Você pode reconectar quando quiser.');}
    catch(e){notify((e as Error).message);}finally{setBusy(false);}
  };
  const refreshQr=async()=>{
    setBusy(true);
    try{const d=await read(await apiFetch('/api/whatsapp/qrcode'));setQr(d.qrcode||'');setStatus('connecting');}
    catch(e){notify((e as Error).message);}finally{setBusy(false);}
  };
  const loadGroups=async()=>{
    try{const d=await read(await apiFetch('/api/whatsapp/groups'));setGroups(Array.isArray(d)?d:[]);}
    catch(e){setGroups([]);notify((e as Error).message);}
  };
  const sendTest=async()=>{
    if(!selectedGroup)return;
    setTestBusy(true);
    try{await read(await apiFetch('/api/whatsapp/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:selectedGroup,text:message})}));notify('Mensagem enviada com sucesso.');}
    catch(e){notify((e as Error).message);}finally{setTestBusy(false);}
  };

  const stateLabel=connected?'Conectado':status==='connecting'?'Aguardando leitura':configured?'Pronto para conectar':'Configuração necessária';
  const stateClass=connected?'text-brand-200 bg-brand-500/10 border-brand-500/20':status==='connecting'?'text-amber-300 bg-amber-500/10 border-amber-500/20':'text-text bg-surface-2 border-border-strong';

  return <div className="w-full space-y-6">
    {notice&&<div className="fixed right-5 top-20 z-50 rounded-md border border-border-strong bg-surface-1 px-4 py-3 text-sm text-text shadow-2xl">{notice}</div>}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Primeiros passos</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-text">Vamos deixar tudo funcionando.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Conecte seu WhatsApp uma vez. Depois, o painel cuida do restante.</p></div>
      <span className={"inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold "+stateClass}><span className={"h-2 w-2 rounded-full "+(connected?'bg-emerald-400':status==='connecting'?'bg-amber-400':'bg-slate-500')}/>{stateLabel}</span>
    </div>

    <div className={card+" p-6 sm:p-8"}>
      <div className="mb-7 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-300"><MessageCircle className="h-5 w-5"/></div><div><h2 className="font-semibold text-text">1. Conecte o WhatsApp</h2><p className="mt-1 text-sm text-muted">Você só precisa fazer isso na primeira vez.</p></div></div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div><label className="mb-1.5 block text-sm font-medium text-text">Endereço da Evolution API</label><input value={url} onChange={e=>setUrl(e.target.value)} className={input} placeholder="http://localhost:8080"/><p className="mt-1.5 text-xs text-subtle">Se você está usando a configuração local, deixe como está.</p></div>
          <div><label className="mb-1.5 block text-sm font-medium text-text">Chave da API</label><input value={key} onChange={e=>setKey(e.target.value)} type="password" className={input} placeholder={configured?'Chave já salva — não precisa preencher novamente':'Cole sua chave da Evolution API'}/></div>
          <div><label className="mb-1.5 block text-sm font-medium text-text">Nome da conexão</label><input value={instance} onChange={e=>setInstance(e.target.value)} className={input}/></div>
          <button onClick={save} disabled={saving||!url||!instance||( !configured&&!key)} className={button+" bg-brand-500 text-bg hover:bg-brand-400"}>{saving?<><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Salvando...</>:configured?'Salvar alterações':'Salvar e continuar'}</button>
        </div>
        <div className="rounded-lg border border-border bg-bg p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text"><ShieldCheck className="h-4 w-4 text-brand-300"/> Seus dados ficam protegidos</div>
          <p className="mt-2 text-sm leading-5 text-subtle">A chave da API é armazenada no servidor e não é exibida novamente.</p>
        </div>
      </div>
    </div>

    <div className={card+" p-6 sm:p-8"}>
      <div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-300"><Smartphone className="h-5 w-5"/></div><div><h2 className="font-semibold text-text">2. Conecte seu celular</h2><p className="mt-1 text-sm text-muted">Clique no botão e escaneie o QR Code pelo WhatsApp.</p></div></div>
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_260px]">
        <div>
          {!configured?<div className="rounded-lg border border-dashed border-border-strong p-6 text-center"><p className="text-sm text-text">Primeiro salve a configuração acima.</p></div>:
          connected?<div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/15 text-brand-300"><Check className="h-5 w-5"/></div><div><p className="font-semibold text-text">WhatsApp conectado</p><p className="text-sm text-muted">Sua automação já pode enviar ofertas.</p></div></div><button onClick={disconnect} disabled={busy} className={button+" border border-red-500/30 text-red-300 hover:bg-red-500/10"}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:'Desconectar'}</button></div></div>:
          <><div className="flex flex-wrap gap-2"><button onClick={connect} disabled={busy} className={button+" bg-white text-bg hover:bg-slate-200"}>{busy?<><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Reconectando...</>:<><QrCode className="mr-2 inline h-4 w-4"/>{status==='close'||status==='error'?'Reconectar':'Gerar QR Code'}</>}</button>{status==='connecting'&&<button onClick={refreshQr} disabled={busy} className={button+" border border-border-strong text-text hover:bg-surface-2"}><RefreshCw className="mr-2 inline h-4 w-4"/>Atualizar QR</button>}</div>{statusError&&<div className="mt-4 flex gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"><CircleAlert className="h-4 w-4 shrink-0"/><span>{statusError}</span></div>}<ol className="mt-5 space-y-2 text-sm text-muted"><li><b className="text-text">1.</b> Abra o WhatsApp no celular.</li><li><b className="text-text">2.</b> Vá em <span className="text-text">Aparelhos conectados → Conectar aparelho</span>.</li><li><b className="text-text">3.</b> Aponte a câmera para o código.</li></ol></>}
        </div>
        <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-border bg-white p-4">
          {qr?<img src={qr} alt="QR Code para conectar o WhatsApp" className="h-56 w-56 object-contain"/>:<div className="text-center text-muted"><QrCode className="mx-auto h-12 w-12 text-text"/><p className="mt-3 text-sm">{connected?'Conexão ativa':'O QR Code aparecerá aqui'}</p>{status==='connecting'&&<button onClick={refreshQr} className="mt-3 text-sm font-semibold text-emerald-600"><RefreshCw className="mr-1 inline h-3 w-3"/>Atualizar código</button>}</div>}
        </div>
      </div>
    </div>

    {connected&&<div className={card+" p-6 sm:p-8"}>
      <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-300"><Users className="h-5 w-5"/></div><div><h2 className="font-semibold text-text">3. Escolha onde enviar</h2><p className="mt-1 text-sm text-muted">Não precisa copiar nenhum código do WhatsApp.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><select value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)} className={input}><option value="">Selecione um grupo</option>{groups.map(g=><option key={g.id} value={g.id}>{g.subject||g.id}</option>)}</select><button onClick={loadGroups} className={button+" border border-border-strong text-text hover:bg-surface-2"}><RefreshCw className="mr-2 inline h-4 w-4"/>Atualizar grupos</button></div>
      {selectedGroup&&<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={message} onChange={e=>setMessage(e.target.value)} className={input}/><button onClick={sendTest} disabled={testBusy} className={button+" bg-brand-500 text-bg hover:bg-brand-400"}>{testBusy?<Loader2 className="h-4 w-4 animate-spin"/>:<><Send className="mr-2 inline h-4 w-4"/>Enviar teste</>}</button></div>}
    </div>}

    {connected&&<div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1/50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-text">WhatsApp pronto.</p><p className="text-xs text-subtle">Agora configure seus marketplaces e deixe as ofertas fluírem.</p></div><button onClick={()=>onNavigate('affiliates')} className={button+" bg-surface-2 text-text hover:bg-surface-3 border-border-strong"}>Configurar marketplaces <ChevronRight className="ml-1 inline h-4 w-4"/></button></div>}
  </div>;
};