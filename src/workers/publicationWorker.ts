import 'dotenv/config';
import { Worker } from 'bullmq';
import { query } from '../infrastructure/database.ts';
import { requireRedis } from '../infrastructure/redis.ts';
import { enqueuePublication } from '../infrastructure/queue.ts';
import { WhatsAppProvider } from '../services/WhatsAppProvider.ts';
import { DeduplicationService } from '../services/DeduplicationService.ts';
import { AutomationScheduler } from '../services/AutomationScheduler.ts';
import { MarketplaceDiscoveryScheduler } from '../services/MarketplaceDiscoveryScheduler.ts';
import { AccountHealthService } from '../services/AccountHealthService.ts';
import { ConversionSyncService } from '../services/ConversionSyncService.ts';
import { AuditService } from '../services/AuditService.ts';
import { WhatsAppSettingsService } from '../services/WhatsAppSettingsService.ts';
import type { Destination, Publication } from '../types/affiliate.ts';

const connection=requireRedis();
const RETRYABLE=/timeout|timed out|network|econn|eai_|http (408|429|500|502|503|504)|temporar|indisponível/i;

function classify(error:string){ return RETRYABLE.test(error) ? 'RETRYABLE_ERROR' : 'PERMANENT_ERROR'; }

const worker=new Worker('affiliate-publications',async job=>{
  const rows=await query<any>('SELECT * FROM publications WHERE id=$1',[job.data.publicationId]);
  if(!rows[0]) return { skipped:true, reason:'publication_deleted' };
  const row=rows[0];
  if(['SENT','CANCELLED','EXPIRED'].includes(row.status)) return { skipped:true, status:row.status };

  const claimed=await query<any>(
    "UPDATE publications SET status='PROCESSING',attempt=COALESCE(attempt,0)+1,updated_at=NOW() WHERE id=$1 AND status IN ('QUEUED','SCHEDULED','RETRYING') RETURNING *",
    [row.id]
  );
  if(!claimed[0]) return { skipped:true, reason:'already_claimed' };
  const current=claimed[0];

  try {
    const destinations=await query<any>('SELECT * FROM destinations WHERE id=$1 AND workspace_id=$2 AND is_active=true',[current.destination_id,current.workspace_id]);
    if(!destinations[0]) throw new Error('Destino inexistente, inativo ou fora do workspace.');
    const d=destinations[0];
    const destination:Destination={id:d.id,workspace_id:d.workspace_id,type:d.type,identifier:d.identifier,name:d.name,
      categories:d.config.categories||[],marketplaces:d.config.marketplaces||[],keywords:d.config.keywords||[],tags:d.config.tags||d.config.keywords||[],
      frequency_minutes:d.config.frequency_minutes||60,time_start:d.config.time_start||'08:00',time_end:d.config.time_end||'22:00',
      priority:d.config.priority||'NORMAL',is_active:d.is_active};

    const stateRows=await query<{state:any}>('SELECT state FROM workspace_state WHERE workspace_id=$1',[current.workspace_id]);
    const workspaceState=stateRows[0]?.state||{};
    const stateOffer=workspaceState.offers?.find((item:any)=>item.id===current.offer_id);
    if(!stateOffer || !stateOffer.affiliate_url) throw new Error('Oferta removida ou sem link afiliado válido; publicação cancelada.');
    if(stateOffer.product?.metadata?.coupon_status && !['AVAILABLE','EXPIRING'].includes(stateOffer.product.metadata.coupon_status as string)) {
      throw new Error('Cupom não está confirmado como disponível; publicação bloqueada.');
    }

    const forcePublication = String(current.idempotency_key || '').includes(':force:');
    if (!forcePublication && stateOffer.product?.external_product_id) {
      const dedup = await DeduplicationService.isDuplicate(
        current.workspace_id,
        stateOffer.marketplace,
        stateOffer.product.external_product_id,
        current.destination_id,
        stateOffer.product.shop_id,
        24,
      );
      if (dedup.isDuplicate) {
        const reason = `Deduplicação: produto já publicado neste destino em ${dedup.lastPublishedAt}. A publicação foi cancelada para evitar repetição.`;
        await query("UPDATE publications SET status='CANCELLED',error=$2,last_error_code='DUPLICATE_PUBLICATION',next_retry_at=NULL,updated_at=NOW() WHERE id=$1 AND status='PROCESSING'", [current.id, reason]);
        const statePub = workspaceState.publications?.find((item:any)=>item.id===current.id);
        if (statePub) { statePub.status='CANCELLED'; statePub.error_message=reason; }
        if (workspaceState.publications) await query('UPDATE workspace_state SET state=$2,updated_at=NOW() WHERE workspace_id=$1',[current.workspace_id,JSON.stringify(workspaceState)]);
        return { skipped:true, reason:'duplicate_publication', lastPublishedAt:dedup.lastPublishedAt };
      }
    }

    const publication:Publication={id:current.id,workspace_id:current.workspace_id,offer_id:current.offer_id,destination_id:current.destination_id,
      affiliate_link_id:current.affiliate_link_id||'unknown',affiliate_url:current.affiliate_url,image_url:stateOffer.product?.image||undefined,
      image_title:stateOffer.product?.title||'Oferta',
      message:current.message,status:'PROCESSING',scheduled_at:new Date(current.scheduled_at||current.created_at).toISOString()};

    const settings=await WhatsAppSettingsService.get(current.workspace_id);
    const result=await new WhatsAppProvider(undefined,undefined,settings).sendPublication(publication,destination);
    if(!result.success) throw new Error(result.error||'Provider failed');

    await query("UPDATE publications SET status='SENT',provider_message_id=$2,published_at=NOW(),error=NULL,next_retry_at=NULL,updated_at=NOW() WHERE id=$1 AND status='PROCESSING'",[current.id,result.messageId||null]);
    const state=workspaceState;
    const statePub=state.publications?.find((item:any)=>item.id===current.id);
    if(statePub){statePub.status='SENT';statePub.sent_at=new Date().toISOString();statePub.error_message=undefined;}
    if(state.publications) await query('UPDATE workspace_state SET state=$2,updated_at=NOW() WHERE workspace_id=$1',[current.workspace_id,JSON.stringify(state)]);

    const offer=state.offers?.find((item:any)=>item.id===current.offer_id);
    if(offer){
      const link=state.links?.find((item:any)=>item.id===current.affiliate_link_id);
      await AuditService.logPublicationTrace({offer,destination,publication:{...publication,status:'SENT',sent_at:new Date().toISOString()},affiliateAccountId:link?.affiliate_account_id||'unknown'});
      if(offer.product?.external_product_id) await DeduplicationService.recordPublication(current.workspace_id,current.id,offer.marketplace,offer.product.external_product_id,current.destination_id,offer.product.shop_id);
    }
    return {messageId:result.messageId};
  } catch(error) {
    const message=error instanceof Error?error.message:String(error);
    const kind=classify(message);
    const finalAttempt=Number(current.attempt||1)>=Number(current.max_attempts||3) || kind==='PERMANENT_ERROR' || job.attemptsMade+1>=Number(job.opts.attempts||3);
    const status=finalAttempt?'FAILED':'RETRYING';
    const nextRetryAt=finalAttempt?null:new Date(Date.now()+([30000,120000,600000][Math.min(Number(current.attempt||1)-1,2)]||600000));
    await query('UPDATE publications SET status=$2,error=$3,last_error_code=$4,next_retry_at=$5,updated_at=NOW() WHERE id=$1',[current.id,status,message,kind,nextRetryAt]);
    const stateRows=await query<{state:any}>('SELECT state FROM workspace_state WHERE workspace_id=$1',[current.workspace_id]);
    const state=stateRows[0]?.state;
    const statePub=state?.publications?.find((item:any)=>item.id===current.id);
    if(statePub){statePub.status=status;statePub.error_message=message;}
    if(state) await query('UPDATE workspace_state SET state=$2,updated_at=NOW() WHERE workspace_id=$1',[current.workspace_id,JSON.stringify(state)]);
    throw error;
  }
},{connection,concurrency:Number(process.env.WORKER_CONCURRENCY||5)});

