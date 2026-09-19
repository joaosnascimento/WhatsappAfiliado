import 'dotenv/config';
import { Worker } from 'bullmq';
import { query } from '../infrastructure/database.ts';
import { requireRedis } from '../infrastructure/redis.ts';
import { WhatsAppProvider } from '../services/WhatsAppProvider.ts';
import { DeduplicationService } from '../services/DeduplicationService.ts';
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
    await query("UPDATE publications SET status='FAILED', error=$2 WHERE id=$1", [row.id, result.error || 'Provider failed']);
    throw new Error(result.error || 'Publication failed');
  }
  await query("UPDATE publications SET status='SENT', provider_message_id=$2, published_at=NOW(), error=NULL WHERE id=$1", [row.id, result.messageId || null]);

  const stateRows = await query<{ state: any }>('SELECT state FROM workspace_state WHERE workspace_id=$1', [row.workspace_id]);
  const offer = stateRows[0]?.state?.offers?.find((item: any) => item.id === row.offer_id);
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
