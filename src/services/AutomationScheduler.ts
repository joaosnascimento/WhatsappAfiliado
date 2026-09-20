import { query, transaction } from '../infrastructure/database.ts';
import { enqueuePublication } from '../infrastructure/queue.ts';
import { AiMessageService } from './AiMessageService.ts';
import { AnalyticsService } from './AnalyticsService.ts';
import { DeduplicationService } from './DeduplicationService.ts';
import type { Destination, Offer, Publication } from '../types/affiliate.ts';

type WorkspaceState = { offers?: Offer[] };

function parseTime(value: string, fallback: number): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isInsideWindow(now: Date, start: string, end: string): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const from = parseTime(start, 0);
  const to = parseTime(end, 23 * 60 + 59);
  return from <= to ? current >= from && current <= to : current >= from || current <= to;
}

function matchesDestination(offer: Offer, destination: Destination): boolean {
  if (destination.marketplaces.length && !destination.marketplaces.includes(offer.marketplace)) return false;
  const haystack = [
    offer.product.title,
    offer.product.category || '',
    ...(offer.product.metadata ? Object.values(offer.product.metadata).map(String) : []),
  ].join(' ').toLowerCase();
  if (destination.categories.length && !destination.categories.some(c => haystack.includes(c.toLowerCase()))) return false;
  if (destination.keywords.length && !destination.keywords.some(k => haystack.includes(k.toLowerCase()))) return false;
  return true;
}

export class AutomationScheduler {
  private static running = false;

  public static async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let created = 0;
    try {
      const workspaces = await query<{ id: string }>('SELECT id FROM workspaces');
      const now = new Date();

      for (const workspace of workspaces) {
        const destinations = await query<any>(
          'SELECT id, workspace_id, type, identifier, name, config, is_active FROM destinations WHERE workspace_id=$1 AND is_active=true',
          [workspace.id],
        );
        const stateRows = await query<{ state: WorkspaceState }>(
          'SELECT state FROM workspace_state WHERE workspace_id=$1',
          [workspace.id],
        );
        const workspaceState: any = stateRows[0]?.state || { products: [], links: [], offers: [], campaigns: [], destinations: [], publications: [], conversions: [] };
        const offers: Offer[] = workspaceState.offers || [];

        for (const row of destinations) {
          const config = row.config || {};
          const destination: Destination = {
            id: row.id,
            workspace_id: row.workspace_id,
            type: row.type,
            identifier: row.identifier,
            name: row.name,
            categories: config.categories || [],
            marketplaces: config.marketplaces || [],
            keywords: config.keywords || [],
            frequency_minutes: Number(config.frequency_minutes || 60),
            time_start: config.time_start || '08:00',
            time_end: config.time_end || '22:00',
            priority: config.priority || 'NORMAL',
            is_active: row.is_active,
          };

          if (!isInsideWindow(now, destination.time_start, destination.time_end)) continue;
          const frequency = Math.max(5, destination.frequency_minutes || 60);
          const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / frequency);
          const dateKey = now.toISOString().slice(0, 10);

          const eligible = offers
            .filter((o: Offer) => (o.status === 'AFFILIATE_LINK_READY' || o.status === 'READY_TO_PUBLISH') && o.affiliate_url)
            .filter(o => matchesDestination(o, destination))
            .sort((a: Offer, b: Offer) => b.score - a.score);

          if (!eligible.length) continue;

          const rotatedEligible = eligible.length ? eligible.map((_offer: Offer, index: number) => eligible[(index + slot) % eligible.length]) : [];
          const candidates: Offer[] = [];
          for (const offer of rotatedEligible) {
            if (candidates.length >= 3) break;
            const dedup = await DeduplicationService.isDuplicate(
              workspace.id, offer.marketplace, offer.product.external_product_id, destination.id, offer.product.shop_id, 24
            );
            if (!dedup.isDuplicate) candidates.push(offer);
          }

          for (const offer of candidates) {
            const idempotencyKey = `auto:${dateKey}:${slot}:${offer.marketplace}:${offer.product.external_product_id}:${destination.id}`;
            const tracked = await AnalyticsService.createTrackedLink({
              workspaceId: workspace.id,
              marketplace: offer.marketplace,
              affiliateUrl: offer.affiliate_url!,
              affiliateLinkId: offer.affiliate_link_id,
              offerId: offer.id,
              destinationId: destination.id,
              subId: `whatsapp:${destination.id}:${offer.marketplace.toLowerCase()}`,
            });
            const publicBase = (process.env.APP_URL || '').replace(/\/$/, '');
            const publicationAffiliateUrl = publicBase ? `${publicBase}/r/${tracked.id}` : offer.affiliate_url!;
            const message = offer.ai_generated_message
              ? offer.ai_generated_message.replaceAll(offer.affiliate_url!, publicationAffiliateUrl)
              : await AiMessageService.generateMessage({
                  product: offer.product,
                  marketplace: offer.marketplace,
                  affiliateUrl: publicationAffiliateUrl,
                  destinationName: destination.name,
                  category: offer.product.category,
                  couponCode: offer.coupon_code,
                });

            const publication: Publication = {
              id: `pub_auto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
              workspace_id: workspace.id,
              idempotency_key: idempotencyKey,
              offer_id: offer.id,
              offer,
              destination_id: destination.id,
              destination,
              affiliate_link_id: offer.affiliate_link_id || 'link_direct',
              affiliate_url: publicationAffiliateUrl,
              message,
              status: 'QUEUED',
              scheduled_at: now.toISOString(),
              tracking_subids: ['whatsapp', destination.id, offer.marketplace.toLowerCase(), 'auto'],
            };

            const inserted = await transaction(async client => {
              const result = await client.query<{ id: string }>(
                `INSERT INTO publications
                  (id,workspace_id,offer_id,destination_id,status,idempotency_key,scheduled_at,affiliate_link_id,affiliate_url,message,tracking_subids)
                 VALUES ($1,$2,$3,$4,'QUEUED',$5,$6,$7,$8,$9,$10)
                 ON CONFLICT (workspace_id,idempotency_key) DO NOTHING
                 RETURNING id`,
                [
                  publication.id, workspace.id, offer.id, destination.id, idempotencyKey, publication.scheduled_at,
                  publication.affiliate_link_id, publication.affiliate_url, publication.message,
                  JSON.stringify(publication.tracking_subids || []),
                ],
              );
              return result.rows[0];
            });

            if (!inserted) continue;
            workspaceState.publications = workspaceState.publications || [];
            workspaceState.publications.push({ ...publication, id: inserted.id });
            await query('UPDATE workspace_state SET state=$2, updated_at=NOW() WHERE workspace_id=$1', [workspace.id, JSON.stringify(workspaceState)]);
            try {
              await enqueuePublication({
                publicationId: inserted.id,
                destinationId: destination.id,
                offerId: offer.id,
                scheduledAt: publication.scheduled_at,
              });
              created++;
            } catch (error) {
              const message = (error as Error).message;
              await query("UPDATE publications SET status='FAILED', error=$2 WHERE id=$1", [inserted.id, message]);
              const failedPub = workspaceState.publications.find((item: any) => item.id === inserted.id);
              if (failedPub) {
                failedPub.status = 'FAILED';
                failedPub.error_message = message;
                await query('UPDATE workspace_state SET state=$2, updated_at=NOW() WHERE workspace_id=$1', [workspace.id, JSON.stringify(workspaceState)]);
              }
            }
          }
        }
      }
    } finally {
      this.running = false;
    }
    return created;
  }
}
