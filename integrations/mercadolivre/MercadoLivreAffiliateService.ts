import type { AffiliateLink } from '../../src/types/affiliate.ts';

export interface MLAssociateLinkInput {
  productId: string;
  originalUrl: string;
  affiliateUrl: string;
  affiliateAccountId: string;
  campaign?: string;
  destination?: string;
  subIds?: string[];
}

export interface MLValidationStatus {
  isValidAffiliateLink: boolean;
  reason?: string;
}

export class MercadoLivreAffiliateService {
  /**
   * Validates if a provided link is genuinely an official Mercado Livre affiliate link
   * Official ML affiliate links typically come as meli.la shortlinks or contain valid tracking domains
   * and parameters issued through the Mercado Livre Affiliate Portal (e.g. tracking tag or meli.la)
   */
  public static validateAffiliateUrl(url: string, originalUrl: string): MLValidationStatus {
    if (!url || typeof url !== 'string') {
      return { isValidAffiliateLink: false, reason: 'URL de afiliado vazia ou inválida.' };
    }

    const trimmed = url.trim();

    // Prevent tricking the system: ordinary product url is NOT an affiliate url!
    if (trimmed === originalUrl.trim()) {
      return {
        isValidAffiliateLink: false,
        reason: 'A URL de afiliado fornecida é idêntica à URL comum do anúncio. É necessário o link gerado no portal de afiliados do Mercado Livre.',
      };
    }

    try {
      const parsed = new URL(trimmed);
      const isMeliShortlink =
        parsed.hostname.includes('meli.la') ||
        parsed.hostname.includes('mercadolivre.com') ||
        parsed.hostname.includes('mercadolivre.com.br');

      if (!isMeliShortlink) {
        return {
          isValidAffiliateLink: false,
          reason: 'O domínio do link deve pertencer ao ecossistema oficial do Mercado Livre (ex: meli.la ou mercadolivre.com.br).',
        };
      }

      // Check if it's either the official meli.la shortlink or has official affiliate attribution query tags
      const hasMeliShort = parsed.hostname.includes('meli.la');
      const hasAffiliateParams =
        parsed.searchParams.has('matt_tool') ||
        parsed.searchParams.has('tracking_id') ||
        parsed.searchParams.has('affiliate_id') ||
        parsed.pathname.includes('/afiliados/');

      if (!hasMeliShort && !hasAffiliateParams) {
        return {
          isValidAffiliateLink: false,
          reason: 'O link não possui os identificadores oficiais do Programa de Afiliados do Mercado Livre (ex: meli.la ou parâmetros de atribuição).',
        };
      }

      return { isValidAffiliateLink: true };
    } catch {
      return { isValidAffiliateLink: false, reason: 'Formato de URL inválido.' };
    }
  }

  /**
   * Securely associates a validated official affiliate link to a discovered ML product.
   * Both original_url and affiliate_url are preserved permanently.
   */
  public static associateAffiliateLink(input: MLAssociateLinkInput): AffiliateLink {
    const validation = this.validateAffiliateUrl(input.affiliateUrl, input.originalUrl);
    if (!validation.isValidAffiliateLink) {
      throw new Error(`Validação de Link de Afiliado Mercado Livre falhou: ${validation.reason}`);
    }

    return {
      id: `link_ml_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      marketplace: 'MERCADOLIVRE',
      affiliate_account_id: input.affiliateAccountId,
      product_id: input.productId,
      original_url: input.originalUrl,
      affiliate_url: input.affiliateUrl.trim(),
      short_url: input.affiliateUrl.includes('meli.la') ? input.affiliateUrl.trim() : undefined,
      tracking_data: {
        campaign: input.campaign,
        destination: input.destination,
        sub_ids: input.subIds,
        source: 'mercadolivre_affiliate_portal',
      },
      created_at: new Date().toISOString(),
    };
  }
}
