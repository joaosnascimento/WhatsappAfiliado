export interface WhatsAppGroup { id:string; subject?:string; size?:number; owner?:string; creation?:number; participants?:any[]; }

type EvolutionSettings = { evolutionApiUrl?:string; evolutionApiKey?:string; evolutionInstance?:string };

export function buildEvolutionGroupsUrl(base:string, instance:string): string {
  const url=new URL('/group/fetchAllGroups/' + encodeURIComponent(instance), base.replace(/\\/$/,'') + '/');
  url.searchParams.set('getParticipants','true');
  return url.toString();
}

export class WhatsAppGroupService {
  static async listGroups(settings?: EvolutionSettings) {
    const base=(settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL||'').replace(/\/$/,'');
    const key=settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY;
    const instance=settings?.evolutionInstance || process.env.EVOLUTION_INSTANCE;
    if(!base||!key||!instance) throw new Error('Evolution API não configurada.');

    const url=new URL('/group/fetchAllGroups/' + encodeURIComponent(instance), base + '/');
    url.searchParams.set('getParticipants','true');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Number(process.env.OUTBOUND_REQUEST_TIMEOUT_MS||15000));
    try {
      const res=await fetch(url.toString(),{headers:{apikey:key},signal:controller.signal});
      const body=await res.text();
      let parsed:any={}; try { parsed=body ? JSON.parse(body) : {}; } catch {}
      if(!res.ok) {
        const apiMessage=Array.isArray(parsed?.response?.message) ? parsed.response.message.join(', ') : parsed?.message || parsed?.error || body;
        const retryable=[408,429,500,502,503,504].includes(res.status);
        const err=new Error('Não foi possível listar grupos pela Evolution API: HTTP '+res.status+': '+String(apiMessage).slice(0,500));
        (err as any).status=res.status; (err as any).retryable=retryable;
        throw err;
      }
      const groups=Array.isArray(parsed)?parsed:(parsed?.groups||parsed?.response||[]);
      if(!Array.isArray(groups)) throw new Error('A Evolution API respondeu em formato inesperado ao listar grupos.');
      return groups as WhatsAppGroup[];
    } catch (error) {
      if(error instanceof Error && error.name==='AbortError') {
        const e=new Error('Timeout ao consultar os grupos da Evolution API.'); (e as any).retryable=true; throw e;
      }
      throw error;
    } finally { clearTimeout(timer); }
  }
}