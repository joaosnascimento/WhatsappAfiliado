import { randomUUID } from 'node:crypto';
import { query } from '../infrastructure/database.ts';
import type { MarketplaceType } from '../types/affiliate.ts';

function validateAffiliateUrl(marketplace:MarketplaceType, raw:string) {
  let u:URL; try { u=new URL(raw); } catch { throw new Error('URL de afiliado inválida.'); }
  if (u.protocol !== 'https:') throw new Error('O link de afiliado deve usar HTTPS.');
  const host=u.hostname.toLowerCase();
  const allowed=marketplace==='SHOPEE'
    ? ['shopee.com.br','s.shopee.com.br']
    : ['meli.la','mercadolivre.com.br','mercadolibre.com'];
  if (!allowed.some(d=>host===d || host.endsWith('.'+d))) throw new Error('Domínio não pertence ao marketplace informado.');
  return u.toString();
}

export class AnalyticsService {
  static async trackClick(params: {
    workspaceId: string; marketplace: MarketplaceType; trackedLinkId?: string;
    offerId?: string; destinationId?: string; subId?: string; metadata?: Record<string, unknown>;
  }) {
    await query(
      `INSERT INTO analytics_events
       (id,workspace_id,event_type,marketplace,offer_id,destination_id,sub_id,metadata)
       VALUES ($1,$2,'CLICK',$3,$4,$5,$6,$7)`,
      [randomUUID(), params.workspaceId, params.marketplace, params.offerId || null,
       params.destinationId || null, params.subId || null, JSON.stringify({...params.metadata, trackedLinkId: params.trackedLinkId})]
    );
  }

  static async trackWebhook(workspaceId:string, marketplace:MarketplaceType, metadata:Record<string,unknown>) {
    await query(
      `INSERT INTO analytics_events (id,workspace_id,event_type,marketplace,metadata) VALUES ($1,$2,'WEBHOOK',$3,$4)`,
      [randomUUID(), workspaceId, marketplace, JSON.stringify(metadata)]
    );
  }

  static async trackConversion(params: {
    workspaceId: string; marketplace: MarketplaceType; externalId: string;
    offerId?: string; destinationId?: string; subId?: string; valueBrl?: number; commissionBrl?: number; metadata?: Record<string, unknown>;
  }) {
    await query(
      `INSERT INTO analytics_events
       (id,workspace_id,event_type,marketplace,external_id,offer_id,destination_id,sub_id,value_brl,commission_brl,metadata)
       VALUES ($1,$2,'CONVERSION',$3,$4,$5,$6,$7,$8,$9,$10)`,
      [randomUUID(), params.workspaceId, params.marketplace, params.externalId, params.offerId || null,
       params.destinationId || null, params.subId || null, params.valueBrl ?? null, params.commissionBrl ?? null,
       JSON.stringify(params.metadata || {})]
    );
  }

  static async report(workspaceId: string) {
    const rows = await query<any>(
      `SELECT marketplace,event_type,COUNT(*)::int AS count,
              COALESCE(SUM(value_brl),0)::numeric AS value_brl,
              COALESCE(SUM(commission_brl),0)::numeric AS commission_brl
       FROM analytics_events WHERE workspace_id=$1 GROUP BY marketplace,event_type ORDER BY marketplace,event_type`,
      [workspaceId]
    );
    const byMarketplace: Record<string, any> = {};
    for (const row of rows) {
      const key = row.marketplace || 'UNKNOWN';
      byMarketplace[key] ||= { clicks: 0, conversions: 0, valueBrl: 0, commissionBrl: 0 };
      if (row.event_type === 'CLICK') byMarketplace[key].clicks = Number(row.count);
      if (row.event_type === 'CONVERSION') {
        byMarketplace[key].conversions = Number(row.count);
        byMarketplace[key].valueBrl = Number(row.value_brl);
        byMarketplace[key].commissionBrl = Number(row.commission_brl);
      }
    }
    const totals = Object.values(byMarketplace).reduce((a:any,b:any)=>({
      clicks:a.clicks+b.clicks, conversions:a.conversions+b.conversions,
      valueBrl:a.valueBrl+b.valueBrl, commissionBrl:a.commissionBrl+b.commissionBrl
    }), {clicks:0,conversions:0,valueBrl:0,commissionBrl:0});
    return { byMarketplace, totals };
  }

  static async createTrackedLink(params: {
    workspaceId:string; marketplace:MarketplaceType; affiliateUrl:string;
    affiliateLinkId?:string; offerId?:string; destinationId?:string; subId?:string;
  }) {
    const affiliateUrl=validateAffiliateUrl(params.marketplace,params.affiliateUrl);
    const id = randomUUID();
    const rows = await query<any>(
      `INSERT INTO tracked_links(id,workspace_id,affiliate_link_id,affiliate_url,marketplace,offer_id,destination_id,sub_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(workspace_id,affiliate_url,destination_id,sub_id) DO UPDATE SET affiliate_url=EXCLUDED.affiliate_url
       RETURNING *`,
      [id,params.workspaceId,params.affiliateLinkId||null,affiliateUrl,params.marketplace,
       params.offerId||null,params.destinationId||null,params.subId||null]
    );
    return rows[0];
  }

  static async getTrackedLink(id:string) {
    const rows = await query<any>('SELECT * FROM tracked_links WHERE id=$1', [id]);
    return rows[0] || null;
  }
}
