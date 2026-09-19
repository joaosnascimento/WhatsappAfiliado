export interface ShopeeGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

export interface ShopeeProductOfferNode {
  itemId: string | number;
  shopId: string | number;
  productName: string;
  imageUrl: string;
  productLink: string;
  price: number;
  priceMin?: number;
  priceMax?: number;
  discountRate?: number;
  commissionRate?: number;
  commission?: number;
  rating?: number;
  sales?: number;
  shopName?: string;
  shopType?: number | string;
}

export interface ShopeeProductOfferV2Data {
  productOfferV2: {
    nodes: ShopeeProductOfferNode[];
    pageInfo: {
      page: number;
      limit: number;
      hasNextPage: boolean;
      totalCount: number;
    };
  };
}

export interface ShopeeShopOfferNode {
  shopId: string | number;
  shopName: string;
  shopType?: string;
  commissionRate?: number;
  rating?: number;
  productCount?: number;
  offerLink?: string;
}

export interface ShopeeShopOfferV2Data {
  shopOfferV2: {
    nodes: ShopeeShopOfferNode[];
    pageInfo: {
      page: number;
      limit: number;
      hasNextPage: boolean;
      totalCount: number;
    };
  };
}

export interface ShopeeGenerateShortLinkData {
  generateShortLink: {
    shortLink: string;
    originUrl: string;
    subIds?: string[];
  };
}

export interface ShopeeConversionNode {
  conversionId: string;
  purchaseTime: number;
  orderId: string;
  subIds?: string[];
  shopId: string | number;
  itemId: string | number;
  itemPrice: number;
  commissionRate: number;
  commission: number;
  orderStatus: string;
  productName: string;
}

export interface ShopeeReportData {
  conversionReport: {
    nodes: ShopeeConversionNode[];
    pageInfo: {
      page: number;
      limit: number;
      hasNextPage: boolean;
      totalCount: number;
    };
  };
}
