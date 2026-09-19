import { query } from '../infrastructure/database.ts';
import { decryptCredentials } from '../infrastructure/encryption.ts';
import { ShopeeAffiliateAdapter } from '../../integrations/shopee/ShopeeAffiliateAdapter.ts';
import { MercadoLivreAffiliateAdapter } from '../../integrations/mercadolivre/MercadoLivreAffiliateAdapter.ts';

export class AccountHealthService {
  private static running = false;
  static async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await query<any>('SELECT * FROM marketplace_accounts');
      for (const row of rows) {
        try {
          const c = decryptCredentials<any>(row.credentials_encrypted);
          let result;
          if (row.marketplace === 'SHOPEE') {
            const appId=c.shopee_app_id || process.env.SHOPEE_AFFILIATE_APP_ID || '';
            const secret=c.shopee_secret || process.env.SHOPEE_AFFILIATE_SECRET || '';
            if (!appId || !secret) throw new Error('Credenciais Shopee ausentes.');
            result = await new ShopeeAffiliateAdapter(appId, secret, row.id).testConnection();
          } else {
            result = await new MercadoLivreAffiliateAdapter({
              clientId:c.ml_client_id || process.env.MERCADOLIVRE_CLIENT_ID,
              clientSecret:c.ml_client_secret || process.env.MERCADOLIVRE_CLIENT_SECRET,
              redirectUri:c.ml_redirect_uri || process.env.MERCADOLIVRE_REDIRECT_URI,
              accessToken:c.ml_access_token, refreshToken:c.ml_refresh_token, accountId:row.id
            }).testConnection();
          }
          const status = result.overall_status === 'FAILED' ? 'AUTH_ERROR' : result.overall_status === 'WARNING' ? 'AWAITING_CONFIG' : 'CONNECTED';
          await query('UPDATE marketplace_accounts SET status=$2,status_message=$3,updated_at=NOW() WHERE id=$1',[row.id,status,result.steps.map((s:any)=>s.message).join(' | ').slice(0,1000)]);
        } catch (e) {
          await query('UPDATE marketplace_accounts SET status=$2,status_message=$3,updated_at=NOW() WHERE id=$1',[row.id,'AUTH_ERROR',(e as Error).message.slice(0,1000)]);
        }
      }
    } finally { this.running=false; }
  }
}
