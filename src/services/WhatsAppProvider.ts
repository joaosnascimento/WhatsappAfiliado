import type { Destination, Publication } from '../types/affiliate.ts';

export type WhatsAppProviderName = 'WHATSAPP_CLOUD_API' | 'EVOLUTION_API' | 'WEBHOOK_GATEWAY' | 'SIMULATOR';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  sentAt: string;
  error?: string;
  provider: WhatsAppProviderName;
}

export class WhatsAppProvider {
  private apiToken?: string;
  private phoneNumberId?: string;
  private readonly provider = (process.env.WHATSAPP_PROVIDER || 'cloud').toLowerCase();

  constructor(apiToken?: string, phoneNumberId?: string) {
    this.apiToken = apiToken || process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  public async sendPublication(publication: Publication, destination: Destination): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();

    if (this.provider === 'evolution') {
      return this.sendWithEvolution(publication, destination, timestamp);
    }

    if (!this.apiToken || !this.phoneNumberId) {
      return {
        success: false,
        sentAt: timestamp,
        error: 'WhatsApp não configurado. Nenhuma mensagem foi enviada.',
        provider: 'SIMULATOR',
      };
    }

    if (destination.type !== 'WHATSAPP_BROADCAST') {
      return {
        success: false,
        sentAt: timestamp,
        error: 'O WhatsApp Cloud API oficial não suporta publicação genérica em grupos/canais. Configure WHATSAPP_PROVIDER=evolution para destinos compatíveis com WhatsApp Web.',
        provider: 'WHATSAPP_CLOUD_API',
      };
    }

    try {
      const url = `https://graph.facebook.com/v23.0/${this.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiToken}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: destination.identifier,
          type: 'text',
          text: { preview_url: true, body: publication.message },
        }),
      });

      if (!res.ok) {
        return { success: false, sentAt: timestamp, error: `WhatsApp Cloud API HTTP ${res.status}: ${await res.text()}`, provider: 'WHATSAPP_CLOUD_API' };
      }

      const data = await res.json();
      const messageId = data.messages?.[0]?.id;
      if (!messageId) {
        return { success: false, sentAt: timestamp, error: 'O provedor retornou sucesso HTTP, mas não informou o ID da mensagem.', provider: 'WHATSAPP_CLOUD_API' };
      }

      return { success: true, messageId, sentAt: timestamp, provider: 'WHATSAPP_CLOUD_API' };
    } catch (err) {
      return { success: false, sentAt: timestamp, error: (err as Error).message, provider: 'WHATSAPP_CLOUD_API' };
    }
  }

  private async sendWithEvolution(publication: Publication, destination: Destination, timestamp: string): Promise<WhatsAppSendResult> {
    const baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;

    if (!baseUrl || !apiKey || !instance) {
      return {
        success: false,
        sentAt: timestamp,
        error: 'Evolution API não configurada. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.',
        provider: 'EVOLUTION_API',
      };
    }

    if (!destination.identifier) {
      return { success: false, sentAt: timestamp, error: 'Destino WhatsApp sem identifier.', provider: 'EVOLUTION_API' };
    }

    try {
      const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          number: destination.identifier,
          text: publication.message,
          linkPreview: true,
        }),
      });

      const bodyText = await res.text();
      let data: any = {};
      try { data = bodyText ? JSON.parse(bodyText) : {}; } catch { /* preserve raw provider response below */ }

      if (!res.ok) {
        return { success: false, sentAt: timestamp, error: `Evolution API HTTP ${res.status}: ${bodyText}`, provider: 'EVOLUTION_API' };
      }

      const messageId = data?.key?.id || data?.response?.key?.id || data?.message?.key?.id;
      if (!messageId) {
        return { success: false, sentAt: timestamp, error: 'Evolution API respondeu sem ID de mensagem; envio não foi considerado confirmado.', provider: 'EVOLUTION_API' };
      }

      return { success: true, messageId, sentAt: timestamp, provider: 'EVOLUTION_API' };
    } catch (err) {
      return { success: false, sentAt: timestamp, error: (err as Error).message, provider: 'EVOLUTION_API' };
    }
  }
}
