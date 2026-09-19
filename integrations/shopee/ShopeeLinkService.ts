import { ShopeeAffiliateApiClient } from './ShopeeAffiliateApiClient.ts';
import type { ShopeeGenerateShortLinkData } from '../../src/graphql/types.ts';
import type { AffiliateLink } from '../../src/types/affiliate.ts';

const GENERATE_SHORT_LINK_MUTATION = `
  mutation generateShortLink($originUrl: String!, $subIds: [String]) {
    generateShortLink(input: { originUrl: $originUrl, subIds: $subIds }) {
      shortLink
      originUrl
      subIds
    }
  }
`;

export interface GenerateShopeeLinkInput {
  originUrl: string;
  productId: string;
  affiliateAccountId: string;
  subIds?: string[];
  campaign?: string;
  destination?: string;
}

export class ShopeeLinkService {
  private client: ShopeeAffiliateApiClient;

  constructor(client: ShopeeAffiliateApiClient) {
    this.client = client;
  }

  /**
   * Sanitizes subIds according to Shopee API limits (max 5 subIds, alphanumeric/underscores, max length per tag)
   */
  public static sanitizeSubIds(subIds: string[] = []): string[] {
    return subIds
      .slice(0, 5) // Shopee limits up to 5 subIds
      .map((id) =>
        id
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_')
          .slice(0, 30)
      );
  }

  /**
   * Generates official affiliate short link via Shopee Affiliate Open API
   */
  public async generateAffiliateLink(
    input: GenerateShopeeLinkInput
  ): Promise<AffiliateLink> {
    if (!input.originUrl) {
      throw new Error('originUrl é obrigatória para gerar link afiliado Shopee.');
    }

    const cleanSubIds = ShopeeLinkService.sanitizeSubIds(input.subIds || []);

    const variables = {
      originUrl: input.originUrl,
      subIds: cleanSubIds.length > 0 ? cleanSubIds : undefined,
    };

    const data = await this.client.executeGraphQL<ShopeeGenerateShortLinkData>(
      GENERATE_SHORT_LINK_MUTATION,
      variables
    );

    const shortLink = data?.generateShortLink?.shortLink;
    if (!shortLink) {
      throw new Error('Shopee Open API não retornou shortLink válido para a URL especificada.');
    }

    return {
      id: `link_shopee_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      marketplace: 'SHOPEE',
      affiliate_account_id: input.affiliateAccountId,
      product_id: input.productId,
      original_url: input.originUrl,
      affiliate_url: shortLink,
      short_url: shortLink,
      tracking_data: {
        sub_ids: cleanSubIds,
        campaign: input.campaign,
        destination: input.destination,
        source: 'shopee_affiliate_open_api',
      },
      created_at: new Date().toISOString(),
    };
  }
}
