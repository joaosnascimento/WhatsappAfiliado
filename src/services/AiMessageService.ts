import { GoogleGenAI } from '@google/genai';
import type { AffiliateProduct, MarketplaceType } from '../types/affiliate.ts';

export interface AiMessageInput {
  product: AffiliateProduct;
  marketplace: MarketplaceType;
  affiliateUrl: string;
  destinationName?: string;
  category?: string;
  couponCode?: string;
  tone?: 'URGENT' | 'ENTHUSIASTIC' | 'CONCISE';
}

export class AiMessageService {
  private static aiClient: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI | null {
    if (!this.aiClient && process.env.GEMINI_API_KEY) {
      this.aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.aiClient;
  }

  /**
   * Generates a high-converting WhatsApp message strictly constrained to verified facts.
   * Mandate: The model CANNOT hallucinate price, discount, coupons, or availability.
   */
  public static async generateMessage(input: AiMessageInput): Promise<string> {
    const { product, marketplace, affiliateUrl, couponCode, destinationName } = input;

    const mpLabel = marketplace === 'SHOPEE' ? 'Shopee' : 'Mercado Livre';
    const priceFormatted = `R$ ${product.price.toFixed(2).replace('.', ',')}`;
    const originalPriceFormatted = product.original_price
      ? `R$ ${product.original_price.toFixed(2).replace('.', ',')}`
      : null;
    const discountFormatted = product.discount ? `${product.discount}% OFF` : null;

    const verifiedFacts = {
      titulo_produto: product.title,
      preco_atual: priceFormatted,
      preco_original: originalPriceFormatted || 'Não informado (NÃO inventar)',
      desconto: discountFormatted || 'Não informado (NÃO inventar)',
      cupom_validado: couponCode ? couponCode : 'Nenhum cupom disponível (NÃO inventar)',
      marketplace: mpLabel,
      link_afiliado: affiliateUrl,
      destino: destinationName || 'Grupo de Ofertas WhatsApp',
    };

    const client = this.getClient();

    if (client) {
      try {
        const systemInstruction = `
Você é um redator profissional especializado em divulgação de ofertas para grupos e canais de WhatsApp.
SUAS REGRAS INVIOLÁVEIS:
1. Use SOMENTE os dados confirmados fornecidos no JSON.
2. NUNCA invente: preço anterior, percentual de desconto que não existe, frete grátis se não informado, cupons falsos, notas de avaliação ou estoque fictício.
3. Formate com formatação nativa do WhatsApp: use *negrito* para o título e preço, ~tachado~ se houver preço original real, e emojis atraentes e moderados.
4. O link de afiliado oficial fornecido DEVE ser incluído no final com chamada clara para compra.
5. Seja direto, persuasivo e sem enrolação.
`;

        const userPrompt = `
Gere uma mensagem para o WhatsApp com os seguintes dados FACTUAIS E CONFIRMADOS:
${JSON.stringify(verifiedFacts, null, 2)}
`;

        const response = await client.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.4, // Low temperature to prevent hallucinations
          },
        });

        const generated = response.text?.trim();
        if (generated && generated.length > 20 && generated.length <= 2000) {
          // Treat the model as untrusted input: it may format facts, but cannot replace verified data.
          const required = [product.title, priceFormatted, affiliateUrl];
          const couponIsRequired = Boolean(couponCode);
          if (!required.every(fact => generated.includes(fact)) || (couponIsRequired && !generated.includes(couponCode!))) {
            return this.buildDeterministicMessage(input);
          }
          return generated;
        }
      } catch (err) {
        console.warn('Gemini API call failed, using deterministic template:', (err as Error).message);
      }
    }

    // High quality deterministic fallback strictly adhering to confirmed facts
    return this.buildDeterministicMessage(input);
  }

  /**
   * Deterministic template builder that guarantees zero hallucinations
   */
  public static buildDeterministicMessage(input: AiMessageInput): string {
    const { product, marketplace, affiliateUrl, couponCode } = input;
    const mpEmoji = marketplace === 'SHOPEE' ? '🟠' : '🟡';
    const mpName = marketplace === 'SHOPEE' ? 'Shopee' : 'Mercado Livre';

    const lines: string[] = [];
    lines.push(`🔥 *ACHADO NO ${mpName.toUpperCase()}!* ${mpEmoji}`);
    lines.push('');
    lines.push(`📦 *${product.title}*`);
    lines.push('');

    if (product.original_price && product.original_price > product.price) {
      lines.push(
        `❌ De: ~R$ ${product.original_price.toFixed(2).replace('.', ',')}~`
      );
    }

    lines.push(`✅ *Por apenas: R$ ${product.price.toFixed(2).replace('.', ',')}*`);

    if (product.discount) {
      lines.push(`📉 *Desconto de ${product.discount}%*`);
    }

    if (couponCode) {
      lines.push(`🎟️ Use o cupom: *${couponCode}*`);
    }

    lines.push('');
    lines.push(`🛒 *Acesse a oferta oficial:*`);
    lines.push(`${affiliateUrl}`);
    lines.push('');
    lines.push(`⚠️ _Preço e estoque sujeitos a alteração a qualquer momento._`);

    return lines.join('\n');
  }
}
