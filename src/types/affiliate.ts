export type MarketplaceType = 'MERCADOLIVRE' | 'SHOPEE';

export type AccountStatus =
  | 'CONNECTED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'API_NOT_ENABLED'
  | 'AUTH_ERROR'
  | 'AWAITING_CONFIG';

export interface MarketplaceAccount {
  id: string;
  workspace_id: string;
  marketplace: MarketplaceType;
  status: AccountStatus;
  status_message?: string;
  credentials_encrypted: {
    // Mercado Livre
    ml_client_id?: string;
    ml_client_secret?: string;
    ml_redirect_uri?: string;
    ml_access_token?: string;
    ml_refresh_token?: string;
    ml_user_id?: string;
    ml_expires_at?: number;
    // Shopee
    shopee_app_id?: string;
    shopee_secret?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface AffiliateProduct {
  id: string;
  marketplace: MarketplaceType;
  external_product_id: string; // MLB item_id or Shopee item_id
  shop_id?: string; // Shopee shop_id or ML seller_id
  title: string;
  image: string;
  original_url: string;
  affiliate_url?: string;
  price: number;
  original_price?: number;
  discount?: number; // percentage
  commission?: number; // calculated commission value in BRL
  commission_rate?: number; // percentage
  rating?: number;
  sales?: number;
  category?: string;
  condition?: string;
  metadata?: Record<string, unknown>;
}

export interface AffiliateLink {
  id: string;
  marketplace: MarketplaceType;
  affiliate_account_id: string;
  product_id: string;
  original_url: string;
  affiliate_url: string;
  short_url?: string;
  tracking_data: {
    sub_ids?: string[];
    campaign?: string;
    destination?: string;
    source?: string;
    category?: string;
  };
  created_at: string;
}

export type OfferStatus =
  | 'DISCOVERED'
  | 'VALIDATED'
  | 'AFFILIATE_LINK_READY'
  | 'READY_TO_PUBLISH'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED';

export interface Offer {
  id: string;
  product_id: string;
  product: AffiliateProduct;
  marketplace: MarketplaceType;
  price: number;
  original_price?: number;
  discount?: number;
  commission?: number;
  coupon_code?: string;
  score: number;
  status: OfferStatus;
  status_reason?: string;
  affiliate_link_id?: string;
  affiliate_url?: string;
  first_seen_at: string;
  last_seen_at: string;
  ai_generated_message?: string;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  created_at: string;
}

export interface Destination {
  id: string;
  workspace_id: string;
  type: 'WHATSAPP_GROUP' | 'WHATSAPP_CHANNEL' | 'WHATSAPP_BROADCAST';
  identifier: string; // e.g. "120363041234567890@g.us" or name
  name: string;
  description?: string;
  categories: string[];
  marketplaces: MarketplaceType[];
  keywords: string[];
  frequency_minutes: number;
  time_start: string; // "08:00"
  time_end: string; // "22:00"
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  is_active: boolean;
}

export interface TrackingSource {
  id: string;
  campaign_id: string;
  destination_id: string;
  category_id?: string;
  marketplace: MarketplaceType;
}

export interface Publication {
  id: string;
  workspace_id?: string;
  idempotency_key?: string;
  offer_id: string;
  offer?: Offer;
  destination_id: string;
  destination?: Destination;
  affiliate_link_id: string;
  affiliate_url: string;
  message: string;
  status: 'QUEUED' | 'SCHEDULED' | 'SENT' | 'FAILED';
  scheduled_at: string;
  sent_at?: string;
  error_message?: string;
  tracking_subids?: string[];
}

export interface Conversion {
  id: string;
  marketplace: MarketplaceType;
  affiliate_account_id: string;
  external_id: string;
  offer_id?: string;
  campaign_id?: string;
  destination_id?: string;
  sub_id?: string;
  commission: number;
  order_amount?: number;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  created_at: string;
}

export interface IntegrationDiagnosticStep {
  step: string;
  status: 'SUCCESS' | 'ERROR' | 'PENDING' | 'SKIPPED' | 'WARNING';
  message: string;
  details?: Record<string, unknown>;
}

export interface IntegrationTestResult {
  marketplace: MarketplaceType;
  overall_status: 'SUCCESS' | 'WARNING' | 'FAILED';
  steps: IntegrationDiagnosticStep[];
  timestamp: string;
}

export interface AffiliateMarketplaceAdapter {
  marketplace: MarketplaceType;
  searchOffers(query: {
    keyword?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    minDiscount?: number;
    page?: number;
    limit?: number;
  }): Promise<AffiliateProduct[]>;
  getProduct(productId: string): Promise<AffiliateProduct | null>;
  createAffiliateLink(params: {
    originalUrl: string;
    productId: string;
    subIds?: string[];
  }): Promise<AffiliateLink>;
  getReports(params: { startDate: string; endDate: string }): Promise<Conversion[]>;
  testConnection(): Promise<IntegrationTestResult>;
}
