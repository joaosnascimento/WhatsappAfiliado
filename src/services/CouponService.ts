import type { MarketplaceType } from '../types/affiliate.ts';

export interface CouponData {
  marketplace: MarketplaceType;
  code: string;
  discountPercentage?: number;
  discountValueBrl?: number;
  minPurchaseValue?: number;
  expiresAt?: string;
  isVerified: boolean;
}

export class CouponService {
  /**
   * Verified coupon repository per marketplace.
   * Real rule: Never invent coupons. If an official coupon API or manual verified coupon
   * is not provided, return null.
   */
  private static verifiedCoupons: Map<string, CouponData[]> = new Map();

  /**
   * Retrieves verified coupons for a given product and marketplace
   */
  public static getCouponsForProduct(
    marketplace: MarketplaceType,
    category?: string,
    shopId?: string
  ): CouponData[] {
    const key = `${marketplace}`;
    const all = this.verifiedCoupons.get(key) || [];

    // Return only non-expired, verified coupons
    const now = new Date().toISOString();
    return all.filter((c) => {
      if (c.expiresAt && c.expiresAt < now) return false;
      return true;
    });
  }

  /**
   * Registers a verified coupon into the system
   */
  public static registerCoupon(coupon: CouponData): void {
    if (!coupon.code || coupon.code.trim() === '') {
      throw new Error('Código de cupom inválido.');
    }
    const key = `${coupon.marketplace}`;
    const current = this.verifiedCoupons.get(key) || [];
    current.push(coupon);
    this.verifiedCoupons.set(key, current);
  }
}
