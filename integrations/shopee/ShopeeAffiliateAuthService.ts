import { ShopeeAffiliateApiClient } from './ShopeeAffiliateApiClient.ts';
import { ShopeeSignatureService } from './ShopeeSignatureService.ts';

export interface ShopeeValidationResult {
  valid: boolean;
  message: string;
  signatureTestPassed: boolean;
  apiAccessPassed: boolean;
  details?: Record<string, unknown>;
}

export class ShopeeAffiliateAuthService {
  private client: ShopeeAffiliateApiClient;

  constructor(client: ShopeeAffiliateApiClient) {
    this.client = client;
  }

  /**
   * Validates local signature calculation logic
   */
  public testSignatureCalculation(appId: string, secret: string): boolean {
    const testTimestamp = 1710000000;
    const testPayload = '{"query":"query { test }"}';
    const sig = ShopeeSignatureService.calculateSignature({
      appId,
      secret,
      timestamp: testTimestamp,
      payload: testPayload,
    });

    return (
      typeof sig === 'string' &&
      sig.length === 64 &&
      ShopeeSignatureService.validateSignature(
        { appId, secret, timestamp: testTimestamp, payload: testPayload },
        sig
      )
    );
  }

  /**
   * Validates Shopee Affiliate Open API connectivity
   */
  public async validateCredentials(appId: string, secret: string): Promise<ShopeeValidationResult> {
    if (!appId || !secret) {
      return {
        valid: false,
        message: 'SHOPEE_AFFILIATE_APP_ID e SHOPEE_AFFILIATE_SECRET são obrigatórios.',
        signatureTestPassed: false,
        apiAccessPassed: false,
      };
    }

    const sigPassed = this.testSignatureCalculation(appId, secret);
    if (!sigPassed) {
      return {
        valid: false,
        message: 'Falha no teste matemático da assinatura SHA-256.',
        signatureTestPassed: false,
        apiAccessPassed: false,
      };
    }

    try {
      // Execute lightweight probe query
      const probeQuery = `
        query testProbe {
          productOfferV2(page: 1, limit: 1) {
            pageInfo {
              page
              limit
              totalCount
            }
          }
        }
      `;
      await this.client.executeGraphQL(probeQuery, {});

      return {
        valid: true,
        message: 'Autenticação e permissões Shopee Affiliate Open API validadas com sucesso.',
        signatureTestPassed: true,
        apiAccessPassed: true,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        valid: false,
        message: error.message,
        signatureTestPassed: true,
        apiAccessPassed: false,
        details: { error: error.message },
      };
    }
  }
}
