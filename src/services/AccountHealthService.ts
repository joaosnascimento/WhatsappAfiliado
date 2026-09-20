import { query } from '../infrastructure/database.ts';
import { decryptCredentials } from '../infrastructure/encryption.ts';
import { ShopeeAffiliateAdapter } from '../../integrations/shopee/ShopeeAffiliateAdapter.ts';
import { MercadoLivreOfficialSessionProvider } from '../../integrations/mercadolivre/MercadoLivreOfficialSessionProvider.ts';

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
            const account = {
              id: row.id,
              workspace_id: row.workspace_id,
              marketplace: 'MERCADOLIVRE' as const,
              status: c.ml_session_status === 'CONNECTED' ? 'CONNECTED' as const : 'AWAITING_CONFIG' as const,
              status_message: c.ml_session_status === 'CONNECTED' ? 'Sessão conectada.' : 'Conecte a conta pelo navegador.',
              credentials_encrypted: c,
              created_at: row.created_at,
              updated_at: row.updated_at,
            };
            const health = await MercadoLivreOfficialSessionProvider.status(account);
            result = {
              overall_status: health.connected ? 'SUCCESS' : 'WARNING',
              steps: [{ step: 'Sessão do navegador', status: health.connected ? 'SUCCESS' : 'WARNING', message: health.connected ? 'Sessão do Mercado Livre ativa.' : 'Sessão do Mercado Livre não está conectada.' }],
            };
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
