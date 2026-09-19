import { query } from '../infrastructure/database.ts';
import { decryptCredentials } from '../infrastructure/encryption.ts';
import { ShopeeAffiliateAdapter } from '../../integrations/shopee/ShopeeAffiliateAdapter.ts';
import { AnalyticsService } from './AnalyticsService.ts';

export class ConversionSyncService {
  private static running=false;
  static async tick() {
    if(this.running) return;
    this.running=true;
    try {
      const accounts=await query<any>('SELECT * FROM marketplace_accounts WHERE marketplace=\'SHOPEE\'');
      const end=new Date();
      const start=new Date(Date.now()-48*3600000);
      for(const account of accounts){
        try{
          const creds=decryptCredentials<any>(account.credentials_encrypted);
          const appId=creds.shopee_app_id || process.env.SHOPEE_AFFILIATE_APP_ID || '';
          const secret=creds.shopee_secret || process.env.SHOPEE_AFFILIATE_SECRET || '';
          if(!appId||!secret) continue;
          const conversions=await new ShopeeAffiliateAdapter(appId,secret,account.id).getReports({startDate:start.toISOString(),endDate:end.toISOString()});
          for(const conversion of conversions){
            const exists=await query<{id:string}>(`SELECT id FROM analytics_events WHERE workspace_id=$1 AND event_type='CONVERSION' AND marketplace='SHOPEE' AND external_id=$2 LIMIT 1`,[account.workspace_id,conversion.external_id]);
            if(exists.length) continue;
            await AnalyticsService.trackConversion({
              workspaceId:account.workspace_id,marketplace:'SHOPEE',externalId:conversion.external_id,
              offerId:conversion.offer_id,destinationId:conversion.destination_id,subId:conversion.sub_id,
              valueBrl:conversion.order_amount,commissionBrl:conversion.commission,
              metadata:{status:conversion.status,affiliateAccountId:account.id,source:'shopee_affiliate_report'}
            });
          }
        }catch(error){ console.error('Shopee conversion sync failed for account',account.id,(error as Error).message); }
      }
    }finally{this.running=false;}
  }
}
