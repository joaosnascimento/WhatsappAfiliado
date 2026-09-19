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

  /**
   * Dispatches formatted affiliate publication to WhatsApp destination
   */
  public async sendPublication(
    publication: Publication,
    destination: Destination
  ): Promise<WhatsAppSendResult> {
    const timestamp = new Date().toISOString();

    // Check if official WhatsApp Cloud API is configured
    if (this.apiToken && this.phoneNumberId) {
      try {
        const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
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
        return {
          success: true,
          messageId: data.messages?.[0]?.id || `wamid_${Date.now()}`,
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

    // Default compliant automation queue dispatcher (Simulated Gateway mode for preview & staging)
    return {
      success: true,
      messageId: `wamid_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sentAt: timestamp,
      provider: 'SIMULATOR',
    };
  }
}
