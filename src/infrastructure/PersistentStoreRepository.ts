import { query, transaction } from './database.ts';
import { encryptCredentials, decryptCredentials } from './encryption.ts';
import type { MarketplaceAccount } from '../types/affiliate.ts';

type State = {
  products: unknown[];
  links: unknown[];
  offers: unknown[];
  campaigns: unknown[];
  destinations: unknown[];
  publications: unknown[];
  conversions: unknown[];
};

export class PersistentStoreRepository {
  constructor(private readonly store: {
    accounts: Map<string, MarketplaceAccount>;
    products: Map<string, unknown>;
    links: Map<string, unknown>;
    offers: Map<string, unknown>;
    campaigns: Map<string, unknown>;
    destinations: Map<string, unknown>;
    publications: Map<string, unknown>;
    conversions: Map<string, unknown>;
  }) {}

  async load(workspaceId: string): Promise<boolean> {
    const accounts = await query<{id:string;workspace_id:string;marketplace:any;status:any;status_message:string|null;credentials_encrypted:string;created_at:string;updated_at:string}>(
      'SELECT id, workspace_id, marketplace, status, status_message, credentials_encrypted, created_at, updated_at FROM marketplace_accounts WHERE workspace_id=$1',
      [workspaceId]
    );
    const stateRows = await query<{state: State}>('SELECT state FROM workspace_state WHERE workspace_id=$1', [workspaceId]);
    if (!accounts.length && !stateRows.length) return false;

    this.store.accounts.clear();
    for (const row of accounts) {
      this.store.accounts.set(row.id, {
        id: row.id, workspace_id: row.workspace_id, marketplace: row.marketplace,
        status: row.status, status_message: row.status_message || undefined, credentials_encrypted: decryptCredentials<MarketplaceAccount['credentials_encrypted']>(row.credentials_encrypted),
        created_at: new Date(row.created_at).toISOString(), updated_at: new Date(row.updated_at).toISOString(),
      });
    }
    if (stateRows[0]) {
      const s = stateRows[0].state;
      this.replace(this.store.products, s.products || []);
      this.replace(this.store.links, s.links || []);
      this.replace(this.store.offers, s.offers || []);
      this.replace(this.store.campaigns, s.campaigns || []);
      this.replace(this.store.destinations, s.destinations || []);
      this.replace(this.store.publications, s.publications || []);
      this.replace(this.store.conversions, s.conversions || []);
    }
    return true;
  }

  async save(workspaceId: string): Promise<void> {
    const state: State = {
      products: [...this.store.products.values()],
      links: [...this.store.links.values()],
      offers: [...this.store.offers.values()],
      campaigns: [...this.store.campaigns.values()],
      destinations: [...this.store.destinations.values()],
      publications: [...this.store.publications.values()],
      conversions: [...this.store.conversions.values()],
    };
    await transaction(async client => {
      for (const account of this.store.accounts.values()) {
        await client.query(
          `INSERT INTO marketplace_accounts (id,workspace_id,marketplace,status,status_message,credentials_encrypted,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id, marketplace=EXCLUDED.marketplace,
             status=EXCLUDED.status, status_message=EXCLUDED.status_message, credentials_encrypted=EXCLUDED.credentials_encrypted, updated_at=EXCLUDED.updated_at`,
          [account.id, account.workspace_id, account.marketplace, account.status, account.status_message || null, encryptCredentials(account.credentials_encrypted), account.created_at, account.updated_at]
        );
      }

      for (const destination of this.store.destinations.values() as Iterable<any>) {
        if (destination.workspace_id !== workspaceId) continue;
        const config = {
          deleted_at: destination.deleted_at || null,
          categories: destination.categories || [],
          marketplaces: destination.marketplaces || [],
          keywords: destination.keywords || [],
          frequency_minutes: destination.frequency_minutes || 60,
          time_start: destination.time_start || '08:00',
          time_end: destination.time_end || '22:00',
          priority: destination.priority || 'NORMAL',
        };
        await client.query(
          `INSERT INTO destinations (id,workspace_id,type,identifier,name,config,is_active,deleted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type,identifier=EXCLUDED.identifier,name=EXCLUDED.name,
             config=EXCLUDED.config,is_active=EXCLUDED.is_active,deleted_at=EXCLUDED.deleted_at`,
          [destination.id, workspaceId, destination.type, destination.identifier, destination.name, JSON.stringify(config), destination.is_active !== false, destination.deleted_at || null]
        );
      }

      for (const publication of this.store.publications.values() as Iterable<any>) {
        if (publication.workspace_id && publication.workspace_id !== workspaceId) continue;
        await client.query(
          `INSERT INTO publications
             (id,workspace_id,offer_id,destination_id,status,idempotency_key,provider_message_id,error,scheduled_at,published_at,affiliate_link_id,affiliate_url,message,tracking_subids)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (id) DO UPDATE SET status=CASE WHEN publications.status IN ('SENT','FAILED') THEN publications.status ELSE EXCLUDED.status END,
             provider_message_id=COALESCE(EXCLUDED.provider_message_id, publications.provider_message_id),
             error=CASE WHEN publications.status IN ('SENT','FAILED') AND EXCLUDED.status NOT IN ('FAILED') THEN publications.error ELSE EXCLUDED.error END,
             scheduled_at=EXCLUDED.scheduled_at,published_at=COALESCE(EXCLUDED.published_at, publications.published_at),
             affiliate_link_id=EXCLUDED.affiliate_link_id,affiliate_url=EXCLUDED.affiliate_url,message=EXCLUDED.message,tracking_subids=EXCLUDED.tracking_subids`,
          [publication.id, workspaceId, publication.offer_id, publication.destination_id, publication.status,
            publication.idempotency_key || publication.id, publication.provider_message_id || null,
            publication.error_message || null, publication.scheduled_at || null, publication.published_at || publication.sent_at || null,
            publication.affiliate_link_id || null, publication.affiliate_url || null, publication.message || null,
            JSON.stringify(publication.tracking_subids || [])]
        );
      }
      await client.query(
        `INSERT INTO workspace_state (workspace_id,state,updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (workspace_id) DO UPDATE SET state=EXCLUDED.state, updated_at=NOW()`,
        [workspaceId, JSON.stringify(state)]
      );
    });
  }

  private replace(map: Map<string, unknown>, values: unknown[]) {
    map.clear();
    for (const value of values) {
      const id = (value as {id?: string}).id;
      if (id) map.set(id, value);
    }
  }
}
