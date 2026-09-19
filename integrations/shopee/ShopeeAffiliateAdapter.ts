import type {
  AffiliateMarketplaceAdapter,
  AffiliateProduct,
  AffiliateLink,
  Conversion,
  IntegrationTestResult,
  MarketplaceType,
} from '../../src/types/affiliate.ts';
import { ShopeeAffiliateApiClient } from './ShopeeAffiliateApiClient.ts';
import { ShopeeAffiliateAuthService } from './ShopeeAffiliateAuthService.ts';
import { ShopeeOfferService } from './ShopeeOfferService.ts';
import { ShopeeLinkService } from './ShopeeLinkService.ts';
import { ShopeeReportService } from './ShopeeReportService.ts';

export class ShopeeAffiliateAdapter implements AffiliateMarketplaceAdapter {
  public readonly marketplace: MarketplaceType = 'SHOPEE';
  private readonly client: ShopeeAffiliateApiClient;
  private readonly authService: ShopeeAffiliateAuthService;
  private readonly offerService: ShopeeOfferService;
  private readonly linkService: ShopeeLinkService;
  private readonly reportService: ShopeeReportService;
  private readonly accountId: string;

  constructor(appId: string, secret: string, accountId: string = 'default_shopee') {
    this.accountId = accountId;
    this.client = new ShopeeAffiliateApiClient({ appId, secret });
    this.authService = new ShopeeAffiliateAuthService(this.client);
    this.offerService = new ShopeeOfferService(this.client);
    this.linkService = new ShopeeLinkService(this.client);
    this.reportService = new ShopeeReportService(this.client);
  }

  public async searchOffers(query: {
    keyword?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    minDiscount?: number;
    page?: number;
    limit?: number;
  }): Promise<AffiliateProduct[]> {
    const res = await this.offerService.searchProductOffers({
      keyword: query.keyword,
      categoryId: query.category,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minDiscount: query.minDiscount,
      page: query.page,
      limit: query.limit,
    });
    return res.products;
  }

  public async getProduct(productId: string): Promise<AffiliateProduct | null> {
    const res = await this.offerService.searchProductOffers({
      keyword: productId,
      limit: 5,
    });
    const found = res.products.find(
      (p) => p.external_product_id === productId || p.id.includes(productId)
    );
    return found || null;
  }

  public async createAffiliateLink(params: {
    originalUrl: string;
    productId: string;
    subIds?: string[];
  }): Promise<AffiliateLink> {
    return this.linkService.generateAffiliateLink({
      originUrl: params.originalUrl,
      productId: params.productId,
      affiliateAccountId: this.accountId,
      subIds: params.subIds,
    });
  }

  public async getReports(params: { startDate: string; endDate: string }): Promise<Conversion[]> {
    const startTimestamp = Math.floor(new Date(params.startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(params.endDate).getTime() / 1000);
    return this.reportService.getConversions(this.accountId, {
      startTime: startTimestamp,
      endTime: endTimestamp,
    });
  }

  public async testConnection(): Promise<IntegrationTestResult> {
    const steps: IntegrationTestResult['steps'] = [];

    // Step 1: Validate AppId and Secret presence
    const appId = this.client.getAppId();
    if (!appId) {
      steps.push({
        step: 'Validação de Credenciais',
        status: 'ERROR',
        message: 'SHOPEE_AFFILIATE_APP_ID não informado.',
      });
      return {
        marketplace: 'SHOPEE',
        overall_status: 'FAILED',
        steps,
        timestamp: new Date().toISOString(),
      };
    }
    steps.push({
      step: 'Validação de Credenciais',
      status: 'SUCCESS',
      message: `App ID presente (${appId.slice(0, 4)}****).`,
    });

    // Step 2: Test SHA-256 signature generation
    const sigTest = this.authService.testSignatureCalculation(appId, 'test_secret_for_sig');
    if (!sigTest) {
      steps.push({
        step: 'Cálculo de Assinatura SHA-256',
        status: 'ERROR',
        message: 'Falha no algoritmo de assinatura SHA-256.',
      });
      return {
        marketplace: 'SHOPEE',
        overall_status: 'FAILED',
        steps,
        timestamp: new Date().toISOString(),
      };
    }
    steps.push({
      step: 'Cálculo de Assinatura SHA-256',
      status: 'SUCCESS',
      message: 'Assinatura matemática SHA256(AppId + Timestamp + Payload + Secret) validada.',
    });

    // Step 3: Test probe query to GraphQL endpoint
    try {
      await this.client.executeGraphQL(`
        query testProbe {
          productOfferV2(page: 1, limit: 1) {
            pageInfo {
              page
              limit
              totalCount
            }
          }
        }
      `);
      steps.push({
        step: 'Acesso à Affiliate Open API GraphQL',
        status: 'SUCCESS',
        message: 'Conexão com https://open-api.affiliate.shopee.com.br/graphql estabelecida.',
      });
    } catch (err: unknown) {
      const error = err as Error;
      steps.push({
        step: 'Acesso à Affiliate Open API GraphQL',
        status: 'ERROR',
        message: `Falha ao consultar API da Shopee: ${error.message}`,
      });
      return {
        marketplace: 'SHOPEE',
        overall_status: 'FAILED',
        steps,
        timestamp: new Date().toISOString(),
      };
    }

    // Step 4: Diagnostics must remain read-only. Never create a real affiliate link just to test connectivity.
    steps.push({
      step: 'Geração de ShortLink',
      status: 'PENDING',
      message: 'Não executada no diagnóstico: generateShortLink cria um link de rastreamento real. A geração ocorre somente no fluxo de publicação/ingestão.',
    });

    return {
      marketplace: 'SHOPEE',
      overall_status: steps.some((s) => s.status === 'ERROR') ? 'FAILED' : 'SUCCESS',
      steps,
      timestamp: new Date().toISOString(),
    };
  }
}
