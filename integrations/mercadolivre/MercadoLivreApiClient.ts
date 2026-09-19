import { MercadoLivreOAuthService } from './MercadoLivreOAuthService.ts';

export interface MercadoLivreApiConfig {
  accessToken?: string;
  refreshToken?: string;
  oauthService?: MercadoLivreOAuthService;
  onTokenRefreshed?: (newToken: string, newRefresh: string, expiresIn: number) => void;
  maxRetries?: number;
}

export interface MercadoLivreRequestOptions extends RequestInit {
  /**
   * Public catalog endpoints do not need the user's OAuth token.
   * Keeping the token off those requests avoids PolicyAgent denying a
   * public resource because the application/user lacks a private scope.
   */
  authenticated?: boolean;
}

export class MercadoLivreApiClient {
  private accessToken?: string;
  private refreshToken?: string;
  private oauthService?: MercadoLivreOAuthService;
  private onTokenRefreshed?: (newToken: string, newRefresh: string, expiresIn: number) => void;
  private maxRetries: number;
  private readonly baseUrl = 'https://api.mercadolibre.com';

  constructor(config: MercadoLivreApiConfig = {}) {
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.oauthService = config.oauthService;
    this.onTokenRefreshed = config.onTokenRefreshed;
    this.maxRetries = config.maxRetries ?? 3;
  }

  public setTokens(access: string, refresh?: string): void {
    this.accessToken = access;
    if (refresh) this.refreshToken = refresh;
  }

  public getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /**
   * Executes HTTP request with retry, backoff, and automatic token refresh.
   * Authentication is opt-in per request because Mercado Livre exposes
   * public catalog resources that should be queried without a user token.
   */
  public async request<T>(endpoint: string, options: MercadoLivreRequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const { authenticated = true, ...requestOptions } = options;
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;

      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(requestOptions.headers as Record<string, string> || {}),
      };

      if (authenticated && this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      try {
        const response = await fetch(url, {
          ...requestOptions,
          headers,
        });

        if (authenticated && response.status === 401 && this.refreshToken && this.oauthService) {
          try {
            const tokenData = await this.oauthService.refreshAccessToken(this.refreshToken);
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token;
            if (this.onTokenRefreshed) {
              this.onTokenRefreshed(tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);
            }

            headers['Authorization'] = `Bearer ${this.accessToken}`;
            const retryRes = await fetch(url, { ...requestOptions, headers });
            if (!retryRes.ok) {
              const errBody = await retryRes.text();
              throw new Error(`Mercado Livre API error (${retryRes.status}): ${errBody}`);
            }
            return (await retryRes.json()) as T;
          } catch (refreshErr) {
            throw new Error(`Mercado Livre token refresh failed: ${(refreshErr as Error).message}`);
          }
        }

        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt >= this.maxRetries) {
            throw new Error(`Mercado Livre API transient error (${response.status}) after ${this.maxRetries} retries.`);
          }
          const backoff = Math.pow(2, attempt) * 400;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Mercado Livre API HTTP ${response.status}: ${errBody}`);
        }

        return (await response.json()) as T;
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message.includes('token refresh failed') || attempt >= this.maxRetries) {
          throw error;
        }
        const backoff = Math.pow(2, attempt) * 400;
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    throw new Error('Mercado Livre API request timed out or exceeded retry limit.');
  }
}
