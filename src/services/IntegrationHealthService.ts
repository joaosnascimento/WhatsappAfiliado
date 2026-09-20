import { query } from '../infrastructure/database.ts';
import { redis } from '../infrastructure/redis.ts';
import { WhatsAppSettingsService } from './WhatsAppSettingsService.ts';

export interface HealthCheck { status:'ok'|'degraded'|'down'|'not_configured'; lastCheck:string; latency:number; error?:string; canRetry:boolean; requiresAction:boolean; }

async function check(name:string,fn:()=>Promise<void>,configured=true):Promise<HealthCheck>{
  const started=Date.now(), lastCheck=new Date().toISOString();
  if(!configured) return {status:'not_configured',lastCheck,latency:0,canRetry:false,requiresAction:true};
  try { await fn(); return {status:'ok',lastCheck,latency:Date.now()-started,canRetry:true,requiresAction:false}; }
  catch(error){ return {status:'degraded',lastCheck,latency:Date.now()-started,error:error instanceof Error?error.message:String(error),canRetry:true,requiresAction:true}; }
}

export class IntegrationHealthService {
  static async check(workspaceId:string){
    const whatsapp=await check('whatsapp',async()=>{
      const s=await WhatsAppSettingsService.get(workspaceId);
      if(s.provider==='evolution') {
        if(!s.evolutionApiUrl||!s.evolutionApiKey||!s.evolutionInstance) throw new Error('Evolution API não configurada.');
        const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),5000);
        try {
          const response=await fetch(s.evolutionApiUrl.replace(/\/$/,'')+'/instance/connectionState/'+encodeURIComponent(s.evolutionInstance),{headers:{apikey:s.evolutionApiKey},signal:controller.signal});
          if(!response.ok) throw new Error('Evolution API respondeu HTTP '+response.status+'.');
          const data=await response.json().catch(()=>({}));
          const state=String(data?.instance?.state || data?.state || '').toLowerCase();
          if(state!=='open') throw new Error('WhatsApp não está conectado (estado: '+(state||'desconhecido')+').');
        } finally { clearTimeout(timer); }
      }
    });
    const database=await check('postgres',async()=>{await query('SELECT 1');},Boolean(process.env.DATABASE_URL));
    const redisHealth=await check('redis',async()=>{if(!redis) throw new Error('REDIS_URL não configurada.'); await redis.ping();},Boolean(process.env.REDIS_URL));
    const shopeeConfigured=Boolean(process.env.SHOPEE_AFFILIATE_APP_ID&&process.env.SHOPEE_AFFILIATE_SECRET);
    const shopee=await check('shopee',async()=>{ const rows=await query<any>("SELECT 1 FROM marketplace_accounts WHERE workspace_id=$1 AND marketplace='SHOPEE' LIMIT 1",[workspaceId]); if(!rows[0] && !shopeeConfigured) throw new Error('Shopee não configurada.'); },true);
const gemini=await check('gemini',async()=>{},Boolean(process.env.GEMINI_API_KEY));
    const ml=await check('mercadolivre',async()=>{ const rows=await query<any>("SELECT status,credentials_encrypted FROM marketplace_accounts WHERE workspace_id=$1 AND marketplace='MERCADOLIVRE' LIMIT 1",[workspaceId]); if(!rows[0]) throw new Error('Conta Mercado Livre não configurada.'); const status=String(rows[0].status||''); if(status==='AUTH_ERROR'||status==='TOKEN_EXPIRED') throw new Error('Sessão do Mercado Livre requer reconexão.'); });
    const checks=[database,redisHealth,whatsapp,ml,shopee,gemini];
    const overallStatus=checks.some(x=>x.status==='down')?'down':checks.some(x=>x.status==='degraded'||x.status==='not_configured')?'degraded':'ok';
    return {status:overallStatus,checks:{database,redis:redisHealth,whatsapp,mercadolivre:ml,shopee,gemini},timestamp:new Date().toISOString()};
  }
}