import type {
  MarketplaceType,
  AffiliateProduct,
  Destination,
  Publication,
  Offer,
} from '../types/affiliate.ts';

export interface AuditRecord {
  id: string;
  marketplace: MarketplaceType;
  productId: string;
  productTitle: string;
  originalPrice?: number;
  finalPrice: number;
  affiliateAccountId: string;
  originalUrl: string;
  affiliateUrl: string;
  campaignId?: string;
  destinationId: string;
  destinationName: string;
  aiMessage: string;
  publicationId: string;
  publicationStatus: string;
  publishedAt: string;
  trackingSubIds?: string[];
  createdAt: string;
}

export class AuditService {
  private static records: AuditRecord[] = [];

  /**
   * Records a complete, audited publication trace
   */
  public static logPublicationTrace(params: {
    offer: Offer;
    destination: Destination;
    publication: Publication;
    affiliateAccountId: string;
  }): AuditRecord {
    const record: AuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      marketplace: params.offer.marketplace,
      productId: params.offer.product.external_product_id,
      productTitle: params.offer.product.title,
      originalPrice: params.offer.product.original_price,
      finalPrice: params.offer.price,
      affiliateAccountId: params.affiliateAccountId,
      originalUrl: params.offer.product.original_url,
      affiliateUrl: params.offer.affiliate_url || params.publication.affiliate_url,
      destinationId: params.destination.id,
      destinationName: params.destination.name,
      aiMessage: params.publication.message,
      publicationId: params.publication.id,
      publicationStatus: params.publication.status,
      publishedAt: params.publication.sent_at || new Date().toISOString(),
      trackingSubIds: params.publication.tracking_subids,
      createdAt: new Date().toISOString(),
    };

    this.records.unshift(record);
    return record;
  }

  /**
   * Retrieves audit records with optional filtering
   */
  public static getAuditRecords(marketplace?: MarketplaceType, destinationId?: string): AuditRecord[] {
    return this.records.filter((r) => {
      if (marketplace && r.marketplace !== marketplace) return false;
      if (destinationId && r.destinationId !== destinationId) return false;
      return true;
    });
  }

  /**
   * Finds a trace by publication ID
   */
  public static getByPublicationId(publicationId: string): AuditRecord | undefined {
    return this.records.find((r) => r.publicationId === publicationId);
  }
}
