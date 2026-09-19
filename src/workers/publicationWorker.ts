import 'dotenv/config';
import { Worker } from 'bullmq';
import { query } from '../infrastructure/database.ts';
import { requireRedis } from '../infrastructure/redis.ts';
import { WhatsAppProvider } from '../services/WhatsAppProvider.ts';
import { DeduplicationService } from '../services/DeduplicationService.ts';
import { AutomationScheduler } from '../services/AutomationScheduler.ts';
import { MarketplaceDiscoveryScheduler } from '../services/MarketplaceDiscoveryScheduler.ts';
import { AccountHealthService } from '../services/AccountHealthService.ts';
import { ConversionSyncService } from '../services/ConversionSyncService.ts';
import type { Destination, Publication } from '../types/affiliate.ts';

const connection = requireRedis();
const worker = new Worker('affiliate-publications', async job => {
  const rows = await query<any>('SELECT * FROM publications WHERE id=$1', [job.data.publicationId]);
  if (!rows[0]) throw new Error('Publication not found: ' + job.data.publicationId);
  const row = rows[0];
  await query("UPDATE publications SET status='PROCESSING' WHERE id=$1 AND status IN ('QUEUED','SCHEDULED')", [row.id]);

  const destinations = await query<any>('SELECT * FROM destinations WHERE id=$1 AND workspace_id=$2', [row.destination_id, row.workspace_id]);
  if (!destinations[0]) throw new Error('Destination not found or outside workspace.');
  const d = destinations[0];
  const destination: Destination = {
    id:d.id, workspace_id:d.workspace_id, type:d.type, identifier:d.identifier, name:d.name,
    categories:d.config.categories || [], marketplaces:d.config.marketplaces || [], keywords:d.config.keywords || [],
    frequency_minutes:d.config.frequency_minutes || 60, time_start:d.config.time_start || '08:00',
    time_end:d.config.time_end || '22:00', priority:d.config.priority || 'NORMAL', is_active:d.is_active
  };
  const publication: Publication = {
    id:row.id, offer_id:row.offer_id, destination_id:row.destination_id,
    affiliate_link_id:row.affiliate_link_id || 'unknown', affiliate_url:row.affiliate_url,
    message:row.message, status:'QUEUED', scheduled_at:new Date(row.scheduled_at || row.created_at).toISOString()
  };
  const result = await new WhatsAppProvider().sendPublication(publication, destination);
  if (!result.success) {
    const errorMessage = result.error || 'Provider failed';
    await query("UPDATE publications SET status='FAILED', error=$2 WHERE id=$1", [row.id, errorMessage]);
    const failedStateRows = await query<{ state: any }>('SELECT state FROM workspace_state WHERE workspace_id=$1', [row.workspace_id]);
    const failedState = failedStateRows[0]?.state;
    const failedPub = failedState?.publications?.find((item: any) => item.id === row.id);
    if (failedPub) {
      failedPub.status = 'FAILED';
      failedPub.error_message = errorMessage;
      await query('UPDATE workspace_state SET state=$2, updated_at=NOW() WHERE workspace_id=$1', [row.workspace_id, JSON.stringify(failedState)]);
    }
    throw new Error(errorMessage);
  }
  await query("UPDATE publications SET status='SENT', provider_message_id=$2, published_at=NOW(), error=NULL WHERE id=$1", [row.id, result.messageId || null]);

  const stateRows = await query<{ state: any }>('SELECT state FROM workspace_state WHERE workspace_id=$1', [row.workspace_id]);
  const state = stateRows[0]?.state;
  const statePub = state?.publications?.find((item: any) => item.id === row.id);
  if (statePub) {
    statePub.status = 'SENT';
    statePub.sent_at = new Date().toISOString();
    statePub.error_message = undefined;
  }
  if (state) {
    await query('UPDATE workspace_state SET state=$2, updated_at=NOW() WHERE workspace_id=$1', [row.workspace_id, JSON.stringify(state)]);
  }
  const offer = state?.offers?.find((item: any) => item.id === row.offer_id);
  if (offer?.product?.external_product_id) {
    await DeduplicationService.recordPublication(
      row.workspace_id,
      row.id,
      offer.marketplace,
      offer.product.external_product_id,
      row.destination_id,
      offer.product.shop_id,
    );
  }

  return { messageId: result.messageId };
}, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 5) });

worker.on('failed', (job, err) => console.error('Publication job failed', job?.id, err.message));
console.log('Publication worker running.');

const maintenanceIntervalMs = Math.max(300000, Number(process.env.MAINTENANCE_INTERVAL_MS || 3600000));
void DeduplicationService.purgeOldRecords(Number(process.env.DEDUP_RETENTION_DAYS || 30)).catch(error => console.error('Initial dedup cleanup failed:', error));
void AccountHealthService.tick().catch(error => console.error('Initial account health check failed:', error));
void ConversionSyncService.tick().catch(error => console.error('Initial conversion sync failed:', error));
setInterval(() => {
  void DeduplicationService.purgeOldRecords(Number(process.env.DEDUP_RETENTION_DAYS || 30))
    .catch(error => console.error('Dedup cleanup failed:', error));
  void AccountHealthService.tick()
    .catch(error => console.error('Account health check failed:', error));
  void ConversionSyncService.tick()
    .catch(error => console.error('Conversion sync failed:', error));
}, maintenanceIntervalMs);

const discoveryIntervalMs = Math.max(60000, Number(process.env.DISCOVERY_INTERVAL_MS || 900000));
void MarketplaceDiscoveryScheduler.tick().catch(error => console.error('Initial marketplace discovery failed:', error));
setInterval(() => {
  void MarketplaceDiscoveryScheduler.tick()
    .then(count => { if (count) console.log('Marketplace discovery processed', count, 'offer(s).'); })
    .catch(error => console.error('Marketplace discovery failed:', error));
}, discoveryIntervalMs);

// The scheduler is DB-idempotent, so multiple worker replicas may run this tick safely.
const schedulerIntervalMs = Math.max(15000, Number(process.env.SCHEDULER_INTERVAL_MS || 60000));
void AutomationScheduler.tick().catch(error => console.error('Initial automation scheduler tick failed:', error));
setInterval(() => {
  void AutomationScheduler.tick()
    .then(created => { if (created) console.log('Automation scheduler queued', created, 'publication(s).'); })
    .catch(error => console.error('Automation scheduler tick failed:', error));
}, schedulerIntervalMs);
