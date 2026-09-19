import type {
  MarketplaceAccount,
  AffiliateProduct,
  AffiliateLink,
  Offer,
  Campaign,
  Destination,
  Publication,
  Conversion,
  MarketplaceType,
} from '../types/affiliate.ts';

class MemoryStore {
  public accounts: Map<string, MarketplaceAccount> = new Map();
  public products: Map<string, AffiliateProduct> = new Map();
  public links: Map<string, AffiliateLink> = new Map();
  public offers: Map<string, Offer> = new Map();
  public campaigns: Map<string, Campaign> = new Map();
  public destinations: Map<string, Destination> = new Map();
  public publications: Map<string, Publication> = new Map();
  public conversions: Map<string, Conversion> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 1. Accounts
    const mlAccount: MarketplaceAccount = {
      id: 'acc_mercadolivre_br',
      workspace_id: 'ws_default',
      marketplace: 'MERCADOLIVRE',
      status: process.env.MERCADOLIVRE_CLIENT_ID && process.env.MERCADOLIVRE_CLIENT_SECRET ? 'AWAITING_CONFIG' : 'AWAITING_CONFIG',
      status_message: 'Credenciais do DevCenter configuradas; conclua o OAuth para conectar a conta.',
      credentials_encrypted: {
        ml_client_id: process.env.MERCADOLIVRE_CLIENT_ID || '',
        ml_client_secret: process.env.MERCADOLIVRE_CLIENT_SECRET || '',
        ml_redirect_uri: process.env.MERCADOLIVRE_REDIRECT_URI || `${process.env.APP_URL || 'https://localhost:3000'}/api/auth/mercadolivre/callback`,
        // Tokens OAuth are intentionally never seeded or hard-coded.
      },
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const shopeeAccount: MarketplaceAccount = {
      id: 'acc_shopee_br',
      workspace_id: 'ws_default',
      marketplace: 'SHOPEE',
      status: process.env.SHOPEE_AFFILIATE_APP_ID && process.env.SHOPEE_AFFILIATE_SECRET ? 'AWAITING_CONFIG' : 'AWAITING_CONFIG',
      status_message: 'Credenciais presentes; execute o teste de integração para validar a conta na Affiliate Open API.',
      credentials_encrypted: {
        shopee_app_id: process.env.SHOPEE_AFFILIATE_APP_ID || '',
        shopee_secret: process.env.SHOPEE_AFFILIATE_SECRET || '',
      },
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.accounts.set(mlAccount.id, mlAccount);
    this.accounts.set(shopeeAccount.id, shopeeAccount);

    // 2. Destinations
    const destPokemon: Destination = {
      id: 'dest_pokemon',
      workspace_id: 'ws_default',
      type: 'WHATSAPP_GROUP',
      identifier: '120363198822001122@g.us',
      name: 'Ofertas Pokémon & TCG Brasil',
      description: 'Grupo VIP focado em boosters, cartas TCG e colecionáveis Pokémon',
      categories: ['Brinquedos e Hobbies', 'Colecionáveis', 'Games'],
      marketplaces: ['SHOPEE', 'MERCADOLIVRE'],
      keywords: ['Pokémon', 'TCG', 'booster', 'cards', 'blister', 'charizard', 'copag'],
      frequency_minutes: 60,
      time_start: '08:00',
      time_end: '22:00',
      priority: 'HIGH',
      is_active: true,
    };

    const destTech: Destination = {
      id: 'dest_tech',
      workspace_id: 'ws_default',
      type: 'WHATSAPP_CHANNEL',
      identifier: '120363299933002233@newsletter',
      name: 'Achados Tech & Games Brasil',
      description: 'Canal de WhatsApp com promoções de eletrônicos, monitores e periféricos',
      categories: ['Informática', 'Eletrônicos', 'Games'],
      marketplaces: ['MERCADOLIVRE', 'SHOPEE'],
      keywords: ['SSD', 'Monitor', 'Teclado', 'Headset', 'Mouse', 'Ryzen', 'GeForce'],
      frequency_minutes: 45,
      time_start: '07:30',
      time_end: '23:00',
      priority: 'NORMAL',
      is_active: true,
    };

    this.destinations.set(destPokemon.id, destPokemon);
    this.destinations.set(destTech.id, destTech);

    // 3. Campaigns
    const campGamer: Campaign = {
      id: 'camp_gamer_2026',
      workspace_id: 'ws_default',
      name: 'Campanha Tech & TCG 2026',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };
    this.campaigns.set(campGamer.id, campGamer);

    // 4. Products & Offers
    // Product 1: Shopee Pokemon (Ready to publish with official shortLink & subIds)
    const prodShopee1: AffiliateProduct = {
      id: 'shopee_109283_9823411',
      marketplace: 'SHOPEE',
      external_product_id: '9823411',
      shop_id: '109283',
      title: 'Box Booster Pokémon TCG Escarlate e Violeta 36 Pacotes Copag Oficial',
      image: 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=600&auto=format&fit=crop&q=80',
      original_url: 'https://shopee.com.br/product/109283/9823411',
      price: 249.9,
      original_price: 320.0,
      discount: 22,
      commission: 24.99,
      commission_rate: 10,
      rating: 4.9,
      sales: 1420,
      category: 'Brinquedos e Hobbies',
    };
    this.products.set(prodShopee1.id, prodShopee1);

    const linkShopee1: AffiliateLink = {
      id: 'link_shopee_001',
      marketplace: 'SHOPEE',
      affiliate_account_id: 'acc_shopee_br',
      product_id: prodShopee1.id,
      original_url: prodShopee1.original_url,
      affiliate_url: 'https://s.shopee.com.br/7Uf9vXkL1m',
      short_url: 'https://s.shopee.com.br/7Uf9vXkL1m',
      tracking_data: {
        sub_ids: ['whatsapp', 'dest_pokemon', 'camp_gamer_2026', 'cards'],
        campaign: 'camp_gamer_2026',
        destination: 'dest_pokemon',
        source: 'shopee_affiliate_open_api',
      },
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    };
    this.links.set(linkShopee1.id, linkShopee1);

    const offerShopee1: Offer = {
      id: 'offer_shopee_001',
      product_id: prodShopee1.id,
      product: prodShopee1,
      marketplace: 'SHOPEE',
      price: prodShopee1.price,
      original_price: prodShopee1.original_price,
      discount: prodShopee1.discount,
      commission: prodShopee1.commission,
      score: 95,
      status: 'AFFILIATE_LINK_READY',
      affiliate_link_id: linkShopee1.id,
      affiliate_url: linkShopee1.affiliate_url,
      first_seen_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      last_seen_at: new Date().toISOString(),
      ai_generated_message: `🔥 *OFERTA IMPERDÍVEL NA SHOPEE!* 🟠\n\n📦 *Box Booster Pokémon TCG Escarlate e Violeta 36 Pacotes Copag Oficial*\n\n❌ De: ~R$ 320,00~\n✅ *Por apenas: R$ 249,90*\n📉 *Desconto de 22%*\n\n🛒 *Compre com garantia oficial:* https://s.shopee.com.br/7Uf9vXkL1m\n\n⚡ _Preço sujeito a alteração._`,
    };
    this.offers.set(offerShopee1.id, offerShopee1);

    // Product 2: Mercado Livre SSD NVMe (AFFILIATE_LINK_READY with validated meli.la shortlink)
    const prodML1: AffiliateProduct = {
      id: 'ml_MLB_3419082341',
      marketplace: 'MERCADOLIVRE',
      external_product_id: 'MLB3419082341',
      shop_id: '4928172',
      title: 'SSD Kingston NV2 1TB M.2 2280 NVMe PCIe 4.0 Leitura 3500MB/s',
      image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80',
      original_url: 'https://www.mercadolivre.com.br/ssd-kingston-nv2-1tb-m2-2280-nvme-pcie-40-leitura-3500mbs/p/MLB3419082341',
      price: 369.0,
      original_price: 499.0,
      discount: 26,
      commission: 29.52,
      commission_rate: 8,
      rating: 4.8,
      category: 'Informática',
      metadata: {
        site_id: 'MLB',
        shipping: { free_shipping: true },
        official_store: 'Kingston Oficial',
      },
    };
    this.products.set(prodML1.id, prodML1);

    const linkML1: AffiliateLink = {
      id: 'link_ml_001',
      marketplace: 'MERCADOLIVRE',
      affiliate_account_id: 'acc_mercadolivre_br',
      product_id: prodML1.id,
      original_url: prodML1.original_url,
      affiliate_url: 'https://meli.la/2Kx9QmP',
      short_url: 'https://meli.la/2Kx9QmP',
      tracking_data: {
        campaign: 'camp_gamer_2026',
        destination: 'dest_tech',
        source: 'mercadolivre_affiliate_portal',
      },
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    };
    this.links.set(linkML1.id, linkML1);

    const offerML1: Offer = {
      id: 'offer_ml_001',
      product_id: prodML1.id,
      product: prodML1,
      marketplace: 'MERCADOLIVRE',
      price: prodML1.price,
      original_price: prodML1.original_price,
      discount: prodML1.discount,
      commission: prodML1.commission,
      score: 92,
      status: 'AFFILIATE_LINK_READY',
      affiliate_link_id: linkML1.id,
      affiliate_url: linkML1.affiliate_url,
      first_seen_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      last_seen_at: new Date().toISOString(),
      ai_generated_message: `🔥 *SUPER OFERTA NO MERCADO LIVRE!* 🟡\n\n📦 *SSD Kingston NV2 1TB M.2 2280 NVMe PCIe 4.0 Leitura 3500MB/s*\n\n❌ De: ~R$ 499,00~\n✅ *Por apenas: R$ 369,00*\n📉 *26% de desconto!*\n🚚 *Frete Grátis na Loja Oficial*\n\n🛒 *Link oficial verificado:* https://meli.la/2Kx9QmP`,
    };
    this.offers.set(offerML1.id, offerML1);

    // Product 3: Mercado Livre Headset (STATUS: VALIDATED - Requires official affiliate link association before publishing - Rule 4!)
    const prodML2: AffiliateProduct = {
      id: 'ml_MLB_3892019921',
      marketplace: 'MERCADOLIVRE',
      external_product_id: 'MLB3892019921',
      shop_id: '817263',
      title: 'Headset Gamer Sem Fio Logitech G435 Lightspeed e Bluetooth Ultraleve',
      image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
      original_url: 'https://www.mercadolivre.com.br/headset-gamer-sem-fio-logitech-g435/p/MLB3892019921',
      price: 399.9,
      original_price: 529.0,
      discount: 24,
      commission: 31.99,
      rating: 4.7,
      category: 'Informática',
      metadata: {
        site_id: 'MLB',
        shipping: { free_shipping: true },
        official_store: 'Logitech Store',
      },
    };
    this.products.set(prodML2.id, prodML2);

    const offerML2: Offer = {
      id: 'offer_ml_002',
      product_id: prodML2.id,
      product: prodML2,
      marketplace: 'MERCADOLIVRE',
      price: prodML2.price,
      original_price: prodML2.original_price,
      discount: prodML2.discount,
      commission: prodML2.commission,
      score: 88,
      status: 'VALIDATED', // Awaiting official meli.la affiliate link association
      status_reason: 'Produto validado. Conforme Regra de Segurança, associe o link oficial do Programa de Afiliados Mercado Livre antes de publicar.',
      first_seen_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      last_seen_at: new Date().toISOString(),
    };
    this.offers.set(offerML2.id, offerML2);

    // 5. Conversions
    const convShopee1: Conversion = {
      id: 'conv_shopee_001',
      marketplace: 'SHOPEE',
      affiliate_account_id: 'acc_shopee_br',
      external_id: '260319877112001',
      offer_id: offerShopee1.id,
      campaign_id: 'camp_gamer_2026',
      destination_id: 'dest_pokemon',
      sub_id: 'dest_pokemon',
      commission: 24.99,
      order_amount: 249.9,
      status: 'APPROVED',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    };
    this.conversions.set(convShopee1.id, convShopee1);

    const convML1: Conversion = {
      id: 'conv_ml_001',
      marketplace: 'MERCADOLIVRE',
      affiliate_account_id: 'acc_mercadolivre_br',
      external_id: 'ML-ORD-2026-99120',
      offer_id: offerML1.id,
      campaign_id: 'camp_gamer_2026',
      destination_id: 'dest_tech',
      commission: 29.52,
      order_amount: 369.0,
      status: 'APPROVED',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    };
    this.conversions.set(convML1.id, convML1);
  }
}

export const store = new MemoryStore();