worker.on('failed',(job,err)=>console.error(JSON.stringify({event:'publication_failed',jobId:job?.id,publicationId:job?.data?.publicationId,attempt:job?.attemptsMade,error:err.message})));
worker.on('error',err=>console.error(JSON.stringify({event:'worker_error',error:err.message})));
async function normalizeLegacyDuplicateFailures() {
  try {
    const rows = await query<{id:string;workspace_id:string;error:string}>(
      "UPDATE publications SET status='CANCELLED',last_error_code='DUPLICATE_PUBLICATION',updated_at=NOW() WHERE status='FAILED' AND (error ILIKE '%Deduplicação ativada%' OR error ILIKE '%produto já foi publicado%') RETURNING id,workspace_id,error",
    );
    for (const row of rows) {
      const stateRows = await query<{state:any}>('SELECT state FROM workspace_state WHERE workspace_id=$1',[row.workspace_id]);
      const state = stateRows[0]?.state;
      const pub = state?.publications?.find((item:any)=>item.id===row.id);
      if (pub) { pub.status='CANCELLED'; pub.error_message=row.error; }
      if (state) await query('UPDATE workspace_state SET state=$2,updated_at=NOW() WHERE workspace_id=$1',[row.workspace_id,JSON.stringify(state)]);
    }
    if (rows.length) console.log('Normalized legacy duplicate publication failures:', rows.length);
  } catch (error) {
    console.error('Legacy duplicate publication normalization failed:', error);
  }
}

