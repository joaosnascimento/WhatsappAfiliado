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
      if(s.provider==='evolution' && (!s.evolutionApiUrl||!s.evolutionApiKey||!s.evolutionInstance)) throw new Error('Evolution API não configurada.');
    });
    const database=await check('postgres',async()=>{await query('SELECT 1');},Boolean(process.env.DATABASE_URL));
    const redisHealth=await check('redis',async()=>{if(!redis) throw new Error('REDIS_URL não configurada.'); await redis.ping();},Boolean(process.env.REDIS_URL));
    const shopee=await check('shopee',async()=>{},Boolean(process.env.SHOPEE_AFFILIATE_APP_ID&&process.env.SHOPEE_AFFILIATE_SECRET));
    const gemini=await check('gemini',async()=>{},Boolean(process.env.GEMINI_API_KEY));
    const ml=await check('mercadolivre',async()=>{},true);
    return {status:[database,redisHealth,whatsapp].some(x=>x.status==='degraded'||x.status==='down')?'degraded':'ok',checks:{database,redis:redisHealth,whatsapp,mercadolivre:ml,shopee,gemini},timestamp:new Date().toISOString()};
  }
}