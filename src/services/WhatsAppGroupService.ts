export interface WhatsAppGroup { id:string; subject?:string; size?:number; owner?:string; creation?:number; participants?:any[]; }

export class WhatsAppGroupService {
  static async listGroups(settings?: {evolutionApiUrl?:string;evolutionApiKey?:string;evolutionInstance?:string}) {
    const base=(settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL||'').replace(/\/$/,'');
    const key=settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY;
    const instance=settings?.evolutionInstance || process.env.EVOLUTION_INSTANCE;
    if(!base||!key||!instance) throw new Error('Evolution API não configurada.');

    // Evolution v2 requires getParticipants to be explicitly present in the
    // query string. Do not fall back to the same endpoint without the query:
    // that fallback only hides the real API error and makes the UI misleading.
    const url=new URL('/group/fetchAllGroups/' + encodeURIComponent(instance), base + '/');
    url.searchParams.set('getParticipants','true');
    const res=await fetch(url.toString(),{headers:{apikey:key}});
    const body=await res.text();
    let parsed:any={};
    try { parsed=body ? JSON.parse(body) : {}; } catch {}
    if(!res.ok) {
      const apiMessage=Array.isArray(parsed?.response?.message)
        ? parsed.response.message.join(', ')
        : parsed?.message || parsed?.error || body;
      throw new Error('Não foi possível listar grupos pela Evolution API: HTTP '+res.status+': '+String(apiMessage).slice(0,500));
    }
    const groups=Array.isArray(parsed)?parsed:(parsed?.groups||parsed?.response||[]);
    if(!Array.isArray(groups)) throw new Error('A Evolution API respondeu em formato inesperado ao listar grupos.');
    return groups as WhatsAppGroup[];
  }
}
