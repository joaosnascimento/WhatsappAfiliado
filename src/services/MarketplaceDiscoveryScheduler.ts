import { query } from '../infrastructure/database.ts';
import { decryptCredentials, encryptCredentials } from '../infrastructure/encryption.ts';
import { ShopeeAffiliateAdapter } from '../../integrations/shopee/ShopeeAffiliateAdapter.ts';
import { MercadoLivreAffiliateAdapter } from '../../integrations/mercadolivre/MercadoLivreAffiliateAdapter.ts';
import { MercadoLivreOfficialSessionProvider } from '../../integrations/mercadolivre/MercadoLivreOfficialSessionProvider.ts';
import { CouponService } from './CouponService.ts';
import type { AffiliateProduct, Offer, MarketplaceType } from '../types/affiliate.ts';

type DestinationRow = { id: string; workspace_id: string; config: any; is_active: boolean };
type PriceObservation = { price: number; observed_at: string };
type State = { products?: AffiliateProduct[]; links?: any[]; offers?: Offer[]; campaigns?: any[]; destinations?: any[]; publications?: any[]; conversions?: any[]; price_history?: Record<string, PriceObservation[]> };

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }

function productMatches(product: AffiliateProduct, destination: any): boolean {
  const config = destination.config || {};
  const haystack = [product.title, product.category || '', product.metadata ? JSON.stringify(product.metadata) : ''].join(' ').toLowerCase();
  const categories: string[] = config.categories || [];
  const keywords: string[] = config.keywords || [];
  if (categories.length && !categories.some(c => haystack.includes(c.toLowerCase()))) return false;
  if (keywords.length && !keywords.some(k => haystack.includes(k.toLowerCase()))) return false;
  return true;
}

export class MarketplaceDiscoveryScheduler {
  private static running = false;

