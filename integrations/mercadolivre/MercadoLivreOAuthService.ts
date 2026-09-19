export interface MercadoLivreOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface MercadoLivreTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export class MercadoLivreOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: MercadoLivreOAuthConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  /**
   * Generates official Mercado Livre OAuth authorization URL
   * Endpoint: https://auth.mercadolivre.com.br/authorization
   */
  public getAuthorizationUrl(state: string = 'ml_auth'): string {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_REDIRECT_URI são obrigatórios.');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });

    return `https://auth.mercadolivre.com.br/authorization?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access_token and refresh_token
   * Endpoint: https://api.mercadolibre.com/oauth/token
   */
  public async exchangeCodeForToken(code: string): Promise<MercadoLivreTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mercado Livre OAuth exchange failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as MercadoLivreTokenResponse;
  }

  /**
   * Refreshes expired access_token using refresh_token
   */
  public async refreshAccessToken(refreshToken: string): Promise<MercadoLivreTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mercado Livre token refresh failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as MercadoLivreTokenResponse;
  }
}
