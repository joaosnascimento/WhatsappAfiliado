export interface MercadoLivreAffiliateFallbackResult {
  originalUrl: string;
  affiliateUrl: string;
  finalUrl?: string;
  site?: string;
  provider?: string;
  trackingId?: string;
}

export class MercadoLivreAffiliateFallback {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(params?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = params?.apiKey || process.env.BOT_DO_AFILIADO_API_KEY || '';
    this.baseUrl = (params?.baseUrl || process.env.BOT_DO_AFILIADO_API_URL || 'https://botdoafiliado.com/api/v1').replace(/\\/$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private assertAffiliateUrl(raw: string): void {
    let url: URL;
    try { url = new URL(raw); } catch { throw new Error('O conversor retornou uma URL de afiliado inválida.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname.length > 253) {
      throw new Error('O conversor retornou uma URL de afiliado insegura.');
    }
  }

  public async convertLink(originalUrl: string): Promise<MercadoLivreAffiliateFallbackResult> {
    if (!this.apiKey) {
      throw new Error('BOT_DO_AFILIADO_API_KEY não configurada.');
    }


    const response = await fetch(`${this.baseUrl}/convert-links`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ url: originalUrl }),
      signal: AbortSignal.timeout(15000),
    });

    const raw = await response.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(`Bot do Afiliado respondeu HTTP ${response.status}.`);
    }

    const item = Array.isArray(data?.items) ? data.items[0] : data;
    if (!item?.ok && data?.success === false) {
      throw new Error(String(item?.error || data?.error || 'Não foi possível converter o link do Mercado Livre.'));
    }

    const affiliateUrl = String(item?.affiliate_url || '').trim();
    const finalUrl = String(item?.final_url || '').trim() || undefined;
    if (!affiliateUrl) {
      throw new Error('O Bot do Afiliado não retornou affiliate_url para o produto.');
    }

    this.assertAffiliateUrl(affiliateUrl);
    if (finalUrl) this.assertAffiliateUrl(finalUrl);

    if (affiliateUrl === originalUrl.trim()) {
      throw new Error('O conversor retornou a mesma URL original; o link não foi considerado afiliado.');
    }

    return {
      originalUrl,
      affiliateUrl,
      finalUrl,
      site: item?.site,
      provider: item?.provider,
      trackingId: item?.tracking_id,
    };
  }
}
