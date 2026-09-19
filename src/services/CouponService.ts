import { randomUUID } from 'node:crypto';
import { query } from '../infrastructure/database.ts';
import type { MarketplaceType, Offer } from '../types/affiliate.ts';

export interface CouponData {
  marketplace: MarketplaceType; code: string; description?: string;
  discountType?: 'PERCENTAGE'|'FIXED'|'UNKNOWN'; discountValueBrl?: number;
  minPurchaseValue?: number; maxDiscountValue?: number; startsAt?: string; expiresAt?: string;
  sourceUrl?: string; productExternalId?: string; isVerified: boolean;
}

export class CouponService {
  static async registerCoupon(workspaceId:string,coupon:CouponData) {
    if(!coupon.code?.trim()) throw new Error('Código de cupom inválido.');
    if(!coupon.sourceUrl || !/^https:\/\//i.test(coupon.sourceUrl)) throw new Error('sourceUrl HTTPS é obrigatório para cupons verificados.');
    const rows=await query<any>(`
      INSERT INTO coupons(id,workspace_id,marketplace,code,description,discount_type,discount_value,minimum_order_value,max_discount_value,starts_at,expires_at,source_url,product_external_id,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (workspace_id,marketplace,code,(COALESCE(product_external_id,''))) DO UPDATE SET
        description=EXCLUDED.description,discount_type=EXCLUDED.discount_type,discount_value=EXCLUDED.discount_value,
        minimum_order_value=EXCLUDED.minimum_order_value,max_discount_value=EXCLUDED.max_discount_value,
        starts_at=EXCLUDED.starts_at,expires_at=EXCLUDED.expires_at,source_url=EXCLUDED.source_url,
        metadata=EXCLUDED.metadata,updated_at=NOW(),is_active=TRUE
      RETURNING *`,
      [randomUUID(),workspaceId,coupon.marketplace,coupon.code.trim(),coupon.description||null,coupon.discountType||'UNKNOWN',
       coupon.discountValueBrl??null,coupon.minPurchaseValue??null,coupon.maxDiscountValue??null,coupon.startsAt||null,
       coupon.expiresAt||null,coupon.sourceUrl,coupon.productExternalId||null,JSON.stringify({verified:coupon.isVerified})]
    );
    return rows[0];
  }

  static async getCouponsForProduct(workspaceId:string, marketplace:MarketplaceType, productExternalId?:string) {
    return query<any>(
      `SELECT * FROM coupons WHERE workspace_id=$1 AND marketplace=$2 AND is_active=true
       AND (expires_at IS NULL OR expires_at>NOW())
       AND (product_external_id IS NULL OR product_external_id=$3)
       ORDER BY product_external_id NULLS LAST, updated_at DESC`,
      [workspaceId,marketplace,productExternalId||null]
    );
  }

  static async extractFromOffer(workspaceId:string, offer:Offer) {
    const m=offer.product.metadata as any || {};
    const c=m.coupon || m.voucher || m.couponCode || m.coupon_code;
    if(!c) return null;
    const code=typeof c==='string'?c:String(c.code||c.coupon_code||'');
    if(!code) return null;
    const value=Number(c.discount_value ?? c.value ?? c.percentage ?? NaN);
    const coupon=await this.registerCoupon(workspaceId,{
      marketplace:offer.marketplace,code,description:c.description,
      discountType:['PERCENTAGE','FIXED'].includes(String(c.discount_type||c.type||'').toUpperCase()) ? String(c.discount_type||c.type).toUpperCase() as any : 'UNKNOWN',
      discountValueBrl:Number.isFinite(value)?value:undefined,minPurchaseValue:Number(c.minimum_order_value||c.min_spend)||undefined,
      maxDiscountValue:Number(c.max_discount_value||c.max_discount)||undefined,startsAt:c.starts_at||c.start_time,
      expiresAt:c.expires_at||c.end_time,sourceUrl:c.source_url||offer.product.original_url,
      productExternalId:offer.product.external_product_id,isVerified:Boolean(c.verified)
    });
    return coupon;
  }
}
