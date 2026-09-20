import type { AffiliateMarketplaceAdapter, AffiliateProduct, AffiliateLink, Conversion, IntegrationTestResult, MarketplaceType } from '../../src/types/affiliate.ts';
import { MercadoLivreAffiliateService } from './MercadoLivreAffiliateService.ts';

export class MercadoLivreAffiliateAdapter implements AffiliateMarketplaceAdapter {
  public readonly marketplace: MarketplaceType = 'MERCADOLIVRE';
  private readonly accountId: string;

  constructor(params: { accountId?: string }) {
    this.accountId = params.accountId || 'default_ml';
  }

  public async searchOffers(): Promise<AffiliateProduct[]> {
    throw new Error('A descoberta automática pelo catálogo/API do Mercado Livre está desativada. Use uma oferta existente e associe o link oficial gerado no Portal de Afiliados.');
  }

  public async getProduct(): Promise<AffiliateProduct | null> {
    return null;
  }

  public async createAffiliateLink(params: {
    originalUrl: string;
    productId: string;
    subIds?: string[];
    affiliateUrl?: string;
  }): Promise<AffiliateLink> {
    if (!params.affiliateUrl) {
      throw new Error('Gere o link no Portal de Afiliados do Mercado Livre e cole o link oficial nesta oferta.');
    }

    return MercadoLivreAffiliateService.associateAffiliateLink({
      productId: params.productId,
      originalUrl: params.originalUrl,
      affiliateUrl: params.affiliateUrl,
      affiliateAccountId: this.accountId,
      subIds: params.subIds,
    });
  }

  public async getReports(): Promise<Conversion[]> {
    throw new Error('Relatórios de afiliados do Mercado Livre não estão disponíveis neste modelo.');
  }

  public async testConnection(): Promise<IntegrationTestResult> {
    return {
      marketplace: 'MERCADOLIVRE',
      overall_status: 'SUCCESS',
      steps: [
        {
          step: 'Modelo de afiliado',
          status: 'SUCCESS',
          message: 'Integração configurada para o fluxo funcional: gerar o link no Portal de Afiliados do Mercado Livre e associá-lo à oferta.',
        },
        {
          step: 'Geração do link',
          status: 'SUCCESS',
          message: 'A aplicação não depende de OAuth DevCenter nem da API de Catálogo MLB para gerar links de afiliado.',
        },
        {
          step: 'Publicação',
          status: 'SUCCESS',
          message: 'Somente links de afiliado associados e validados podem seguir para publicação no WhatsApp.',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
