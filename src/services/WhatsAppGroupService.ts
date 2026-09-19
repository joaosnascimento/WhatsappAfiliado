export interface WhatsAppGroup { id:string; subject?:string; size?:number; owner?:string; creation?:number; participants?:any[]; }

export class WhatsAppGroupService {
  static async listGroups(settings?: {evolutionApiUrl?:string;evolutionApiKey?:string;evolutionInstance?:string}) {
    const base=(settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL||'').replace(/\/$/,'');
    const key=settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY;
    const instance=settings?.evolutionInstance || process.env.EVOLUTION_INSTANCE;
    if(!base||!key||!instance) throw new Error('Evolution API não configurada.');
    const candidates=[
      `/group/fetchAllGroups/${encodeURIComponent(instance)}?getParticipants=true`,
      `/group/fetchAllGroups/${encodeURIComponent(instance)}`
    ];
    let last='';
    for(const endpoint of candidates){
      const res=await fetch(base+endpoint,{headers:{apikey:key}});
      const body=await res.text();
      if(res.ok){
        const data=JSON.parse(body);
        const groups=Array.isArray(data)?data:(data?.groups||data?.response||[]);
        return groups as WhatsAppGroup[];
      }
      last=`HTTP ${res.status}: ${body}`;
    }
    throw new Error('Não foi possível listar grupos pela Evolution API: '+last);
  }
}
