import { query } from '../infrastructure/database.ts';
import type {
  MarketplaceType,
  AffiliateProduct,
  Destination,
  Publication,
  Offer,
} from '../types/affiliate.ts';

export interface AuditRecord {
  id: string;
  workspaceId: string;
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
  public static async logPublicationTrace(params: {
    offer: Offer;
    destination: Destination;
    publication: Publication;
    affiliateAccountId: string;
  }): Promise<AuditRecord> {
    const record: AuditRecord = {
      workspaceId: params.publication.workspace_id || 'unknown',
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
    if (process.env.DATABASE_URL) {
      await query(`INSERT INTO audit_records
        (id,workspace_id,marketplace,product_id,product_title,original_price,final_price,affiliate_account_id,original_url,affiliate_url,campaign_id,destination_id,destination_name,ai_message,publication_id,publication_status,published_at,tracking_subids,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (workspace_id,publication_id) DO UPDATE SET publication_status=EXCLUDED.publication_status,published_at=EXCLUDED.published_at,ai_message=EXCLUDED.ai_message,tracking_subids=EXCLUDED.tracking_subids`,
        [record.id,record.workspaceId,record.marketplace,record.productId,record.productTitle,record.originalPrice ?? null,record.finalPrice,record.affiliateAccountId,record.originalUrl,record.affiliateUrl,record.campaignId ?? null,record.destinationId,record.destinationName,record.aiMessage,record.publicationId,record.publicationStatus,record.publishedAt,JSON.stringify(record.trackingSubIds || []),record.createdAt]);
    }
    return record;
  }

  /**
   * Retrieves audit records with optional filtering
   */
  public static async getAuditRecords(workspaceId: string, marketplace?: MarketplaceType, destinationId?: string): Promise<AuditRecord[]> {
    if (process.env.DATABASE_URL) {
      const filters = ['workspace_id=$1'];
      const params: unknown[] = [workspaceId];
      if (marketplace) { params.push(marketplace); filters.push(`marketplace=${params.length}`); }
      if (destinationId) { params.push(destinationId); filters.push(`destination_id=${params.length}`); }
      const rows = await query<any>(`SELECT id,workspace_id,marketplace,product_id,product_title,original_price,final_price,affiliate_account_id,original_url,affiliate_url,campaign_id,destination_id,destination_name,ai_message,publication_id,publication_status,published_at,tracking_subids,created_at FROM audit_records WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT 500`, params);
      return rows.map((r:any) => ({
        id:r.id, workspaceId:r.workspace_id, marketplace:r.marketplace, productId:r.product_id, productTitle:r.product_title,
        originalPrice:r.original_price == null ? undefined : Number(r.original_price), finalPrice:Number(r.final_price), affiliateAccountId:r.affiliate_account_id,
        originalUrl:r.original_url, affiliateUrl:r.affiliate_url, campaignId:r.campaign_id || undefined, destinationId:r.destination_id,
        destinationName:r.destination_name, aiMessage:r.ai_message, publicationId:r.publication_id, publicationStatus:r.publication_status,
        publishedAt:new Date(r.published_at).toISOString(), trackingSubIds:Array.isArray(r.tracking_subids) ? r.tracking_subids : [], createdAt:new Date(r.created_at).toISOString(),
      }));
    }
    return this.records.filter((r) => {
      if (r.workspaceId !== workspaceId) return false;
      if (marketplace && r.marketplace !== marketplace) return false;
      if (destinationId && r.destinationId !== destinationId) return false;
      return true;
    });
  }

  /**
   * Finds a trace by publication ID
   */
  public static async getByPublicationId(workspaceId: string, publicationId: string): Promise<AuditRecord | undefined> {
    if (process.env.DATABASE_URL) {
      const rows = await query<any>('SELECT id,workspace_id,marketplace,product_id,product_title,original_price,final_price,affiliate_account_id,original_url,affiliate_url,campaign_id,destination_id,destination_name,ai_message,publication_id,publication_status,published_at,tracking_subids,created_at FROM audit_records WHERE workspace_id=$1 AND publication_id=$2 LIMIT 1',[workspaceId,publicationId]);
      const r=rows[0];
      if(!r) return undefined;
      return {id:r.id,workspaceId:r.workspace_id,marketplace:r.marketplace,productId:r.product_id,productTitle:r.product_title,originalPrice:r.original_price==null?undefined:Number(r.original_price),finalPrice:Number(r.final_price),affiliateAccountId:r.affiliate_account_id,originalUrl:r.original_url,affiliateUrl:r.affiliate_url,campaignId:r.campaign_id||undefined,destinationId:r.destination_id,destinationName:r.destination_name,aiMessage:r.ai_message,publicationId:r.publication_id,publicationStatus:r.publication_status,publishedAt:new Date(r.published_at).toISOString(),trackingSubIds:Array.isArray(r.tracking_subids)?r.tracking_subids:[],createdAt:new Date(r.created_at).toISOString()};
    }
    return this.records.find((r) => r.workspaceId === workspaceId && r.publicationId === publicationId);
  }
}
