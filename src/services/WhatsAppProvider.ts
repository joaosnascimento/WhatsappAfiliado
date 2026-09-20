import type { Destination, Publication } from '../types/affiliate.ts';
import { assertSafeOutboundUrl } from '../security/outboundUrl.ts';

export type WhatsAppProviderName = 'WHATSAPP_CLOUD_API' | 'EVOLUTION_API' | 'WEBHOOK_GATEWAY' | 'SIMULATOR';

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  sentAt: string;
  error?: string;
  provider: WhatsAppProviderName;
}

function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

export class WhatsAppProvider {
  private apiToken?: string;
  private phoneNumberId?: string;
  private settings?: { provider?: string; apiToken?: string; phoneNumberId?: string; evolutionApiUrl?: string; evolutionApiKey?: string; evolutionInstance?: string };
  private readonly provider = (process.env.WHATSAPP_PROVIDER || 'cloud').toLowerCase();

  constructor(apiToken?: string, phoneNumberId?: string, settings?: { provider?: string; apiToken?: string; phoneNumberId?: string; evolutionApiUrl?: string; evolutionApiKey?: string; evolutionInstance?: string }) {
    this.settings = settings;
    this.apiToken = apiToken || settings?.apiToken || process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = phoneNumberId || settings?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  public async sendPublication(publication: Publication, destination: Destination): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();
    const selectedProvider = String(this.settings?.provider || this.provider).toLowerCase();

    if (selectedProvider === 'evolution') return this.sendWithEvolution(publication, destination, timestamp);

    if (!this.apiToken || !this.phoneNumberId) {
      return { success: false, sentAt: timestamp, error: 'WhatsApp não configurado. Nenhuma mensagem foi enviada.', provider: 'WHATSAPP_CLOUD_API' };
    }

    if (destination.type !== 'WHATSAPP_BROADCAST') {
      return { success: false, sentAt: timestamp, error: 'O provedor oficial não suporta publicação genérica neste tipo de destino.', provider: 'WHATSAPP_CLOUD_API' };
    }

    const { controller, timeout } = timeoutSignal(Number(process.env.OUTBOUND_REQUEST_TIMEOUT_MS || 15000));
    try {
      const res = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(this.phoneNumberId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiToken}` },
        signal: controller.signal,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: destination.identifier,
          type: publication.image_url ? 'image' : 'text',
          ...(publication.image_url
            ? { image: { link: publication.image_url, caption: publication.message } }
            : { text: { preview_url: true, body: publication.message } }),
        }),
      });

      if (!res.ok) {
        await res.text();
        return { success: false, sentAt: timestamp, error: `WhatsApp Cloud API HTTP ${res.status}.`, provider: 'WHATSAPP_CLOUD_API' };
      }

      const data = await res.json() as any;
      const messageId = data?.messages?.[0]?.id;
      if (!messageId) return { success: false, sentAt: timestamp, error: 'O provedor não confirmou o ID da mensagem.', provider: 'WHATSAPP_CLOUD_API' };

      return { success: true, messageId: String(messageId), sentAt: timestamp, provider: 'WHATSAPP_CLOUD_API' };
    } catch (err) {
      return { success: false, sentAt: timestamp, error: err instanceof Error && err.name === 'AbortError' ? 'Timeout no provedor WhatsApp.' : 'Falha na comunicação com o provedor WhatsApp.', provider: 'WHATSAPP_CLOUD_API' };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendWithEvolution(publication: Publication, destination: Destination, timestamp: string): Promise<WhatsAppSendResult> {
    const baseUrl = (this.settings?.evolutionApiUrl || process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const apiKey = this.settings?.evolutionApiKey || process.env.EVOLUTION_API_KEY;
    const instance = this.settings?.evolutionInstance || process.env.EVOLUTION_INSTANCE;

    if (!baseUrl || !apiKey || !instance) {
      return { success: false, sentAt: timestamp, error: 'Evolution API não configurada.', provider: 'EVOLUTION_API' };
    }
    if (!destination.identifier) {
      return { success: false, sentAt: timestamp, error: 'Destino WhatsApp sem identifier.', provider: 'EVOLUTION_API' };
    }

    const { controller, timeout } = timeoutSignal(Number(process.env.OUTBOUND_REQUEST_TIMEOUT_MS || 15000));
    try {
      const safeBase = await assertSafeOutboundUrl(baseUrl);
      let imageUrl: string | undefined;
      if (publication.image_url) imageUrl = (await assertSafeOutboundUrl(publication.image_url)).toString();
      const endpoint = publication.image_url ? 'sendMedia' : 'sendText';
      const res = await fetch(`${safeBase.toString().replace(/\/$/, '')}/message/${endpoint}/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        signal: controller.signal,
        body: publication.image_url
          ? JSON.stringify({ number: destination.identifier, mediatype: 'image', mimetype: 'image/jpeg', media: imageUrl, caption: publication.message, fileName: 'oferta.jpg' })
          : JSON.stringify({ number: destination.identifier, text: publication.message, linkPreview: true }),
      });

      const bodyText = await res.text();
      if (!res.ok) return { success: false, sentAt: timestamp, error: `Evolution API HTTP ${res.status}: ${bodyText.slice(0, 500)}`, provider: 'EVOLUTION_API' };

      let data: any = {};
      try { data = bodyText ? JSON.parse(bodyText) : {}; } catch { data = {}; }
      const messageId = data?.key?.id || data?.response?.key?.id || data?.message?.key?.id;
      if (!messageId) return { success: false, sentAt: timestamp, error: 'Evolution API não confirmou o ID da mensagem.', provider: 'EVOLUTION_API' };

      return { success: true, messageId: String(messageId), sentAt: timestamp, provider: 'EVOLUTION_API' };
    } catch (err) {
      return { success: false, sentAt: timestamp, error: err instanceof Error && err.name === 'AbortError' ? 'Timeout no provedor Evolution.' : 'Falha na comunicação com o provedor Evolution.', provider: 'EVOLUTION_API' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
