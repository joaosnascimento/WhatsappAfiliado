import type {
  AffiliateMarketplaceAdapter,
  AffiliateProduct,
  AffiliateLink,
  Conversion,
  IntegrationTestResult,
  MarketplaceType,
} from '../../src/types/affiliate.ts';
import { MercadoLivreApiClient } from './MercadoLivreApiClient.ts';
import { MercadoLivreProductService } from './MercadoLivreProductService.ts';
import { MercadoLivreOAuthService } from './MercadoLivreOAuthService.ts';
import { MercadoLivreAffiliateService } from './MercadoLivreAffiliateService.ts';
import { MercadoLivreAffiliateFallback } from './MercadoLivreAffiliateFallback.ts';

export class MercadoLivreAffiliateAdapter implements AffiliateMarketplaceAdapter {
  public readonly marketplace: MarketplaceType = 'MERCADOLIVRE';
  private readonly client: MercadoLivreApiClient;
  private readonly productService: MercadoLivreProductService;
  private readonly oauthService?: MercadoLivreOAuthService;
  private readonly accountId: string;
  private readonly affiliateFallback: MercadoLivreAffiliateFallback;

  constructor(params: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
    accountId?: string;
    onTokenRefreshed?: (newToken: string, newRefresh: string, expiresIn: number) => void;
  }) {
    this.accountId = params.accountId || 'default_ml';
    this.affiliateFallback = new MercadoLivreAffiliateFallback({ apiKey: params.botDoAfiliadoApiKey });

    if (params.clientId && params.clientSecret && params.redirectUri) {
      this.oauthService = new MercadoLivreOAuthService({
        clientId: params.clientId,
        clientSecret: params.clientSecret,
        redirectUri: params.redirectUri,
      });
    }

    this.client = new MercadoLivreApiClient({
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      oauthService: this.oauthService,
      onTokenRefreshed: params.onTokenRefreshed,
    });

    this.productService = new MercadoLivreProductService(this.client);
  }

  public async searchOffers(query: {
    keyword?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }): Promise<AffiliateProduct[]> {
    const offset = query.page && query.limit ? (query.page - 1) * query.limit : 0;
    const res = await this.productService.searchItems({
      query: query.keyword,
      category: query.category,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      limit: query.limit || 20,
      offset,
    });
    return res.products;
  }

  public async getProduct(productId: string): Promise<AffiliateProduct | null> {
    try {
      return await this.productService.getItem(productId);
    } catch {
      return null;
    }
  }

  /**
   * For Mercado Livre, automatic link generation via open API is not supported
   * without dedicated affiliate platform tokens. If a pre-validated affiliateUrl is provided,
   * it associates it cleanly; otherwise it requires manual import as per Rule 4.
   */
  public async createAffiliateLink(params: {
    originalUrl: string;
    productId: string;
    subIds?: string[];
    affiliateUrl?: string;
  }): Promise<AffiliateLink> {
    let affiliateUrl = params.affiliateUrl?.trim();

    if (!affiliateUrl && this.affiliateFallback.isConfigured()) {
      const converted = await this.affiliateFallback.convertLink(params.originalUrl);
      affiliateUrl = converted.affiliateUrl;
    }

    if (!affiliateUrl) {
      throw new Error(
        'Mercado Livre não conseguiu gerar o link automaticamente. Configure BOT_DO_AFILIADO_API_KEY ou associe manualmente um link oficial do programa de afiliados.'
      );
    }

    return MercadoLivreAffiliateService.associateAffiliateLink({
      productId: params.productId,
      originalUrl: params.originalUrl,
      affiliateUrl,
      affiliateAccountId: this.accountId,
      subIds: params.subIds,
    });
  }

  public async getReports(): Promise<Conversion[]> {
    throw new Error('Relatórios de afiliados do Mercado Livre não estão expostos por este adaptador como API pública de afiliados. O sistema não fabrica conversões; conecte uma fonte oficial de relatórios quando disponível.');
  }

  public async testConnection(): Promise<IntegrationTestResult> {
    const steps: IntegrationTestResult['steps'] = [];

    // Step 1: Check OAuth / App credentials configuration
    if (!this.oauthService) {
      steps.push({
        step: 'Validação de Credenciais DevCenter',
        status: 'WARNING',
        message: 'MERCADOLIVRE_CLIENT_ID / CLIENT_SECRET não configurados. Acesso limitado à API pública de catálogo.',
      });
    } else {
      steps.push({
        step: 'Validação de Credenciais DevCenter',
        status: 'SUCCESS',
        message: 'Credenciais de aplicação DevCenter registradas com sucesso.',
      });
    }

    // Step 2: Validate OAuth Token state if present
    const token = this.client.getAccessToken();
    if (token) {
      try {
        const userRes = await this.client.request<{ id: number; nickname: string }>('/users/me');
        steps.push({
          step: 'Autenticação de Usuário (OAuth)',
          status: 'SUCCESS',
          message: `Conectado como ${userRes.nickname} (ID: ${userRes.id}).`,
        });
      } catch (err) {
        steps.push({
          step: 'Autenticação de Usuário (OAuth)',
          status: 'ERROR',
          message: `Token inválido ou expirado: ${(err as Error).message}`,
        });
      }
    } else {
      steps.push({
        step: 'Autenticação de Usuário (OAuth)',
        status: 'PENDING',
        message: 'Aguardando autorização do usuário via botão "Conectar Mercado Livre".',
      });
    }

    // Step 3: Test MLB Catalog Search API
    try {
      const searchTest = await this.productService.searchItems({ query: 'smartphone', limit: 1 });
      steps.push({
        step: 'Consulta à API de Produtos (MLB)',
        status: 'SUCCESS',
        message: `Busca no catálogo ativa. ${searchTest.total} itens localizados na amostra.`,
      });
    } catch (err) {
      steps.push({
        step: 'Consulta à API de Produtos (MLB)',
        status: 'ERROR',
        message: `Falha na consulta à API do Mercado Livre: ${(err as Error).message}`,
      });
    }

    // Step 4: Validate Affiliate Link Rules
    steps.push({
      step: 'Mecanismo de Validação de Afiliados (Segurança)',
      status: 'SUCCESS',
      message: 'Regra de bloqueio de links comuns ativada. O sistema só publica links afiliados validados.',
    });

    steps.push({
      step: 'Conversão automática de afiliado',
      status: this.affiliateFallback.isConfigured() ? 'SUCCESS' : 'WARNING',
      message: this.affiliateFallback.isConfigured()
        ? 'Fallback automático do Bot do Afiliado configurado para gerar links do Mercado Livre.'
        : 'BOT_DO_AFILIADO_API_KEY não configurada; a associação automática permanece desativada.',
    });

    return {
      marketplace: 'MERCADOLIVRE',
      overall_status: steps.some((s) => s.status === 'ERROR') ? 'FAILED' : 'SUCCESS',
      steps,
      timestamp: new Date().toISOString(),
    };
  }
}
