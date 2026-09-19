import { randomBytes, createHash } from 'node:crypto';

export interface MercadoLivreOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface MercadoLivreOAuthAuthorization {
  url: string;
  state: string;
  codeVerifier: string;
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

  public createAuthorization(): MercadoLivreOAuthAuthorization {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_REDIRECT_URI são obrigatórios.');
    }

    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: `https://auth.mercadolivre.com.br/authorization?${params.toString()}`,
      state,
      codeVerifier,
    };
  }

  public async exchangeCodeForToken(
    code: string,
    codeVerifier?: string
  ): Promise<MercadoLivreTokenResponse> {
    if (!code) throw new Error('Código de autorização ausente.');
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Credenciais OAuth do Mercado Livre incompletas.');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    if (codeVerifier) params.set('code_verifier', codeVerifier);

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

  public async refreshAccessToken(refreshToken: string): Promise<MercadoLivreTokenResponse> {
    if (!refreshToken) throw new Error('Refresh token ausente.');

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
