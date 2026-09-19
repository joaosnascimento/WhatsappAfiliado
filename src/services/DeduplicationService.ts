import type { MarketplaceType, Publication } from '../types/affiliate.ts';

export interface DeduplicationRecord {
  dedupKey: string;
  marketplace: MarketplaceType;
  destinationId: string;
  publishedAt: number; // Unix timestamp
  publicationId: string;
}

export class DeduplicationService {
  private static history: DeduplicationRecord[] = [];

  /**
   * Generates unique item key per marketplace
   * Shopee: shop_id + item_id
   * Mercado Livre: site_id + item_id
   */
  public static generateItemKey(
    marketplace: MarketplaceType,
    externalProductId: string,
    shopIdOrSiteId?: string
  ): string {
    if (marketplace === 'SHOPEE') {
      const shopId = shopIdOrSiteId || '0';
      return `shopee_${shopId}_${externalProductId}`;
    } else {
      const siteId = shopIdOrSiteId || 'MLB';
      return `ml_${siteId}_${externalProductId}`;
    }
  }

  /**
   * Generates composite deduplication key:
   * marketplace + itemKey + destinationId
   */
  public static generateDedupKey(
    marketplace: MarketplaceType,
    externalProductId: string,
    destinationId: string,
    shopIdOrSiteId?: string
  ): string {
    const itemKey = this.generateItemKey(marketplace, externalProductId, shopIdOrSiteId);
    return `${itemKey}__dest_${destinationId}`;
  }

  /**
   * Checks if a product was already published to the specified destination within the cooldown window
   * @param windowHours Default 24 hours
   */
  public static isDuplicate(
    marketplace: MarketplaceType,
    externalProductId: string,
    destinationId: string,
    shopIdOrSiteId?: string,
    windowHours: number = 24
  ): { isDuplicate: boolean; lastPublishedAt?: string } {
    const dedupKey = this.generateDedupKey(marketplace, externalProductId, destinationId, shopIdOrSiteId);
    const cutoff = Date.now() - windowHours * 3600 * 1000;

    const record = this.history
      .filter((r) => r.dedupKey === dedupKey && r.publishedAt >= cutoff)
      .sort((a, b) => b.publishedAt - a.publishedAt)[0];

    if (record) {
      return {
        isDuplicate: true,
        lastPublishedAt: new Date(record.publishedAt).toISOString(),
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Registers a publication into the deduplication history
   */
  public static recordPublication(
    publicationId: string,
    marketplace: MarketplaceType,
    externalProductId: string,
    destinationId: string,
    shopIdOrSiteId?: string,
    timestamp: number = Date.now()
  ): void {
    const dedupKey = this.generateDedupKey(marketplace, externalProductId, destinationId, shopIdOrSiteId);
    this.history.push({
      dedupKey,
      marketplace,
      destinationId,
      publishedAt: timestamp,
      publicationId,
    });
  }

  /**
   * Cleans up historical records older than max retention days
   */
  public static purgeOldRecords(retentionDays: number = 30): void {
    const cutoff = Date.now() - retentionDays * 24 * 3600 * 1000;
    this.history = this.history.filter((r) => r.publishedAt >= cutoff);
  }
}
