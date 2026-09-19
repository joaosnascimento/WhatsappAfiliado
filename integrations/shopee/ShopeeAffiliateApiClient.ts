import { ShopeeSignatureService } from './ShopeeSignatureService.ts';
import type { ShopeeGraphQLResponse } from '../../src/graphql/types.ts';

export interface ShopeeApiConfig {
  appId: string;
  secret: string;
  endpoint?: string;
  maxRetries?: number;
}

export class ShopeeAffiliateApiClient {
  private readonly appId: string;
  private readonly secret: string;
  private readonly endpoint: string;
  private readonly maxRetries: number;

  constructor(config: ShopeeApiConfig) {
    this.appId = config.appId;
    this.secret = config.secret;
    this.endpoint = config.endpoint || 'https://open-api.affiliate.shopee.com.br/graphql';
    this.maxRetries = config.maxRetries ?? 3;
  }

  public getAppId(): string {
    return this.appId;
  }

  /**
   * Executes a signed GraphQL query against Shopee Affiliate Open API
   */
  public async executeGraphQL<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.appId || !this.secret) {
      throw new Error('Shopee Affiliate credentials (AppId or Secret) not configured.');
    }

    const payloadObj = {
      query: query.trim(),
      variables,
    };
    const payload = JSON.stringify(payloadObj);

    let attempt = 0;
    while (attempt < this.maxRetries) {
      attempt++;
      const timestamp = ShopeeSignatureService.generateTimestamp();
      const headers = ShopeeSignatureService.buildAuthHeaders({
        appId: this.appId,
        secret: this.secret,
        timestamp,
        payload,
      });

      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers,
          body: payload,
        });

        // Fail fast on unrecoverable authentication / authorization errors
        if (response.status === 401 || response.status === 403) {
          const errorText = await response.text();
          throw new Error(
            `Shopee Affiliate Auth Error (${response.status}): Invalid AppId, Secret, or Signature. Details: ${errorText}`
          );
        }

        // Retry on 429 (Rate Limit) or 5xx (Transient Server Errors)
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt >= this.maxRetries) {
            throw new Error(`Shopee API transient error (${response.status}) after ${this.maxRetries} retries.`);
          }
          const backoffDelay = Math.pow(2, attempt) * 500;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Shopee API HTTP ${response.status}: ${errorBody}`);
        }

        const json = (await response.json()) as ShopeeGraphQLResponse<T>;

        if (json.errors && json.errors.length > 0) {
          const firstErr = json.errors[0];
          throw new Error(`Shopee GraphQL Error: ${firstErr.message}`);
        }

        if (!json.data) {
          throw new Error('Shopee GraphQL Response missing data field');
        }

        return json.data;
      } catch (err: unknown) {
        const error = err as Error;
        // Don't retry auth errors or validation errors
        if (
          error.message.includes('Auth Error') ||
          error.message.includes('credentials') ||
          attempt >= this.maxRetries
        ) {
          throw error;
        }

        const backoffDelay = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    throw new Error('Shopee GraphQL request timed out or exceeded retry limit.');
  }
}