const maintenanceIntervalMs=Math.max(300000,Number(process.env.MAINTENANCE_INTERVAL_MS||3600000));
void DeduplicationService.purgeOldRecords(Number(process.env.DEDUP_RETENTION_DAYS||30)).catch(error=>console.error('Initial dedup cleanup failed:',error));
void normalizeLegacyDuplicateFailures();
void AccountHealthService.tick().catch(error=>console.error('Initial account health check failed:',error));
void ConversionSyncService.tick().catch(error=>console.error('Initial conversion sync failed:',error));
setInterval(()=>{void DeduplicationService.purgeOldRecords(Number(process.env.DEDUP_RETENTION_DAYS||30)).catch(error=>console.error('Dedup cleanup failed:',error));void AccountHealthService.tick().catch(error=>console.error('Account health check failed:',error));void ConversionSyncService.tick().catch(error=>console.error('Conversion sync failed:',error));},maintenanceIntervalMs);
const discoveryIntervalMs=Math.max(60000,Number(process.env.DISCOVERY_INTERVAL_MS||900000));
void MarketplaceDiscoveryScheduler.tick().catch(error=>console.error('Initial marketplace discovery failed:',error));
setInterval(()=>void MarketplaceDiscoveryScheduler.tick().then(count=>{if(count)console.log('Marketplace discovery processed',count,'offer(s).');}).catch(error=>console.error('Marketplace discovery failed:',error)),discoveryIntervalMs);
const schedulerIntervalMs=Math.max(15000,Number(process.env.SCHEDULER_INTERVAL_MS||60000));
void AutomationScheduler.tick().catch(error=>console.error('Initial automation scheduler tick failed:',error));
setInterval(()=>void AutomationScheduler.tick().then(created=>{if(created)console.log('Automation scheduler queued',created,'publication(s).');}).catch(error=>console.error('Automation scheduler tick failed:',error)),schedulerIntervalMs);

async function shutdown(){ await worker.close(); try{await connection.quit();}catch{} process.exit(0); }
process.once('SIGTERM',()=>void shutdown()); process.once('SIGINT',()=>void shutdown());
async function recoverQueuedPublications() {
  const rows = await query<any>(
    "SELECT id,destination_id,offer_id,scheduled_at,next_retry_at,status FROM publications WHERE status IN ('QUEUED','SCHEDULED','RETRYING') ORDER BY COALESCE(next_retry_at,scheduled_at) ASC LIMIT 500",
  );
  let recovered = 0;
  for (const row of rows) {
    try {
      await enqueuePublication({
        publicationId: row.id,
        destinationId: row.destination_id,
        offerId: row.offer_id,
        scheduledAt: row.status === 'RETRYING' && row.next_retry_at ? row.next_retry_at : row.scheduled_at,
      });
      recovered++;
    } catch (error) {
      console.error(JSON.stringify({
        event: 'publication_recovery_failed',
        publicationId: row.id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  if (recovered) console.log('Publication queue recovery re-enqueued', recovered, 'publication(s).');
}

await worker.waitUntilReady();
await recoverQueuedPublications().catch(error => console.error('Initial publication queue recovery failed:', error));
setInterval(() => void recoverQueuedPublications().catch(error => console.error('Publication queue recovery failed:', error)), 30000);
console.log('Publication worker running and connected to Redis.');
