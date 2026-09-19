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

const OFFICIAL_HOSTS = new Set([
  'meli.la',
  'www.meli.la',
  'mercadolivre.com.br',
  'www.mercadolivre.com.br',
  'mercadolibre.com',
  'www.mercadolibre.com',
]);

export class MercadoLivreAffiliateService {
  public static validateAffiliateUrl(url: string, originalUrl: string): MLValidationStatus {
    if (!url || typeof url !== 'string') {
      return { isValidAffiliateLink: false, reason: 'URL de afiliado vazia ou inválida.' };
    }

    const trimmed = url.trim();
    if (trimmed === originalUrl.trim()) {
      return { isValidAffiliateLink: false, reason: 'A URL de afiliado não pode ser a mesma URL comum do produto.' };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { isValidAffiliateLink: false, reason: 'Formato de URL inválido.' };
    }

    if (parsed.protocol !== 'https:') {
      return { isValidAffiliateLink: false, reason: 'O link de afiliado deve usar HTTPS.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!OFFICIAL_HOSTS.has(hostname)) {
      return { isValidAffiliateLink: false, reason: 'O domínio não pertence ao ecossistema oficial do Mercado Livre.' };
    }

    // A URL do domínio do Mercado Livre, sozinha, NÃO prova que é afiliada.
    // meli.la é aceito como formato de shortlink oficial, mas a validação
    // continua sendo uma validação estrutural: a atribuição final é garantida
    // pelo gerador/portal oficial do programa.
    if (hostname !== 'meli.la' && hostname !== 'www.meli.la') {
      const hasKnownAttribution =
        parsed.searchParams.has('matt_tool') ||
        parsed.searchParams.has('tracking_id') ||
        parsed.searchParams.has('affiliate_id') ||
        parsed.pathname.includes('/afiliados/');

      if (!hasKnownAttribution) {
        return {
          isValidAffiliateLink: false,
          reason: 'URL do Mercado Livre sem evidência estrutural de atribuição. Gere o link pelo portal oficial de afiliados.',
        };
      }
    }

    return { isValidAffiliateLink: true };
  }

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
      short_url: /^https:\/\/(www\.)?meli\.la\//i.test(input.affiliateUrl.trim())
        ? input.affiliateUrl.trim()
        : undefined,
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
