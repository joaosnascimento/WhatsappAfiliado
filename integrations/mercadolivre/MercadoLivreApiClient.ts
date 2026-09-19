import { MercadoLivreOAuthService } from './MercadoLivreOAuthService.ts';

export interface MercadoLivreApiConfig {
  accessToken?: string;
  refreshToken?: string;
  oauthService?: MercadoLivreOAuthService;
  onTokenRefreshed?: (newToken: string, newRefresh: string, expiresIn: number) => void;
  maxRetries?: number;
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
   * Executes HTTP request with retry, backoff, and automatic token refresh
   */
  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;

      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Check for token expiration (401) and attempt refresh if available
        if (response.status === 401 && this.refreshToken && this.oauthService) {
          try {
            const tokenData = await this.oauthService.refreshAccessToken(this.refreshToken);
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token;
            if (this.onTokenRefreshed) {
              this.onTokenRefreshed(tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);
            }
            // Retry request with fresh token
            headers['Authorization'] = `Bearer ${this.accessToken}`;
            const retryRes = await fetch(url, { ...options, headers });
            if (!retryRes.ok) {
              const errBody = await retryRes.text();
              throw new Error(`Mercado Livre API error (${retryRes.status}): ${errBody}`);
            }
            return (await retryRes.json()) as T;
          } catch (refreshErr) {
            throw new Error(`Mercado Livre token refresh failed: ${(refreshErr as Error).message}`);
          }
        }

        // Retry on 429 or 5xx
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
