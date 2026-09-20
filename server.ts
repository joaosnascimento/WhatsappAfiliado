import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
dotenv.config();

import { store, runWithWorkspace, findMarketplaceAccount } from './src/services/Store.ts';
import { runMigrations } from './src/infrastructure/migrations.ts';
import { ensureWorkspace } from './src/infrastructure/workspace.ts';
import { closeDatabase, query } from './src/infrastructure/database.ts';
import { redis } from './src/infrastructure/redis.ts';
import { registerUser, authenticateUser, createSession, revokeSession } from './src/services/auth.ts';
import { requireAuth } from './src/services/authMiddleware.ts';
import { redisRateLimit } from './src/services/rateLimit.ts';
import { ShopeeAffiliateAdapter } from './integrations/shopee/ShopeeAffiliateAdapter.ts';
import { MercadoLivreAffiliateAdapter } from './integrations/mercadolivre/MercadoLivreAffiliateAdapter.ts';
import { MercadoLivreAffiliateService } from './integrations/mercadolivre/MercadoLivreAffiliateService.ts';
import { MercadoLivreOfficialSessionProvider } from './integrations/mercadolivre/MercadoLivreOfficialSessionProvider.ts';
import { AiMessageService } from './src/services/AiMessageService.ts';
import { WhatsAppProvider } from './src/services/WhatsAppProvider.ts';
import { DeduplicationService } from './src/services/DeduplicationService.ts';
import { AuditService } from './src/services/AuditService.ts';
import { AnalyticsService } from './src/services/AnalyticsService.ts';
import { WhatsAppGroupService } from './src/services/WhatsAppGroupService.ts';
import { CouponService } from './src/services/CouponService.ts';
import { WhatsAppSettingsService } from './src/services/WhatsAppSettingsService.ts';
import { requestSecurityMiddleware, securityHeaders, recordSecurityEvent } from './src/security/security.ts';
import { assertSafeOutboundUrl } from './src/security/outboundUrl.ts';
import { runTests } from './src/test/integrations.test.ts';
import type { Offer, Publication, Destination } from './src/types/affiliate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const persistentStoreEnabled = Boolean(process.env.DATABASE_URL) && process.env.ALLOW_INMEMORY_STORE !== 'true';

  if (process.env.NODE_ENV === 'production' && !persistentStoreEnabled) {
    throw new Error('Production startup blocked: DATABASE_URL and persistent storage are required.');
  }
  if (process.env.NODE_ENV === 'production' && !redis) {
    throw new Error('Production startup blocked: REDIS_URL is required for rate limiting, OAuth state and job infrastructure.');
  }
  if (persistentStoreEnabled) {
    if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is required when persistent storage is enabled.');
    await runMigrations();
    // Individual authenticated workspaces are loaded lazily by the request context.
    await ensureWorkspace('ws_default');
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use(requestSecurityMiddleware);

  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  app.use((req,res,next) => {
    const origin = req.get('origin');
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigins.includes(origin) ? 204 : 403);
    next();
  });
  app.use((req,res,next) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '32kb' }));
  app.use('/api', redisRateLimit({ windowSeconds: 60, max: Number(process.env.API_RATE_LIMIT_MAX || 120), prefix: 'api' }));
  const PORT = Number(process.env.PORT || 3000);

  app.post('/api/auth/register', redisRateLimit({ windowSeconds: 900, max: 5, prefix: 'register' }), async (req, res) => {
    if (!persistentStoreEnabled) return res.status(503).json({ error: 'Persistent storage is required for authentication.' });
    try { const user = await registerUser(String(req.body.email || ''), String(req.body.password || '')); res.status(201).json({ success:true, user }); }
    catch (error) { void recordSecurityEvent({eventType:'REGISTER_FAILURE',severity:'MEDIUM',ip:req.ip,userAgent:req.get('user-agent')||undefined,path:req.path}); res.status(400).json({ error:'Não foi possível criar a conta.' }); }
  });

  app.post('/api/auth/login', redisRateLimit({ windowSeconds: 900, max: 10, prefix: 'login' }), async (req, res) => {
    if (!persistentStoreEnabled) return res.status(503).json({ error: 'Persistent storage is required for authentication.' });
    const user = await authenticateUser(String(req.body.email || ''), String(req.body.password || ''));
    if (!user) { void recordSecurityEvent({eventType:'LOGIN_FAILURE',severity:'MEDIUM',ip:req.ip,userAgent:req.get('user-agent')||undefined,path:req.path}); return res.status(401).json({ error:'Credenciais inválidas.' }); }
    res.json({ success:true, token:createSession(user), user });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user:req.user }));
  app.post('/api/auth/logout', requireAuth, async (req,res) => {
    const header = req.get('authorization');
    const value = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (value) await revokeSession(value);
    res.status(204).send();
  });


  if (persistentStoreEnabled) {
    app.use((req, res, next) => {
      res.on('finish', () => {
        const workspaceId = req.user?.workspaceId;
        if (!workspaceId) return;
        void runWithWorkspace(workspaceId, () => store.persist(workspaceId)).catch((error) => console.error('Persistence error:', error));
      });
      next();
    });
  }

  // Every authenticated workspace must execute inside its own AsyncLocalStorage context.
  // Without this middleware, the legacy `store` proxy falls back to ws_default and
  // authenticated users can see/save against the wrong workspace (or see "Conta não encontrada").
  const workspaceContext = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) return res.status(401).json({ error: 'Autenticação obrigatória.' });
    void runWithWorkspace(workspaceId, next).catch(next);
  };

  app.use('/api/accounts', requireAuth, workspaceContext);
  app.use('/api/offers', requireAuth, workspaceContext);
  app.use('/api/destinations', requireAuth, workspaceContext);
  app.use('/api/publications', requireAuth, workspaceContext);
  app.use('/api/reports', requireAuth, workspaceContext);
  app.use('/api/audit', requireAuth, workspaceContext);
  app.use('/api/analytics', requireAuth, workspaceContext);
  app.use('/api/coupons', requireAuth, workspaceContext);
  app.use('/api/whatsapp', requireAuth, workspaceContext);

  // 1. Health check
  // Mercado Livre webhook receiver. It records the official event without inventing a sale/conversion.
  app.post('/webhooks/mercadolivre', redisRateLimit({windowSeconds:60,max:30,prefix:'ml-webhook'}), async (req, res) => {
    try {
      const userId = String(req.body?.user_id || req.body?.userId || '');
      const applicationId = String(req.body?.application_id || '');
      const eventId = String(req.body?._id || req.body?.id || '');
      if (!userId || userId.length > 128 || !applicationId || applicationId.length > 128 || !eventId || eventId.length > 128) return res.status(400).json({error:'Webhook inválido.'});
      const rows = await query<any>('SELECT id,workspace_id FROM marketplace_accounts WHERE marketplace=\'MERCADOLIVRE\' AND provider_account_id=$1 AND provider_application_id=$2 LIMIT 1',[userId,applicationId]);
      const match = rows[0];
      if (!match) { void recordSecurityEvent({eventType:'WEBHOOK_UNMATCHED',severity:'MEDIUM',ip:req.ip,userAgent:req.get('user-agent')||undefined,path:req.path,metadata:{applicationId}}); return res.status(200).json({received:true, matched:false}); }
      const inserted=await query<any>(`INSERT INTO processed_webhooks(workspace_id,event_id,marketplace) VALUES($1,$2,'MERCADOLIVRE') ON CONFLICT DO NOTHING RETURNING event_id`,[match.workspace_id,eventId]);
      if (!inserted.length) return res.status(200).json({received:true,duplicate:true});
      await AnalyticsService.trackWebhook(match.workspace_id,'MERCADOLIVRE',{event_id:eventId,topic:req.body?.topic||null,resource:req.body?.resource||null,user_id:userId,application_id:applicationId,received_at:new Date().toISOString()});
      res.status(200).json({received:true,matched:true});
    } catch (err) { res.status(500).json({error:(err as Error).message}); }
  });

  app.get('/api/security/events', requireAuth, workspaceContext, redisRateLimit({windowSeconds:60,max:30,prefix:'security-events'}), async (req,res) => {
    try {
      const rows = await query<any>(
        'SELECT id,event_type,severity,ip_address,user_agent,path,metadata,created_at FROM security_events WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100',
        [req.user?.workspaceId]
      );
      res.json(rows);
    } catch (err) {
      res.status(500).json({error:'Não foi possível consultar os eventos de segurança.'});
    }
  });

  app.get('/api/health', async (req, res) => {
    res.json({
      status: 'ok',
      service: 'Automacao Afiliados WhatsApp SaaS',
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      mercadolivreConfigured: true,
      shopeeConfigured: !!process.env.SHOPEE_AFFILIATE_APP_ID,
      whatsappProvider: process.env.WHATSAPP_PROVIDER || 'cloud',
      evolutionConfigured: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE),
      automation: { scheduler: true, discovery: true },
      persistentStoreEnabled,
      databaseConfigured: !!process.env.DATABASE_URL,
      redisConfigured: !!process.env.REDIS_URL,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Integration Unit Tests Runner
  app.get('/api/tests/run', requireAuth, workspaceContext, async (req, res) => {
    try {
      const results = runTests();
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. Accounts management
  app.get('/api/accounts', (req, res) => {
    const list = Array.from(store.accounts.values()).map((acc) => ({
      id: acc.id,
      workspace_id: acc.workspace_id,
      marketplace: acc.marketplace,
      status: acc.status,
      status_message: acc.status_message,
      created_at: acc.created_at,
      updated_at: acc.updated_at,
      credentials_configured: Object.keys(acc.credentials_encrypted || {}).filter(k => Boolean((acc.credentials_encrypted as any)[k])).length > 0,
    }));
    res.json(list);
  });

  app.post('/api/accounts/:id', (req, res) => {
    const account = store.accounts.get(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const { credentials } = req.body || {};
    if (credentials && typeof credentials === 'object' && !Array.isArray(credentials)) {
      const allowed = account.marketplace === 'SHOPEE' ? ['shopee_app_id','shopee_secret'] : [];
      for (const key of Object.keys(credentials)) {
        if (!allowed.includes(key)) return res.status(400).json({error:'Campo de credencial não permitido.'});
        if (typeof credentials[key] !== 'string' || credentials[key].length > 512) return res.status(400).json({error:'Credencial inválida.'});
      }
      for (const key of allowed) if (key in credentials) (account.credentials_encrypted as any)[key] = credentials[key];
      const configured = account.marketplace === 'SHOPEE' ? Boolean(account.credentials_encrypted.shopee_app_id && account.credentials_encrypted.shopee_secret) : true;
      account.status = configured ? 'AWAITING_CONFIG' : 'AWAITING_CONFIG';
      account.status_message = configured ? 'Credenciais configuradas; conclua o fluxo de autenticação.' : 'Aguardando credenciais obrigatórias.';
      account.updated_at = new Date().toISOString();
    }
    const safeAccount = { id:account.id, workspace_id:account.workspace_id, marketplace:account.marketplace, status:account.status, status_message:account.status_message, created_at:account.created_at, updated_at:account.updated_at };
    res.json({ success: true, account: safeAccount });
  });

  // 4. Test Integration Diagnostic (Mercado Livre & Shopee)
  app.post('/api/test-integration/:marketplace', requireAuth, redisRateLimit({windowSeconds:60,max:5,prefix:'integration-test'}), async (req, res) => {
    const marketplace = req.params.marketplace.toUpperCase();

    if (marketplace === 'SHOPEE') {
      const account = findMarketplaceAccount('SHOPEE');
      const appId = account?.credentials_encrypted.shopee_app_id || process.env.SHOPEE_AFFILIATE_APP_ID || '';
      const secret = account?.credentials_encrypted.shopee_secret || process.env.SHOPEE_AFFILIATE_SECRET || '';

      const adapter = new ShopeeAffiliateAdapter(appId, secret);
      const testResult = await adapter.testConnection();
      return res.json(testResult);
    } else if (marketplace === 'MERCADOLIVRE') {
      const account = findMarketplaceAccount('MERCADOLIVRE');
      const adapter = new MercadoLivreAffiliateAdapter({ accountId: account?.id });
      const testResult = await adapter.testConnection();
      return res.json(testResult);
    } else {
      return res.status(400).json({ error: 'Marketplace inválido' });
    }
  });

  // Mercado Livre official browser automation
  app.get('/api/mercadolivre/status', requireAuth, workspaceContext, (req, res) => {
    const account = findMarketplaceAccount('MERCADOLIVRE');
    if (!account) return res.json({ connected: false, status: 'DISCONNECTED' });
    void MercadoLivreOfficialSessionProvider.status(account)
      .then(result => res.json(result))
      .catch(error => res.status(500).json({ error: (error as Error).message }));
  });

  app.post('/api/mercadolivre/connect', requireAuth, workspaceContext, async (req, res) => {
    const account = findMarketplaceAccount('MERCADOLIVRE');
    if (!account) return res.status(400).json({ error: 'Conta Mercado Livre indisponível neste workspace.' });
    try {
      const result = await MercadoLivreOfficialSessionProvider.connect(account);
      res.json(result);
    } catch (error) {
      account.credentials_encrypted.ml_session_status = 'ERROR';
      account.status = 'AUTH_ERROR';
      account.status_message = (error as Error).message;
      account.updated_at = new Date().toISOString();
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/mercadolivre/disconnect', requireAuth, workspaceContext, async (req, res) => {
    const account = findMarketplaceAccount('MERCADOLIVRE');
    if (!account) return res.status(400).json({ error: 'Conta Mercado Livre indisponível neste workspace.' });
    try {
      await MercadoLivreOfficialSessionProvider.disconnect(account);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/mercadolivre/generate-link', requireAuth, workspaceContext, async (req, res) => {
    const account = findMarketplaceAccount('MERCADOLIVRE');
    if (!account) return res.status(400).json({ error: 'Conta Mercado Livre indisponível neste workspace.' });
    const originalUrl = String(req.body?.originalUrl || '').trim();
    if (!originalUrl) return res.status(400).json({ error: 'originalUrl é obrigatória.' });
    try {
      const affiliateUrl = await MercadoLivreOfficialSessionProvider.generateLink(account, originalUrl, ['whatsapp', 'auto']);
      res.json({ success: true, affiliateUrl });
    } catch (error) {
      res.status(409).json({ error: (error as Error).message });
    }
  });

  // 6. Offers API
  app.get('/api/offers', (req, res) => {
    const marketplace = req.query.marketplace as string;
    const status = req.query.status as string;

    let offers = Array.from(store.offers.values());

    if (marketplace && marketplace !== 'ALL') {
      offers = offers.filter((o) => o.marketplace === marketplace);
    }
    if (status && status !== 'ALL') {
      offers = offers.filter((o) => o.status === status);
    }

    res.json(offers);
  });

  // Live Offer Search
  app.post('/api/offers/search-live', redisRateLimit({windowSeconds:60,max:10,prefix:'live-search'}), async (req, res) => {
    const { marketplace, keyword, category, minDiscount } = req.body;
    if (!['SHOPEE','MERCADOLIVRE'].includes(String(marketplace))) return res.status(400).json({error:'Marketplace inválido.'});
    if (keyword !== undefined && (typeof keyword !== 'string' || keyword.length > 120)) return res.status(400).json({error:'keyword inválida.'});
    if (category !== undefined && (typeof category !== 'string' || category.length > 120)) return res.status(400).json({error:'category inválida.'});
    if (minDiscount !== undefined && (!Number.isFinite(Number(minDiscount)) || Number(minDiscount) < 0 || Number(minDiscount) > 100)) return res.status(400).json({error:'minDiscount inválido.'});

    try {
      if (marketplace === 'SHOPEE') {
        const account = findMarketplaceAccount('SHOPEE');
        const appId = account?.credentials_encrypted.shopee_app_id || process.env.SHOPEE_AFFILIATE_APP_ID || '';
        const secret = account?.credentials_encrypted.shopee_secret || process.env.SHOPEE_AFFILIATE_SECRET || '';

        const adapter = new ShopeeAffiliateAdapter(appId, secret);
        const products = await adapter.searchOffers({
          keyword: keyword || 'ofertas',
          category,
          minDiscount: minDiscount ? Number(minDiscount) : undefined,
          limit: 10,
        });

        // Ingest into pipeline as DISCOVERED or AFFILIATE_LINK_READY
        const createdOffers: Offer[] = [];
        for (const p of products) {
          store.products.set(p.id, p);

          // Try to generate short link with subIds if credentials active
          let affiliateLink: string | undefined;
          let linkId: string | undefined;
          let status: Offer['status'] = 'DISCOVERED';

          try {
            const link = await adapter.createAffiliateLink({
              originalUrl: p.original_url,
              productId: p.external_product_id,
              subIds: ['whatsapp', 'auto_search'],
            });
            store.links.set(link.id, link);
            affiliateLink = link.affiliate_url;
            linkId = link.id;
            status = 'AFFILIATE_LINK_READY';
          } catch {
            status = 'VALIDATED';
          }

          const offer: Offer = {
            id: `offer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            product_id: p.id,
            product: p,
            marketplace: 'SHOPEE',
            price: p.price,
            original_price: p.original_price,
            discount: p.discount,
            commission: p.commission,
            score: Math.min(100, Math.round((p.discount || 10) * 1.5 + (p.rating || 4.5) * 8)),
            status,
            affiliate_link_id: linkId,
            affiliate_url: affiliateLink,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          };

          store.offers.set(offer.id, offer);
          createdOffers.push(offer);
        }

        return res.json({ count: createdOffers.length, offers: createdOffers });
      } else {
        const account = findMarketplaceAccount('MERCADOLIVRE');
        if (!account) return res.status(400).json({ error: 'Conta Mercado Livre indisponível neste workspace.' });
        const products = await MercadoLivreOfficialSessionProvider.discover(account, String(keyword || 'ofertas'), 10);
        const createdOffers: Offer[] = [];

        for (const p of products) {
          store.products.set(p.id, p);
          let affiliateUrl: string | undefined;
          let linkId: string | undefined;
          try {
            affiliateUrl = await MercadoLivreOfficialSessionProvider.generateLink(account, p.original_url, ['whatsapp', 'auto_search']);
            const link = {
              id: `link_ml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              marketplace: 'MERCADOLIVRE' as const,
              affiliate_account_id: account.id,
              product_id: p.id,
              original_url: p.original_url,
              affiliate_url: affiliateUrl,
              short_url: affiliateUrl,
              tracking_data: { sub_ids: ['whatsapp', 'auto_search'], source: 'mercadolivre_official_browser' },
              created_at: new Date().toISOString(),
            };
            store.links.set(link.id, link);
            linkId = link.id;
            p.affiliate_url = affiliateUrl;
          } catch (error) {
            p.metadata = { ...(p.metadata || {}), affiliate_error: (error as Error).message };
          }

          const offer: Offer = {
            id: `offer_ml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            product_id: p.id,
            product: p,
            marketplace: 'MERCADOLIVRE',
            price: p.price,
            original_price: p.original_price,
            discount: p.discount,
            commission: p.commission,
            score: Math.min(100, Math.round((p.discount || 0) * 1.5)),
            status: affiliateUrl ? 'AFFILIATE_LINK_READY' : 'VALIDATED',
            status_reason: affiliateUrl ? 'Link afiliado gerado automaticamente pelo Portal de Afiliados.' : (typeof p.metadata?.affiliate_error === 'string' ? p.metadata.affiliate_error : 'Não foi possível gerar o link automaticamente; sessão ou portal indisponível.'),
            affiliate_link_id: linkId,
            affiliate_url: affiliateUrl,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          };
          store.offers.set(offer.id, offer);
          createdOffers.push(offer);
        }

        return res.json({ count: createdOffers.length, offers: createdOffers, automated: true });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 7. Mercado Livre: cadastro manual pelo link do anúncio
  app.post('/api/offers/manual-mercadolivre', async (req, res) => {
    const originalUrl = String(req.body?.originalUrl || '').trim();
    const title = String(req.body?.title || '').trim().slice(0, 200) || 'Oferta Mercado Livre';
    const price = Number(req.body?.price || 0);
    if (!/^https:\/\/(?:www\.)?mercadolivre\.com\.br\//i.test(originalUrl)) return res.status(400).json({ error: 'Use a URL de um anúncio do Mercado Livre Brasil.' });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Preço inválido.' });
    const productId = 'MLB_URL_' + Buffer.from(originalUrl).toString('base64url').slice(0, 40);
    const product: any = {
      id: 'ml_manual_' + Date.now(), marketplace: 'MERCADOLIVRE', external_product_id: productId,
      title, image: '', original_url: originalUrl, price, metadata: { source: 'manual_affiliate_flow' }
    };
    const offer: Offer = {
      id: 'offer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6), product_id: product.id,
      product, marketplace: 'MERCADOLIVRE', price, score: 0, status: 'VALIDATED',
      status_reason: 'Gerando automaticamente o link oficial do Mercado Livre.',
      first_seen_at: new Date().toISOString(), last_seen_at: new Date().toISOString()
    };
    store.products.set(product.id, product); store.offers.set(offer.id, offer);
    const account = findMarketplaceAccount('MERCADOLIVRE');
    if (account) {
      try {
        const affiliateUrl = await MercadoLivreOfficialSessionProvider.generateLink(account, originalUrl, ['whatsapp', 'auto_manual']);
        const link = MercadoLivreAffiliateService.associateAffiliateLink({
          productId: product.external_product_id, originalUrl, affiliateUrl,
          affiliateAccountId: account.id, subIds: ['whatsapp', 'auto_manual'],
        });
        store.links.set(link.id, link);
        offer.affiliate_link_id = link.id;
        offer.affiliate_url = link.affiliate_url;
        offer.status = 'AFFILIATE_LINK_READY';
        offer.status_reason = 'Link oficial gerado e validado automaticamente pelo Portal de Afiliados.';
      } catch (error) {
        offer.status_reason = `Produto cadastrado, mas a geração automática falhou: ${(error as Error).message}`;
      }
    } else {
      offer.status_reason = 'Produto cadastrado. Conecte o Mercado Livre para gerar o link oficial automaticamente.';
    }
    res.status(201).json(offer);
  });

  // Remove a wrongly captured offer and any publications created from it.
  app.delete('/api/offers/:id', async (req, res) => {
    const offer = store.offers.get(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Oferta não encontrada.' });
    const pubs = await query<any>('SELECT id FROM publications WHERE offer_id=$1 AND workspace_id=$2', [offer.id, req.user!.workspaceId]);
    for (const pub of pubs) {
      await query('DELETE FROM publications WHERE id=$1 AND workspace_id=$2', [pub.id, req.user!.workspaceId]);
      store.publications.delete(pub.id);
    }
    store.offers.delete(offer.id);
    store.products.delete(offer.product_id);
    if (offer.affiliate_link_id) store.links.delete(offer.affiliate_link_id);
    res.json({ success: true, deletedOfferId: offer.id, deletedPublications: pubs.length });
  });

  // 7. Rule 4: Associate Mercado Livre Affiliate Link
  app.post('/api/offers/:id/associate-ml-link', (req, res) => {
    const offer = store.offers.get(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Oferta não encontrada.' });
    }

    const { affiliateUrl, destinationId, campaignId } = req.body;
    const mlAccount = findMarketplaceAccount('MERCADOLIVRE');
    if (!mlAccount) return res.status(400).json({ error: 'Conta do Mercado Livre não configurada neste workspace.' });
    if (!affiliateUrl) {
      return res.status(400).json({ error: 'affiliateUrl é obrigatória.' });
    }
    if (!/^https:\/\/(?:meli\.la\/|www\.mercadolivre\.com\.br\/).*$/i.test(String(affiliateUrl).trim())) {
      return res.status(400).json({ error: 'Use um link de afiliado gerado pelo Mercado Livre (preferencialmente https://meli.la/...).' });
    }

    try {
      const link = MercadoLivreAffiliateService.associateAffiliateLink({
        productId: offer.product.external_product_id,
        originalUrl: offer.product.original_url,
        affiliateUrl,
        affiliateAccountId: mlAccount.id,
        campaign: campaignId,
        destination: destinationId,
        subIds: ['whatsapp', destinationId || 'grupo_ml'],
      });

      store.links.set(link.id, link);

      offer.affiliate_link_id = link.id;
      offer.affiliate_url = link.affiliate_url;
      offer.status = 'AFFILIATE_LINK_READY';
      offer.status_reason = 'Link oficial meli.la validado e associado com sucesso.';

      res.json({ success: true, offer, link });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });


  app.delete('/api/publications/:id', async (req, res) => {
    const rows = await query<any>('SELECT id FROM publications WHERE id=$1 AND workspace_id=$2', [req.params.id, req.user!.workspaceId]);
    if (!rows[0]) return res.status(404).json({ error: 'Publicação não encontrada.' });
    await query('DELETE FROM publications WHERE id=$1 AND workspace_id=$2', [req.params.id, req.user!.workspaceId]);
    store.publications.delete(req.params.id);
    res.json({ success: true, deletedPublicationId: req.params.id });
  });

  app.post('/api/publications/:id/retry', async (req, res) => {
    const rows = await query<any>('SELECT * FROM publications WHERE id=$1 AND workspace_id=$2', [req.params.id, req.user!.workspaceId]);
    if (!rows[0]) return res.status(404).json({ error: 'Publicação não encontrada.' });
    if (rows[0].status !== 'FAILED') return res.status(409).json({ error: 'Somente publicações com falha podem ser reenviadas.' });
    const { enqueuePublication } = await import('./src/infrastructure/queue.ts');
    await query("UPDATE publications SET status='QUEUED', error=NULL WHERE id=$1", [rows[0].id]);
    try {
      await enqueuePublication({ publicationId: rows[0].id, destinationId: rows[0].destination_id, offerId: rows[0].offer_id, scheduledAt: rows[0].scheduled_at });
    } catch (error) {
      await query("UPDATE publications SET status='FAILED', error=$2 WHERE id=$1", [rows[0].id, (error as Error).message]);
      return res.status(503).json({ error: 'Fila de publicação indisponível.' });
    }
    res.json({ success: true, status: 'QUEUED' });
  });

  // 8. Generate AI Message
  app.post('/api/offers/:id/generate-ai-message', async (req, res) => {
    const offer = store.offers.get(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Oferta não encontrada.' });
    }

    const affiliateUrl = offer.affiliate_url || offer.product.original_url;
    const destinationId = req.body.destinationId;
    const dest = destinationId ? store.destinations.get(destinationId) : undefined;

    try {
      const message = await AiMessageService.generateMessage({
        product: offer.product,
        marketplace: offer.marketplace,
        affiliateUrl,
        destinationName: dest?.name,
        category: offer.product.category,
        couponCode: offer.coupon_code,
      });

      offer.ai_generated_message = message;
      res.json({ message });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 9. Publish Offer to WhatsApp Destination
  app.post('/api/offers/:id/publish', redisRateLimit({ windowSeconds: 60, max: 20, prefix: 'publish' }), async (req, res) => {
    const offer = store.offers.get(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Oferta não encontrada.' });
    }

    // Mercado Livre: nunca peça associação manual no fluxo normal.
    // Se a oferta estiver pendente/FAILED ou sem link, gere e valide o link oficial
    // automaticamente antes do gate de publicação.
    if (offer.marketplace === 'MERCADOLIVRE' &&
        (offer.status !== 'AFFILIATE_LINK_READY' || !offer.affiliate_url || !offer.affiliate_link_id)) {
      const account = findMarketplaceAccount('MERCADOLIVRE');
      if (!account) return res.status(409).json({ error: 'Mercado Livre não conectado. Conecte a conta para gerar o link oficial automaticamente.' });
      try {
        const affiliateUrl = await MercadoLivreOfficialSessionProvider.generateLink(
          account,
          offer.product.original_url,
          ['whatsapp', 'auto_publish'],
        );
        const link = MercadoLivreAffiliateService.associateAffiliateLink({
          productId: offer.product.external_product_id,
          originalUrl: offer.product.original_url,
          affiliateUrl,
          affiliateAccountId: account.id,
          subIds: ['whatsapp', 'auto_publish'],
        });
        store.links.set(link.id, link);
        offer.affiliate_link_id = link.id;
        offer.affiliate_url = link.affiliate_url;
        offer.status = 'AFFILIATE_LINK_READY';
        offer.status_reason = 'Link oficial gerado e validado automaticamente pelo Portal de Afiliados.';
      } catch (error) {
        offer.status = 'VALIDATED';
        offer.status_reason = `Não foi possível gerar o link oficial automaticamente: ${(error as Error).message}`;
        return res.status(409).json({ error: offer.status_reason });
      }
    }

    // MANDATORY GATE: Section 17
    // A publicação só passa quando existe link de afiliado oficial validado.
    if (offer.status !== 'AFFILIATE_LINK_READY' && offer.status !== 'READY_TO_PUBLISH') {
      return res.status(400).json({
        error: `Bloqueio de Segurança: A oferta está no status '${offer.status}'. Apenas ofertas no status 'AFFILIATE_LINK_READY' com link rastreado e validado podem ser publicadas.`,
      });
    }

    const destinationId = String(req.body.destinationId || '');
    if (!destinationId) return res.status(400).json({ error: 'destinationId é obrigatório.' });
    const destination = store.destinations.get(destinationId);
    if (!destination) {
      return res.status(404).json({ error: 'Destino de WhatsApp não encontrado.' });
    }

    // Deduplication check: Section 22
    const dedup = await DeduplicationService.isDuplicate(
      req.user!.workspaceId,
      offer.marketplace,
      offer.product.external_product_id,
      destination.id,
      offer.product.shop_id,
      24
    );

    if (dedup.isDuplicate && !req.body.force) {
      return res.status(409).json({
        error: `Deduplicação ativada: Este produto já foi publicado no destino '${destination.name}' em ${dedup.lastPublishedAt}. Aguarde o intervalo de 24h ou marque 'force=true'.`,
      });
    }

    const tracked = await AnalyticsService.createTrackedLink({
      workspaceId:req.user!.workspaceId, marketplace:offer.marketplace, affiliateUrl:offer.affiliate_url!,
      affiliateLinkId:offer.affiliate_link_id, offerId:offer.id, destinationId:destination.id,
      subId:`whatsapp:${destination.id}:${offer.marketplace.toLowerCase()}`
    });
    const publicBase=(process.env.APP_URL || '').replace(/\/$/,'');
    const publicationAffiliateUrl=publicBase ? `${publicBase}/r/${tracked.id}` : offer.affiliate_url!;

    // Ensure AI message exists or generate it
    let message = offer.ai_generated_message;
    if (!message) {
      message = await AiMessageService.generateMessage({
        product: offer.product,
        marketplace: offer.marketplace,
        affiliateUrl: publicationAffiliateUrl,
        destinationName: destination.name,
      });
      offer.ai_generated_message = message;
    } else {
      message = message.replaceAll(offer.affiliate_url!, publicationAffiliateUrl);
    }

    const requestedSchedule = req.body.scheduledAt ? new Date(String(req.body.scheduledAt)) : new Date();
    if (Number.isNaN(requestedSchedule.getTime())) return res.status(400).json({ error: 'scheduledAt inválido.' });
    if (requestedSchedule.getTime() < Date.now() - 30000) return res.status(400).json({ error: 'scheduledAt não pode estar no passado.' });
    const scheduleBucket = Math.floor(requestedSchedule.getTime() / 86400000);
    const forceSuffix = req.body.force ? `:force:${Date.now()}` : '';
    const idempotencyKey = `${offer.marketplace}:${offer.product.external_product_id}:${destination.id}:${scheduleBucket}${forceSuffix}`;
    const publication: Publication = {
      id: `pub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      workspace_id: req.user!.workspaceId,
      idempotency_key: idempotencyKey,
      offer_id: offer.id,
      offer,
      destination_id: destination.id,
      destination,
      affiliate_link_id: offer.affiliate_link_id || 'link_direct',
      affiliate_url: publicationAffiliateUrl,
      message,
      status: requestedSchedule.getTime() > Date.now() ? 'SCHEDULED' : 'QUEUED',
      scheduled_at: requestedSchedule.toISOString(),
      tracking_subids: ['whatsapp', destination.id, offer.marketplace.toLowerCase()],
    };

    // Persistent mode performs an atomic idempotency claim before queueing.
    // This closes the race where two concurrent requests pass the read-only dedup check.
    if (persistentStoreEnabled) {
      const inserted = await query<{ id: string }>(
        `INSERT INTO publications
          (id,workspace_id,offer_id,destination_id,status,idempotency_key,scheduled_at,affiliate_link_id,affiliate_url,message,tracking_subids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (workspace_id,idempotency_key) DO NOTHING
         RETURNING id`,
        [
          publication.id, publication.workspace_id, publication.offer_id, publication.destination_id, publication.status,
          publication.idempotency_key, publication.scheduled_at, publication.affiliate_link_id, publication.affiliate_url,
          publication.message, JSON.stringify(publication.tracking_subids || []),
        ],
      );
      if (!inserted.length) {
        const existing = await query<any>(
          'SELECT id,workspace_id,offer_id,destination_id,status,idempotency_key,provider_message_id,error,scheduled_at,published_at,affiliate_link_id,affiliate_url,message,tracking_subids FROM publications WHERE workspace_id=$1 AND idempotency_key=$2',
          [publication.workspace_id, publication.idempotency_key],
        );
        return res.status(202).json({ success:true, queued:false, duplicate:true, publication: existing[0] || null });
      }
    }

    // Queue publication for asynchronous processing. The worker is the only component that sends to WhatsApp.
    store.publications.set(publication.id, publication);
    if (persistentStoreEnabled) await store.persist(req.user!.workspaceId);
    try {
      const { enqueuePublication } = await import('./src/infrastructure/queue.ts');
      await enqueuePublication({ publicationId: publication.id, destinationId: destination.id, offerId: offer.id, scheduledAt: publication.scheduled_at });
    } catch (error) {
      publication.status = 'FAILED';
      publication.error_message = (error as Error).message;
      // Falha de infraestrutura da fila não invalida o link de afiliado.
      // A oferta continua pronta para nova tentativa quando o Redis/worker voltar.
      return res.status(503).json({ success:false, publication, error:'Fila de publicação indisponível.' });
    }
    return res.status(202).json({ success:true, queued:true, publication });
  });

  // 10. Destinations
  app.get('/api/destinations', (req, res) => {
    res.json(Array.from(store.destinations.values()));
  });

  app.post('/api/destinations', (req, res) => {
    const body = req.body as Partial<Destination>;
    const id = body.id || `dest_${Date.now()}`;
    if (!body.identifier || !String(body.identifier).trim()) return res.status(400).json({ error: 'identifier é obrigatório.' });
    const normalizedKeywords = (body.keywords || []).map((k:string)=>String(k).trim()).filter(Boolean).slice(0,5);
    const normalizedCategories = (body.categories || []).map((k:string)=>String(k).trim()).filter(Boolean).slice(0,5);
    const destinationType=String(body.type || 'WHATSAPP_GROUP');
    const destinationMarketplaces=(body.marketplaces || ['SHOPEE','MERCADOLIVRE']).map((v:string)=>String(v).toUpperCase());
    if (!['WHATSAPP_GROUP','WHATSAPP_CHANNEL','WHATSAPP_BROADCAST'].includes(destinationType)) return res.status(400).json({error:'Tipo de destino inválido.'});
    if (destinationMarketplaces.some((v:string)=>!['SHOPEE','MERCADOLIVRE'].includes(v))) return res.status(400).json({error:'Marketplace de destino inválido.'});
    const frequency=Number(body.frequency_minutes ?? 60);
    if (!Number.isInteger(frequency) || frequency < 5 || frequency > 1440) return res.status(400).json({error:'Frequência deve estar entre 5 e 1440 minutos.'});
    const destination: Destination = {
      id,
      workspace_id: req.user!.workspaceId,
      type: destinationType as any,
      identifier: body.identifier || '',
      name: body.name || 'Novo destino WhatsApp',
      description: body.description,
      categories: normalizedCategories,
      marketplaces: destinationMarketplaces as any,
      keywords: normalizedKeywords,
      frequency_minutes: frequency,
      time_start: body.time_start || '08:00',
      time_end: body.time_end || '22:00',
      priority: body.priority || 'NORMAL',
      is_active: body.is_active !== undefined ? body.is_active : true,
    };

    store.destinations.set(destination.id, destination);
    res.json(destination);
  });

  // 11. Publications Queue & History
  app.get('/api/publications', (req, res) => {
    res.json(Array.from(store.publications.values()).reverse());
  });

  // 12. Reports / Dashboard with persisted publication and real analytics data.
  app.get('/api/reports', async (req, res) => {
    try {
      const allOffers = Array.from(store.offers.values());
      const allPubs = Array.from(store.publications.values());
      const analytics = await AnalyticsService.report(req.user!.workspaceId);
      const sh = analytics.byMarketplace.SHOPEE || {clicks:0,conversions:0,valueBrl:0,commissionBrl:0};
      const ml = analytics.byMarketplace.MERCADOLIVRE || {clicks:0,conversions:0,valueBrl:0,commissionBrl:0};
      const shopeeOffers = allOffers.filter(o=>o.marketplace==='SHOPEE');
      const mlOffers = allOffers.filter(o=>o.marketplace==='MERCADOLIVRE');
      const shopeePubs = allPubs.filter(p=>p.offer?.marketplace==='SHOPEE');
      const mlPubs = allPubs.filter(p=>p.offer?.marketplace==='MERCADOLIVRE');
      res.json({
        shopee:{productsFound:shopeeOffers.length,affiliateLinksReady:shopeeOffers.filter(o=>['AFFILIATE_LINK_READY','PUBLISHED'].includes(o.status)).length,publications:shopeePubs.length,clicksTracked:sh.clicks,conversions:sh.conversions,commissionBrl:Number(sh.commissionBrl.toFixed(2))},
        mercadolivre:{productsFound:mlOffers.length,affiliateLinksReady:mlOffers.filter(o=>['AFFILIATE_LINK_READY','PUBLISHED'].includes(o.status)).length,publications:mlPubs.length,clicksTracked:ml.clicks,conversions:ml.conversions,commissionBrl:Number(ml.commissionBrl.toFixed(2))},
        analytics
      });
    } catch(err) { res.status(500).json({error:(err as Error).message}); }
  });

  // 13. Audit records (Section 29)
  app.get('/api/audit', (req, res) => {
    const marketplace = req.query.marketplace as any;
    res.json(AuditService.getAuditRecords(req.user!.workspaceId, marketplace));
  });

  // Analytics: real click/conversion counters persisted in PostgreSQL.
  app.get('/api/analytics', async (req, res) => {
    try { res.json(await AnalyticsService.report(req.user!.workspaceId)); }
    catch (err) { res.status(500).json({ error: (err as Error).message }); }
  });

  // Create a first-party tracking URL without fabricating marketplace metrics.
  app.post('/api/analytics/tracked-link', async (req, res) => {
    try {
      const { marketplace, affiliateUrl, affiliateLinkId, offerId, destinationId, subId } = req.body;
      if (!['SHOPEE','MERCADOLIVRE'].includes(String(marketplace))) return res.status(400).json({ error:'marketplace inválido.' });
      if (!affiliateUrl || !/^https:\/\//i.test(String(affiliateUrl))) return res.status(400).json({ error:'affiliateUrl HTTPS é obrigatório.' });
      const row = await AnalyticsService.createTrackedLink({ workspaceId:req.user!.workspaceId, marketplace, affiliateUrl, affiliateLinkId, offerId, destinationId, subId });
      const base=(process.env.APP_URL || '').replace(/\/$/,'');
      res.status(201).json({ ...row, trackingUrl: base ? base + '/r/' + row.id : null });
    } catch (err) { res.status(500).json({ error:(err as Error).message }); }
  });

  // Public redirect: records the click, then redirects to the real affiliate URL.
  app.get('/r/:id', async (req, res) => {
    try {
      const link = await AnalyticsService.getTrackedLink(req.params.id);
      if (!link) return res.status(404).send('Link não encontrado.');
      await AnalyticsService.trackClick({
        workspaceId:link.workspace_id, marketplace:link.marketplace, trackedLinkId:link.id,
        offerId:link.offer_id, destinationId:link.destination_id, subId:link.sub_id,
        metadata:{ userAgent:req.get('user-agent') || null, referer:req.get('referer') || null }
      });
      res.redirect(302, link.affiliate_url);
    } catch (err) { res.status(500).send('Não foi possível processar o link.'); }
  });


  app.get('/api/whatsapp/groups', redisRateLimit({windowSeconds:60,max:10,prefix:'wa-groups'}), async (req, res) => {
    try { res.json(await WhatsAppGroupService.listGroups(await WhatsAppSettingsService.get(req.user!.workspaceId))); }
    catch (err) { res.status(503).json({ error:(err as Error).message }); }
  });

  app.post('/api/whatsapp/groups/sync', async (req, res) => {
    try {
      const groups=await WhatsAppGroupService.listGroups(await WhatsAppSettingsService.get(req.user!.workspaceId));
      const selectedId=String(req.body.destinationId || '');
      if(selectedId){
        const d=store.destinations.get(selectedId);
        if(!d) return res.status(404).json({error:'Destino não encontrado.'});
        const remoteJid=String(req.body.remoteJid || '');
        const group=groups.find((g:any)=>String(g.id||g.remoteJid)===remoteJid);
        if(!group) return res.status(404).json({error:'Grupo não encontrado na instância Evolution.'});
        d.identifier=remoteJid;
        d.name=d.name || group.subject || remoteJid;
      }
      res.json({success:true,groups,destinations:Array.from(store.destinations.values())});
    } catch(err) { res.status(503).json({error:(err as Error).message}); }
  });

  app.get('/api/whatsapp/settings', async (req,res) => {
    try {
      const s=await WhatsAppSettingsService.get(req.user!.workspaceId);
      res.json({...s,apiToken:s.apiToken?'configured':'',evolutionApiKey:s.evolutionApiKey?'configured':''});
    } catch(err){ res.status(500).json({error:(err as Error).message}); }
  });

  app.post('/api/whatsapp/settings', async (req,res) => {
    try {
      const current=await WhatsAppSettingsService.get(req.user!.workspaceId);
      const body=req.body || {};
      const next={
        provider: body.provider || current.provider || 'evolution',
        apiToken: body.apiToken === 'configured' || !body.apiToken ? current.apiToken : String(body.apiToken),
        phoneNumberId: body.phoneNumberId || current.phoneNumberId,
        evolutionApiUrl: body.evolutionApiUrl || current.evolutionApiUrl,
        evolutionApiKey: body.evolutionApiKey === 'configured' || !body.evolutionApiKey ? current.evolutionApiKey : String(body.evolutionApiKey),
        evolutionInstance: body.evolutionInstance || current.evolutionInstance,
      };
      await WhatsAppSettingsService.save(req.user!.workspaceId,next as any);
      res.json({success:true,provider:next.provider});
    } catch(err){ res.status(400).json({error:(err as Error).message}); }
  });

  // Normalize Evolution QR payloads so the frontend can render them directly as an image.
  const normalizeQrCode = (value: unknown) => {
    if (!value || typeof value !== 'string') return null;
    const qr = value.trim();
    if (!qr) return null;
    if (qr.startsWith('data:image/')) return qr;
    if (/^[A-Za-z0-9+/=]+$/.test(qr) && qr.length > 100) return 'data:image/png;base64,' + qr;
    return qr;
  };

  // WhatsApp setup center: all Evolution lifecycle operations are exposed through the authenticated UI.
  const getEvolutionConfig = async (workspaceId: string) => {
    const settings = await WhatsAppSettingsService.get(workspaceId);
    const base = (settings.evolutionApiUrl || process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
    const key = settings.evolutionApiKey || process.env.EVOLUTION_API_KEY || '';
    const instance = settings.evolutionInstance || process.env.EVOLUTION_INSTANCE || '';
    if (settings.provider !== 'evolution' || !base || !key || !instance) throw new Error('Configure a Evolution API antes de continuar.');
    await assertSafeOutboundUrl(base);
    return { base, key, instance };
  };

  app.get('/api/whatsapp/status', async (req,res) => {
    try {
      const cfg = await getEvolutionConfig(req.user!.workspaceId);
      const r = await fetch(cfg.base + '/instance/connectionState/' + encodeURIComponent(cfg.instance), { headers:{apikey:cfg.key} });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) return res.status(r.status).json({configured:true,state:'error',error:'Evolution API não respondeu corretamente.'});
      res.json({configured:true,instance:cfg.instance,state:data?.instance?.state || data?.state || 'unknown'});
    } catch(err) { res.status(400).json({configured:false,state:'not_configured',error:(err as Error).message}); }
  });

  app.post('/api/whatsapp/connect', async (req,res) => {
    try {
      const cfg = await getEvolutionConfig(req.user!.workspaceId);
      const headers = { apikey:cfg.key, 'Content-Type':'application/json' };
      const instancesRes = await fetch(cfg.base + '/instance/fetchInstances', {headers:{apikey:cfg.key}});
      let instances:any[] = [];
      if (instancesRes.ok) { const raw=await instancesRes.json().catch(()=>[]); instances=Array.isArray(raw)?raw:(raw?.instances||raw?.response||[]); }
      const exists = instances.some((i:any)=>String(i?.name||i?.instanceName||i?.instance?.instanceName||'')===cfg.instance);
      if (exists) {
        const stateRes = await fetch(cfg.base + '/instance/connectionState/' + encodeURIComponent(cfg.instance), {headers:{apikey:cfg.key}});
        const stateData = await stateRes.json().catch(()=>({}));
        const currentState = stateData?.instance?.state || stateData?.state;
        if (currentState === 'open') return res.json({state:'open',qrcode:null,instance:cfg.instance});
      }
      if (!exists) {
        const create = await fetch(cfg.base + '/instance/create', {method:'POST',headers,body:JSON.stringify({instanceName:cfg.instance,integration:'WHATSAPP-BAILEYS',qrcode:true,groupsIgnore:false,alwaysOnline:true})});
        if (!create.ok && create.status !== 409) return res.status(create.status).json({error:'Não foi possível criar a conexão WhatsApp.'});
        const created=await create.json().catch(()=>({}));
        const qr=normalizeQrCode(created?.qrcode?.base64 || created?.qrcode?.code || null);
        if(qr) return res.json({state:'connecting',qrcode:qr,instance:cfg.instance});
      }
      const connect = await fetch(cfg.base + '/instance/connect/' + encodeURIComponent(cfg.instance), {headers:{apikey:cfg.key}});
      const data=await connect.json().catch(()=>({}));
      if(!connect.ok) return res.status(connect.status).json({error:'Não foi possível gerar o QR Code.'});
      res.json({state:'connecting',qrcode:normalizeQrCode(data?.base64 || data?.qrcode?.base64 || data?.qrcode?.code || data?.code || null),instance:cfg.instance});
    } catch(err) { res.status(400).json({error:(err as Error).message}); }
  });

  app.get('/api/whatsapp/qrcode', async (req,res) => {
    try {
      const cfg=await getEvolutionConfig(req.user!.workspaceId);
      const r=await fetch(cfg.base + '/instance/connect/' + encodeURIComponent(cfg.instance),{headers:{apikey:cfg.key}});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) return res.status(r.status).json({error:'Não foi possível obter o QR Code.'});
      res.json({qrcode:normalizeQrCode(data?.base64 || data?.qrcode?.base64 || data?.qrcode?.code || data?.code || null)});
    } catch(err){res.status(400).json({error:(err as Error).message});}
  });

  app.post('/api/whatsapp/test', async (req,res) => {
    try {
      const cfg=await getEvolutionConfig(req.user!.workspaceId);
      const number=String(req.body?.number||'').trim();
      const text=String(req.body?.text||'Teste enviado pelo WhatsappAfiliado.').slice(0,2000);
      if(!/^\d+@g\.us$/.test(number) && !/^\d+@s\.whatsapp\.net$/.test(number)) return res.status(400).json({error:'Informe um JID válido de grupo (@g.us) ou contato (@s.whatsapp.net).'});
      const r=await fetch(cfg.base + '/message/sendText/' + encodeURIComponent(cfg.instance),{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({number,text,linkPreview:true})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) return res.status(r.status).json({error:'A Evolution API recusou o envio da mensagem.'});
      res.json({success:true,messageId:data?.key?.id || data?.response?.key?.id || null});
    } catch(err){res.status(400).json({error:(err as Error).message});}
  });
  app.get('/api/coupons', async (req,res) => {
    try { res.json(await CouponService.getCouponsForProduct(req.user!.workspaceId, String(req.query.marketplace || 'SHOPEE') as any, req.query.productId ? String(req.query.productId) : undefined)); }
    catch(err){ res.status(500).json({error:(err as Error).message}); }
  });

  app.post('/api/coupons', async (req,res) => {
    try {
      const { marketplace, code, description, discountType, discountValueBrl, minPurchaseValue, maxDiscountValue, startsAt, expiresAt, sourceUrl, productExternalId } = req.body;
      if(!['SHOPEE','MERCADOLIVRE'].includes(String(marketplace))) return res.status(400).json({error:'marketplace inválido.'});
      const coupon=await CouponService.registerCoupon(req.user!.workspaceId,{ marketplace,code,description,discountType,discountValueBrl,minPurchaseValue,maxDiscountValue,startsAt,expiresAt,sourceUrl,productExternalId,isVerified:false });
      res.status(201).json(coupon);
    } catch(err){ res.status(400).json({error:(err as Error).message}); }
  });

  // Mount Vite middleware for development or serve static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  const shutdown = async () => { server.close(); if (persistentStoreEnabled) await closeDatabase(); process.exit(0); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer();