  public static async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let discovered = 0;
    try {
      const destinations = await query<DestinationRow>('SELECT id, workspace_id, config, is_active FROM destinations WHERE is_active=true');
      const grouped = new Map<string, DestinationRow[]>();
      for (const d of destinations) {
        const list = grouped.get(d.workspace_id) || [];
        list.push(d);
        grouped.set(d.workspace_id, list);
      }

      for (const [workspaceId, workspaceDestinations] of grouped) {
        const stateRows = await query<{ state: State }>('SELECT state FROM workspace_state WHERE workspace_id=$1', [workspaceId]);
        const state: any = stateRows[0]?.state || { products: [], links: [], offers: [], campaigns: [], destinations: [], publications: [], conversions: [] };
        state.products ||= [];
        state.links ||= [];
        state.offers ||= [];
        state.price_history ||= {};

        const accounts = await query<any>(
          'SELECT id, marketplace, credentials_encrypted FROM marketplace_accounts WHERE workspace_id=$1',
          [workspaceId],
        );

        const accountByMarketplace = new Map<MarketplaceType, any>();
        for (const row of accounts) {
          accountByMarketplace.set(row.marketplace, { ...row, credentials: decryptCredentials<any>(row.credentials_encrypted) });
        }

        const jobs = new Map<string, { marketplace: MarketplaceType; keyword: string; category?: string }>();
        for (const destination of workspaceDestinations) {
          const config = destination.config || {};
          const marketplaces: MarketplaceType[] = config.marketplaces || ['SHOPEE', 'MERCADOLIVRE'];
          const keywords: string[] = config.keywords?.length ? config.keywords.slice(0, 5) : ['ofertas'];
          for (const marketplace of marketplaces) {
            for (const keyword of unique(keywords)) {
              const key = `${marketplace}:${keyword}:${(config.categories || []).join('|')}`;
              jobs.set(key, { marketplace, keyword, category: config.categories?.[0] });
            }
          }
        }

        for (const job of jobs.values()) {
          const account = accountByMarketplace.get(job.marketplace);
          if (!account) continue;
          const credentials = account.credentials || {};

          let products: AffiliateProduct[] = [];
          if (job.marketplace === 'SHOPEE') {
            const appId = credentials.shopee_app_id || process.env.SHOPEE_AFFILIATE_APP_ID || '';
            const secret = credentials.shopee_secret || process.env.SHOPEE_AFFILIATE_SECRET || '';
            if (!appId || !secret) continue;
            const adapter = new ShopeeAffiliateAdapter(appId, secret, account.id);
            products = await adapter.searchOffers({ keyword: job.keyword, limit: 10 });
            for (const product of products) {
              const existingOffer = state.offers.find((o: Offer) => o.product?.external_product_id === product.external_product_id && o.marketplace === 'SHOPEE');
              const existingLink = state.links.find((l: any) => l.product_id === product.id);
              if (existingOffer?.affiliate_url) {
                product.affiliate_url = existingOffer.affiliate_url;
                continue;
              }
              if (existingLink?.affiliate_url) {
                product.affiliate_url = existingLink.affiliate_url;
                continue;
              }
              try {
                const link = await adapter.createAffiliateLink({ originalUrl: product.original_url, productId: product.external_product_id, subIds: ['whatsapp', 'auto'] });
                state.links.push(link);
                product.affiliate_url = link.affiliate_url;
              } catch {
                // Product remains discovered/validated; it is not published without a real affiliate link.
              }
            }
          } else {
            const mlAccount = {
              id: account.id,
              workspace_id: workspaceId,
              marketplace: 'MERCADOLIVRE' as const,
              status: account.credentials?.ml_session_status === 'CONNECTED' ? 'CONNECTED' as const : 'AWAITING_CONFIG' as const,
              status_message: account.credentials?.ml_session_status === 'CONNECTED' ? 'Sessão conectada.' : 'Conecte a conta Mercado Livre pelo navegador.',
              credentials_encrypted: account.credentials || {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            try {
              products = await MercadoLivreOfficialSessionProvider.discover(mlAccount, job.keyword, 10);
              for (const product of products) {
                try {
                  const link = await MercadoLivreOfficialSessionProvider.generateLink(mlAccount, product.original_url, ['whatsapp', 'auto']);
                  product.affiliate_url = link;
                  state.links.push({
                    id: `link_ml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    marketplace: 'MERCADOLIVRE',
                    affiliate_account_id: account.id,
                    product_id: product.id,
                    original_url: product.original_url,
                    affiliate_url: link,
                    short_url: link,
                    tracking_data: { sub_ids: ['whatsapp', 'auto'], source: 'mercadolivre_official_browser' },
                    created_at: new Date().toISOString(),
                  });
                } catch (error) {
                  product.metadata = { ...(product.metadata || {}), affiliate_error: (error as Error).message };
                }
              }
              if (mlAccount.credentials_encrypted.ml_session_state) {
                void query(
                  'UPDATE marketplace_accounts SET credentials_encrypted=$2, status=$3, status_message=$4, updated_at=NOW() WHERE id=$1 AND workspace_id=$5',
                  [account.id, encryptCredentials(mlAccount.credentials_encrypted), mlAccount.credentials_encrypted.ml_session_status === 'CONNECTED' ? 'CONNECTED' : 'AWAITING_CONFIG', mlAccount.status_message, workspaceId],
                );
              }
            } catch (error) {
              console.error('Mercado Livre browser discovery failed:', error);
            }
          }
          for (const product of products.filter(p => workspaceDestinations.some(d => productMatches(p, d)))) {
            const historyKey = product.marketplace + ':' + product.external_product_id;
            const nowIso = new Date().toISOString();
            const historyDays = Math.max(7, Number(process.env.REAL_DEAL_HISTORY_DAYS || 30));
            const minRealDiscount = Math.max(1, Number(process.env.REAL_DEAL_MIN_DISCOUNT_PERCENT || 10));
            const cutoff = Date.now() - historyDays * 24 * 60 * 60 * 1000;
            const previousHistory = (state.price_history[historyKey] || []).filter((item: PriceObservation) => Number.isFinite(item.price) && item.price > 0 && new Date(item.observed_at).getTime() >= cutoff);
            const previousPrices = previousHistory.map((item: PriceObservation) => item.price).filter((price: number) => price > 0);
            const previousLowest = previousPrices.length ? Math.min(...previousPrices) : undefined;
            const displayedDiscount = Number(product.discount || 0);
            const historicalDeal = previousLowest !== undefined && product.price > 0 && product.price <= previousLowest && displayedDiscount >= minRealDiscount;
            state.price_history[historyKey] = [...previousHistory, { price: product.price, observed_at: nowIso }].sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()).slice(-100);
            const dealMetadata = { ...(product.metadata || {}), historical_deal_verified: historicalDeal, historical_lowest_price: previousLowest, historical_price_days: historyDays, real_deal_min_discount: minRealDiscount, price_history_observations: previousPrices.length };
            product.metadata = dealMetadata;
            const existing = state.offers.find((o: Offer) => o.product?.external_product_id === product.external_product_id && o.marketplace === product.marketplace);
            const affiliateUrl = product.affiliate_url || existing?.affiliate_url;
            const status: Offer['status'] = affiliateUrl ? 'AFFILIATE_LINK_READY' : 'VALIDATED';
            if (existing) {
              existing.product = { ...existing.product, ...product, affiliate_url: affiliateUrl };
              existing.status_reason = historicalDeal ? undefined : 'Oferta não confirmada como promoção real: aguardando histórico de preço e desconto mínimo.';
              existing.price = product.price;
              existing.original_price = product.original_price;
              existing.discount = product.discount;
              existing.commission = product.commission;
              existing.status = status;
              existing.last_seen_at = new Date().toISOString();
              if (affiliateUrl) existing.affiliate_url = affiliateUrl;
            } else {
              const offer: Offer = {
                id: `offer_auto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                product_id: product.id,
                product: { ...product, affiliate_url: affiliateUrl },
                marketplace: product.marketplace,
                price: product.price,
                original_price: product.original_price,
                discount: product.discount,
                commission: product.commission,
                score: Math.min(100, Math.round((product.discount || 0) * 1.5 + (product.rating || 0) * 8)),
                status,
                status_reason: historicalDeal ? (affiliateUrl ? undefined : product.marketplace === 'MERCADOLIVRE' ? 'Aguardando link oficial do Programa de Afiliados Mercado Livre.' : 'Link de afiliado ainda não confirmado.') : 'Oferta descoberta, mas ainda não confirmada como promoção real. Aguardando histórico de preço e desconto mínimo.',
                affiliate_url: affiliateUrl,
                first_seen_at: new Date().toISOString(),
                last_seen_at: nowIso,
              };
              state.products.push(product);
              state.offers.push(offer);
            }
            try { const couponOffer = existing || state.offers.find((o: Offer) => o.product?.external_product_id === product.external_product_id && o.marketplace === product.marketplace); if (couponOffer) await CouponService.extractFromOffer(workspaceId, couponOffer); } catch { /* only provider-supplied coupon metadata is persisted */ }
            discovered++;
          }
        }

        await query('UPDATE workspace_state SET state=$2, updated_at=NOW() WHERE workspace_id=$1', [workspaceId, JSON.stringify(state)]);
      }
    } finally {
      this.running = false;
    }
    return discovered;
  }
}
