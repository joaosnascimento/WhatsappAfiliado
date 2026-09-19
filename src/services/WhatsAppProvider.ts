import type { Destination, Publication } from '../types/affiliate.ts';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  sentAt: string;
  error?: string;
  provider: 'WHATSAPP_CLOUD_API' | 'WEBHOOK_GATEWAY' | 'SIMULATOR';
}

export class WhatsAppProvider {
  private apiToken?: string;
  private phoneNumberId?: string;

  constructor(apiToken?: string, phoneNumberId?: string) {
    this.apiToken = apiToken || process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  public async sendPublication(
    publication: Publication,
    destination: Destination
  ): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();

    if (!this.apiToken || !this.phoneNumberId) {
      return {
        success: false,
        sentAt: timestamp,
        error: 'WhatsApp não configurado. Nenhuma mensagem foi enviada. O modo simulador foi removido do caminho de produção.',
        provider: 'SIMULATOR',
      };
    }

    // Meta Cloud API is not a generic API for arbitrary WhatsApp groups/channels.
    // Never silently send a group/channel destination as an individual recipient.
    if (destination.type !== 'WHATSAPP_BROADCAST') {
      return {
        success: false,
        sentAt: timestamp,
        error: 'O provedor WhatsApp Cloud API configurado não suporta este destino como grupo/canal. Configure um provedor explicitamente compatível com o destino antes de publicar.',
        provider: 'WHATSAPP_CLOUD_API',
      };
    }

    try {
      const url = `https://graph.facebook.com/v23.0/${this.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: destination.identifier,
          type: 'text',
          text: { preview_url: true, body: publication.message },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return {
          success: false,
          sentAt: timestamp,
          error: `WhatsApp Cloud API HTTP ${res.status}: ${errBody}`,
          provider: 'WHATSAPP_CLOUD_API',
        };
      }

      const data = await res.json();
      const messageId = data.messages?.[0]?.id;
      if (!messageId) {
        return {
          success: false,
          sentAt: timestamp,
          error: 'O provedor retornou sucesso HTTP, mas não informou o ID da mensagem.',
          provider: 'WHATSAPP_CLOUD_API',
        };
      }

      return {
        success: true,
        messageId,
        sentAt: timestamp,
        provider: 'WHATSAPP_CLOUD_API',
      };
    } catch (err) {
      return {
        success: false,
        sentAt: timestamp,
        error: (err as Error).message,
        provider: 'WHATSAPP_CLOUD_API',
      };
    }
  }
}
