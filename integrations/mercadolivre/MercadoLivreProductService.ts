import { MercadoLivreApiClient } from './MercadoLivreApiClient.ts';
import type { AffiliateProduct } from '../../src/types/affiliate.ts';

export interface MLSearchResponse {
  site_id: string;
  query?: string;
  paging: {
    total: number;
    offset: number;
    limit: number;
    primary_results: number;
  };
  results: Array<{
    id: string;
    site_id: string;
    title: string;
    seller?: {
      id: number;
      nickname?: string;
      car_dealer?: boolean;
      real_estate_agency?: boolean;
    };
    price: number;
    original_price?: number | null;
    currency_id: string;
    available_quantity?: number;
    condition: string;
    permalink: string;
    thumbnail: string;
    shipping?: {
      free_shipping: boolean;
      logistic_type?: string;
    };
    category_id?: string;
    official_store_id?: number | null;
    official_store_name?: string | null;
    attributes?: Array<{
      id: string;
      name: string;
      value_name: string | null;
    }>;
  }>;
}

export interface MLItemResponse {
  id: string;
  site_id: string;
  title: string;
  seller_id: number;
  category_id: string;
  official_store_id?: number | null;
  price: number;
  base_price?: number;
  original_price?: number | null;
  currency_id: string;
  initial_quantity?: number;
  available_quantity?: number;
  condition: string;
  permalink: string;
  thumbnail: string;
  secure_thumbnail?: string;
  pictures?: Array<{ id: string; url: string; secure_url: string }>;
  shipping?: {
    free_shipping: boolean;
    logistic_type?: string;
  };
  attributes?: Array<{ id: string; name: string; value_name: string | null }>;
}

export class MercadoLivreProductService {
  private client: MercadoLivreApiClient;

  constructor(client: MercadoLivreApiClient) {
    this.client = client;
  }

  /**
   * Searches items in Mercado Livre Brasil (MLB) via official search endpoint
   * Endpoint: /sites/MLB/search?q={query}
   */
  public async searchItems(params: {
    query?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ products: AffiliateProduct[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.append('q', params.query);
    if (params.category) searchParams.append('category', params.category);
    if (params.minPrice !== undefined && params.maxPrice !== undefined) {
      searchParams.append('price', `${params.minPrice}-${params.maxPrice}`);
    } else if (params.minPrice !== undefined) {
      searchParams.append('price', `${params.minPrice}-*`);
    } else if (params.maxPrice !== undefined) {
      searchParams.append('price', `*-${params.maxPrice}`);
    }
    if (params.limit) searchParams.append('limit', String(Math.min(params.limit, 50)));
    if (params.offset) searchParams.append('offset', String(params.offset));

    const data = await this.client.request<MLSearchResponse>(
      `/sites/MLB/search?${searchParams.toString()}`,
      { authenticated: false }
    );

    const products = (data.results || []).map((item) => this.normalizeSearchResult(item));
    return {
      products,
      total: data.paging?.total || products.length,
    };
  }

  /**
   * Fetches single item by ID
   * Endpoint: /items/{itemId}
   */
  public async getItem(itemId: string): Promise<AffiliateProduct> {
    const cleanId = itemId.startsWith('MLB') ? itemId : `MLB${itemId}`;
    const item = await this.client.request<MLItemResponse>(`/items/${cleanId}`);
    return this.normalizeItem(item);
  }

  /**
   * Fetches multiple items in batch
   * Endpoint: /items?ids={id1,id2}
   */
  public async getItems(itemIds: string[]): Promise<AffiliateProduct[]> {
    if (itemIds.length === 0) return [];
    const formattedIds = itemIds.map((id) => (id.startsWith('MLB') ? id : `MLB${id}`)).join(',');
    const results = await this.client.request<Array<{ code: number; body: MLItemResponse }>>(
      `/items?ids=${formattedIds}`
    );

    return results
      .filter((r) => r.code === 200 && r.body)
      .map((r) => this.normalizeItem(r.body));
  }

  /**
   * Fetches category details
   * Endpoint: /categories/{categoryId}
   */
  public async getCategory(categoryId: string) {
    return this.client.request(`/categories/${categoryId}`);
  }

  /**
   * Fetches seller details
   * Endpoint: /users/{sellerId}
   */
  public async getSeller(sellerId: string | number) {
    return this.client.request(`/users/${sellerId}`);
  }

  /**
   * Normalizes search result to AffiliateProduct
   */
  private normalizeSearchResult(item: MLSearchResponse['results'][0]): AffiliateProduct {
    const price = item.price || 0;
    const originalPrice = item.original_price && item.original_price > price ? item.original_price : undefined;
    const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : undefined;

    return {
      id: `ml_${item.site_id || 'MLB'}_${item.id}`,
      marketplace: 'MERCADOLIVRE',
      external_product_id: item.id,
      shop_id: item.seller?.id ? String(item.seller.id) : undefined,
      title: item.title,
      image: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : '',
      original_url: item.permalink,
      price,
      original_price: originalPrice,
      discount,
      category: item.category_id,
      condition: item.condition,
      metadata: {
        site_id: item.site_id,
        seller_nickname: item.seller?.nickname,
        available_quantity: item.available_quantity,
        shipping: item.shipping,
        official_store: item.official_store_name || item.official_store_id,
        attributes: item.attributes,
      },
    };
  }

  /**
   * Normalizes full item response to AffiliateProduct
   */
  private normalizeItem(item: MLItemResponse): AffiliateProduct {
    const price = item.price || 0;
    const originalPrice = item.original_price && item.original_price > price ? item.original_price : undefined;
    const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : undefined;
    const firstPic = item.pictures && item.pictures.length > 0 ? item.pictures[0].secure_url || item.pictures[0].url : item.thumbnail;

    return {
      id: `ml_${item.site_id || 'MLB'}_${item.id}`,
      marketplace: 'MERCADOLIVRE',
      external_product_id: item.id,
      shop_id: item.seller_id ? String(item.seller_id) : undefined,
      title: item.title,
      image: firstPic ? firstPic.replace('http://', 'https://') : '',
      original_url: item.permalink,
      price,
      original_price: originalPrice,
      discount,
      category: item.category_id,
      condition: item.condition,
      metadata: {
        site_id: item.site_id,
        available_quantity: item.available_quantity,
        shipping: item.shipping,
        official_store: item.official_store_id,
        attributes: item.attributes,
      },
    };
  }
}
