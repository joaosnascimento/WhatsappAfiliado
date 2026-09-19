import { query } from '../infrastructure/database.ts';
import type { MarketplaceType } from '../types/affiliate.ts';

export interface DeduplicationResult {
  isDuplicate: boolean;
  lastPublishedAt?: string;
}

export class DeduplicationService {
  public static generateItemKey(marketplace: MarketplaceType, externalProductId: string, shopIdOrSiteId?: string): string {
    return marketplace === 'SHOPEE'
      ? `shopee_${shopIdOrSiteId || '0'}_${externalProductId}`
      : `ml_${shopIdOrSiteId || 'MLB'}_${externalProductId}`;
  }

  public static generateDedupKey(marketplace: MarketplaceType, externalProductId: string, destinationId: string, shopIdOrSiteId?: string): string {
    return `${this.generateItemKey(marketplace, externalProductId, shopIdOrSiteId)}__dest_${destinationId}`;
  }

  public static async isDuplicate(
    workspaceId: string,
    marketplace: MarketplaceType,
    externalProductId: string,
    destinationId: string,
    shopIdOrSiteId?: string,
    windowHours = 24,
  ): Promise<DeduplicationResult> {
    const dedupKey = this.generateDedupKey(marketplace, externalProductId, destinationId, shopIdOrSiteId);
    const cutoff = new Date(Date.now() - windowHours * 3600 * 1000);
    const rows = await query<{ published_at: Date | string }>(
      'SELECT published_at FROM publication_deduplication WHERE workspace_id=$1 AND dedup_key=$2 AND published_at >= $3 LIMIT 1',
      [workspaceId, dedupKey, cutoff],
    );
    return rows[0] ? { isDuplicate: true, lastPublishedAt: new Date(rows[0].published_at).toISOString() } : { isDuplicate: false };
  }

  public static async recordPublication(
    workspaceId: string,
    publicationId: string,
    marketplace: MarketplaceType,
    externalProductId: string,
    destinationId: string,
    shopIdOrSiteId?: string,
    timestamp = new Date(),
  ): Promise<void> {
    const dedupKey = this.generateDedupKey(marketplace, externalProductId, destinationId, shopIdOrSiteId);
    await query(
      `INSERT INTO publication_deduplication (workspace_id,dedup_key,marketplace,destination_id,publication_id,published_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (workspace_id,dedup_key) DO UPDATE SET publication_id=EXCLUDED.publication_id,published_at=EXCLUDED.published_at`,
      [workspaceId, dedupKey, marketplace, destinationId, publicationId, timestamp],
    );
  }

  public static async purgeOldRecords(retentionDays = 30): Promise<void> {
    await query('DELETE FROM publication_deduplication WHERE published_at < $1', [new Date(Date.now() - retentionDays * 86400000)]);
  }
}
