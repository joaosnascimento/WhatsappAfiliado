import { query } from '../infrastructure/database.ts';
import { encryptCredentials, decryptCredentials } from '../infrastructure/encryption.ts';

export interface WhatsAppSettings { provider:'cloud'|'evolution'; apiToken?:string; phoneNumberId?:string; evolutionApiUrl?:string; evolutionApiKey?:string; evolutionInstance?:string; }

export class WhatsAppSettingsService {
  static async get(workspaceId:string):Promise<WhatsAppSettings> {
    const rows=await query<any>('SELECT settings_encrypted FROM workspace_settings WHERE workspace_id=$1',[workspaceId]);
    if(!rows[0]) return {provider:(process.env.WHATSAPP_PROVIDER||'cloud') as any};
    return decryptCredentials<WhatsAppSettings>(rows[0].settings_encrypted);
  }
  static async save(workspaceId:string,settings:WhatsAppSettings) {
    const rows=await query<any>(`INSERT INTO workspace_settings(workspace_id,settings_encrypted)
      VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET settings_encrypted=EXCLUDED.settings_encrypted,updated_at=NOW() RETURNING workspace_id,updated_at`,
      [workspaceId,encryptCredentials(settings as any)]);
    return rows[0];
  }
}
