import { query } from '../infrastructure/database.ts';
import { encryptCredentials, decryptCredentials } from '../infrastructure/encryption.ts';
import { assertSafeOutboundUrl } from '../security/outboundUrl.ts';

export interface WhatsAppSettings { provider:'cloud'|'evolution'; apiToken?:string; phoneNumberId?:string; evolutionApiUrl?:string; evolutionApiKey?:string; evolutionInstance?:string; }

export class WhatsAppSettingsService {
  static async get(workspaceId:string):Promise<WhatsAppSettings> {
    const rows=await query<any>('SELECT settings_encrypted FROM workspace_settings WHERE workspace_id=$1',[workspaceId]);
    if(!rows[0]) return {provider:(process.env.WHATSAPP_PROVIDER||'cloud') as any};
    return decryptCredentials<WhatsAppSettings & Record<string, unknown>>(rows[0].settings_encrypted) as WhatsAppSettings;
  }
  static async save(workspaceId:string,settings:WhatsAppSettings) {
    if (settings.provider !== 'cloud' && settings.provider !== 'evolution') throw new Error('Provedor WhatsApp inválido.');
    if (settings.provider === 'evolution') {
      if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstance) throw new Error('Evolution API exige URL, chave e instância.');
      const u=await assertSafeOutboundUrl(settings.evolutionApiUrl);
      if (u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('URL da Evolution API deve ser uma origem HTTPS sem credenciais ou caminho.');
      if (!/^[A-Za-z0-9._-]{1,128}$/.test(settings.evolutionInstance)) throw new Error('Nome da instância Evolution inválido.');
    }
    if (settings.provider === 'cloud' && settings.phoneNumberId && !/^\\d{5,32}$/.test(settings.phoneNumberId)) throw new Error('Phone Number ID inválido.');
    const rows=await query<any>(`INSERT INTO workspace_settings(workspace_id,settings_encrypted)
      VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET settings_encrypted=EXCLUDED.settings_encrypted,updated_at=NOW() RETURNING workspace_id,updated_at`,
      [workspaceId,encryptCredentials(settings as any)]);
    return rows[0];
  }
}
