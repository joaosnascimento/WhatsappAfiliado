import { ShopeeAffiliateApiClient } from './ShopeeAffiliateApiClient.ts';
import type {
  ShopeeProductOfferV2Data,
  ShopeeShopOfferV2Data,
  ShopeeProductOfferNode,
} from '../../src/graphql/types.ts';
import type { AffiliateProduct } from '../../src/types/affiliate.ts';

export interface ShopeeProductFilter {
  keyword?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  minCommissionRate?: number;
  page?: number;
  limit?: number;
  sortType?: number; // e.g. 1 = Popularity, 2 = Sales, 3 = Price High to Low, etc.
}

const PRODUCT_OFFER_V2_QUERY = `
  query productOfferV2(
    $keyword: String
    $page: Int
    $limit: Int
    $sortType: Int
    $minPrice: Float
    $maxPrice: Float
    $minDiscount: Int
    $minCommissionRate: Float
    $categoryId: String
  ) {
    productOfferV2(
      keyword: $keyword
      page: $page
      limit: $limit
      sortType: $sortType
      minPrice: $minPrice
      maxPrice: $maxPrice
      minDiscount: $minDiscount
      minCommissionRate: $minCommissionRate
      categoryId: $categoryId
    ) {
      nodes {
        itemId
        shopId
        productName
        imageUrl
        productLink
        price
        priceMin
        priceMax
        discountRate
        commissionRate
        commission
        rating
        sales
        shopName
        shopType
      }
      pageInfo {
        page
        limit
        hasNextPage
        totalCount
      }
    }
  }
`;

const SHOP_OFFER_V2_QUERY = `
  query shopOfferV2(
    $shopId: Long
    $page: Int
    $limit: Int
    $keyword: String
  ) {
    shopOfferV2(
      shopId: $shopId
      page: $page
      limit: $limit
      keyword: $keyword
    ) {
      nodes {
        shopId
        shopName
        shopType
        commissionRate
        rating
        productCount
        offerLink
      }
      pageInfo {
        page
        limit
        hasNextPage
        totalCount
      }
    }
  }
`;

export class ShopeeOfferService {
  private client: ShopeeAffiliateApiClient;

  constructor(client: ShopeeAffiliateApiClient) {
    this.client = client;
  }

  /**
   * Searches product offers via Shopee Affiliate Open API (productOfferV2)
   */
  public async searchProductOffers(
    filter: ShopeeProductFilter = {}
  ): Promise<{ products: AffiliateProduct[]; totalCount: number; hasNextPage: boolean }> {
    const variables: Record<string, unknown> = {
      keyword: filter.keyword || undefined,
      categoryId: filter.categoryId || undefined,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      minDiscount: filter.minDiscount,
      minCommissionRate: filter.minCommissionRate,
      page: filter.page || 1,
      limit: Math.min(filter.limit || 20, 50),
      sortType: filter.sortType || 1,
    };

    const data = await this.client.executeGraphQL<ShopeeProductOfferV2Data>(
      PRODUCT_OFFER_V2_QUERY,
      variables
    );

    const nodes = data?.productOfferV2?.nodes || [];
    const products = nodes.map((node) => this.normalizeProduct(node));

    return {
      products,
      totalCount: data?.productOfferV2?.pageInfo?.totalCount || 0,
      hasNextPage: data?.productOfferV2?.pageInfo?.hasNextPage || false,
    };
  }

  /**
   * Searches shop offers via Shopee Affiliate Open API (shopOfferV2)
   */
  public async searchShopOffers(params: {
    shopId?: number;
    keyword?: string;
    page?: number;
    limit?: number;
  }) {
    const variables = {
      shopId: params.shopId,
      keyword: params.keyword,
      page: params.page || 1,
      limit: params.limit || 20,
    };

    const data = await this.client.executeGraphQL<ShopeeShopOfferV2Data>(
      SHOP_OFFER_V2_QUERY,
      variables
    );

    return data?.shopOfferV2?.nodes || [];
  }

  /**
   * Normalizes Shopee raw node into standard domain AffiliateProduct
   */
  public normalizeProduct(node: ShopeeProductOfferNode): AffiliateProduct {
    const price = node.price || node.priceMin || 0;
    const discountRate = node.discountRate ? Number(node.discountRate) : undefined;
    const originalPrice =
      discountRate && discountRate > 0 && price > 0
        ? Number((price / (1 - discountRate / 100)).toFixed(2))
        : undefined;

    const commissionRate = node.commissionRate ? Number(node.commissionRate) : undefined;
    const commission =
      node.commission !== undefined
        ? Number(node.commission)
        : commissionRate
        ? Number(((price * commissionRate) / 100).toFixed(2))
        : 0;

    return {
      id: `shopee_${node.shopId}_${node.itemId}`,
      marketplace: 'SHOPEE',
      external_product_id: String(node.itemId),
      shop_id: String(node.shopId),
      title: node.productName,
      image: node.imageUrl,
      original_url: node.productLink,
      price,
      original_price: originalPrice,
      discount: discountRate,
      commission,
      commission_rate: commissionRate,
      rating: node.rating,
      sales: node.sales,
      metadata: {
        shop_name: node.shopName,
        shop_type: node.shopType,
        raw_response: node,
      },
    };
  }
}
