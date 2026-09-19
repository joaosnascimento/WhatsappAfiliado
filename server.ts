import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
dotenv.config();

import { store, runWithWorkspace, findMarketplaceAccount } from './src/services/Store.ts';
import { runMigrations } from './src/infrastructure/migrations.ts';
import { ensureWorkspace } from './src/infrastructure/workspace.ts';
import { closeDatabase } from './src/infrastructure/database.ts';
import { registerUser, authenticateUser, createSession } from './src/services/auth.ts';
import { requireAuth } from './src/services/authMiddleware.ts';
import { ShopeeAffiliateAdapter } from './integrations/shopee/ShopeeAffiliateAdapter.ts';
import { MercadoLivreAffiliateAdapter } from './integrations/mercadolivre/MercadoLivreAffiliateAdapter.ts';
import { MercadoLivreOAuthService } from './integrations/mercadolivre/MercadoLivreOAuthService.ts';
import { MercadoLivreAffiliateService } from './integrations/mercadolivre/MercadoLivreAffiliateService.ts';
import { AiMessageService } from './src/services/AiMessageService.ts';
import { WhatsAppProvider } from './src/services/WhatsAppProvider.ts';
import { DeduplicationService } from './src/services/DeduplicationService.ts';
import { AuditService } from './src/services/AuditService.ts';
import { runTests } from './src/test/integrations.test.ts';
import type { Offer, Publication, Destination } from './src/types/affiliate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mlOAuthTransactions = new Map<string, { codeVerifier: string; createdAt: number; accountId: string; workspaceId: string }>();
const ML_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
function cleanupExpiredMlOAuthTransactions() {
  const now = Date.now();
  for (const [state, tx] of mlOAuthTransactions) if (now - tx.createdAt > ML_OAUTH_STATE_TTL_MS) mlOAuthTransactions.delete(state);
}

async function startServer() {
  const persistentStoreEnabled = Boolean(process.env.DATABASE_URL) && process.env.ALLOW_INMEMORY_STORE !== 'true';

  if (process.env.NODE_ENV === 'production' && !persistentStoreEnabled) {
    throw new Error('Production startup blocked: DATABASE_URL and persistent storage are required.');
  }
  if (persistentStoreEnabled) {
    if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is required when persistent storage is enabled.');
    await runMigrations();
    // Individual authenticated workspaces are loaded lazily by the request context.
    await ensureWorkspace('ws_default');
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/auth/register', async (req, res) => {
    if (!persistentStoreEnabled) return res.status(503).json({ error: 'Persistent storage is required for authentication.' });
    try { const user = await registerUser(String(req.body.email || ''), String(req.body.password || '')); res.status(201).json({ success:true, user }); }
    catch (error) { res.status(400).json({ error:(error as Error).message }); }
  });

  app.post('/api/auth/login', async (req, res) => {
    if (!persistentStoreEnabled) return res.status(503).json({ error: 'Persistent storage is required for authentication.' });
    const user = await authenticateUser(String(req.body.email || ''), String(req.body.password || ''));
    if (!user) return res.status(401).json({ error:'Credenciais inválidas.' });
    res.json({ success:true, token:createSession(user), user });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user:req.user }));

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

  app.use('/api/accounts', requireAuth);
  app.use('/api/offers', requireAuth);
  app.use('/api/destinations', requireAuth);
  app.use('/api/publications', requireAuth);
  app.use('/api/reports', requireAuth);
  app.use('/api/audit', requireAuth);

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Automacao Afiliados WhatsApp SaaS',
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      mercadolivreConfigured: !!process.env.MERCADOLIVRE_CLIENT_ID,
      shopeeConfigured: !!process.env.SHOPEE_AFFILIATE_APP_ID,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Integration Unit Tests Runner
  app.get('/api/tests/run', (req, res) => {
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
      ...acc,
      // Hide raw secret in client response
      credentials_encrypted: {
        ...acc.credentials_encrypted,
        ml_client_secret: acc.credentials_encrypted.ml_client_secret ? '••••••••' : '',
        shopee_secret: acc.credentials_encrypted.shopee_secret ? '••••••••' : '',
      },
    }));
    res.json(list);
  });

  app.post('/api/accounts/:id', (req, res) => {
    const account = store.accounts.get(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    const { credentials } = req.body;
    if (credentials) {
      account.credentials_encrypted = {
        ...account.credentials_encrypted,
        ...credentials,
      };
      if (account.marketplace === 'SHOPEE') {
        account.status = credentials.shopee_app_id ? 'CONNECTED' : 'AWAITING_CONFIG';
        account.status_message = credentials.shopee_app_id
          ? 'Shopee Affiliate Open API configurada'
          : 'Aguardando App ID e Secret';
      } else {
        account.status = credentials.ml_client_id ? 'CONNECTED' : 'AWAITING_CONFIG';
        account.status_message = credentials.ml_client_id
          ? 'DevCenter configurado'
          : 'Aguardando Client ID';
      }
      account.updated_at = new Date().toISOString();
    }

    res.json({ success: true, account });
  });

  // 4. Mercado Livre OAuth Flow
  app.get('/api/auth/mercadolivre/url', requireAuth, (req, res) => {
    const mlAccount = findMarketplaceAccount('MERCADOLIVRE');
    const clientId = mlAccount?.credentials_encrypted.ml_client_id || process.env.MERCADOLIVRE_CLIENT_ID || '';
    const redirectUri = mlAccount?.credentials_encrypted.ml_redirect_uri || process.env.MERCADOLIVRE_REDIRECT_URI || '';

    const oauth = new MercadoLivreOAuthService({
      clientId,
      clientSecret: mlAccount?.credentials_encrypted.ml_client_secret || process.env.MERCADOLIVRE_CLIENT_SECRET || '',
      redirectUri,
    });

    try {
      const authorization = oauth.createAuthorization();
      if (!mlAccount) return res.status(400).json({ error: 'Nenhuma conta do Mercado Livre foi criada neste workspace.' });
      mlOAuthTransactions.set(authorization.state, { codeVerifier: authorization.codeVerifier, createdAt: Date.now(), accountId: mlAccount.id, workspaceId: req.user!.workspaceId });
      cleanupExpiredMlOAuthTransactions();
      res.json({ url: authorization.url });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/auth/mercadolivre/callback', async (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    cleanupExpiredMlOAuthTransactions();
    if (!code) return res.status(400).send('Código de autorização não recebido do Mercado Livre.');
    if (!state) return res.status(400).send('State OAuth ausente.');

    const transaction = mlOAuthTransactions.get(state);
    if (!transaction || Date.now() - transaction.createdAt > ML_OAUTH_STATE_TTL_MS) {
      return res.status(400).send('State OAuth inválido ou expirado.');
    }
    mlOAuthTransactions.delete(state);

    try {
      await runWithWorkspace(transaction.workspaceId, async () => {
        const mlAccount = store.accounts.get(transaction.accountId);
        const clientId = mlAccount?.credentials_encrypted.ml_client_id || process.env.MERCADOLIVRE_CLIENT_ID || '';
        const clientSecret = mlAccount?.credentials_encrypted.ml_client_secret || process.env.MERCADOLIVRE_CLIENT_SECRET || '';
        const redirectUri = mlAccount?.credentials_encrypted.ml_redirect_uri || process.env.MERCADOLIVRE_REDIRECT_URI || '';

        const oauth = new MercadoLivreOAuthService({ clientId, clientSecret, redirectUri });
        const tokenData = await oauth.exchangeCodeForToken(code, transaction.codeVerifier);

        if (!mlAccount) throw new Error('Conta do Mercado Livre não encontrada no workspace.');

        mlAccount.credentials_encrypted.ml_access_token = tokenData.access_token;
        mlAccount.credentials_encrypted.ml_refresh_token = tokenData.refresh_token;
        mlAccount.credentials_encrypted.ml_user_id = String(tokenData.user_id);
        mlAccount.credentials_encrypted.ml_expires_at = Date.now() + tokenData.expires_in * 1000;
        mlAccount.status = 'CONNECTED';
        mlAccount.status_message = `Conectado com sucesso (User ID: ${tokenData.user_id})`;

        await store.persist(transaction.workspaceId);
      });

      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc;">
            <h2 style="color: #16a34a;">Mercado Livre Conectado com Sucesso!</h2>
            <p>Seu token de acesso foi armazenado de forma segura.</p>
            <script>
              setTimeout(function() {
                window.close();
                if (window.opener) { window.opener.location.reload(); }
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      res.status(500).send(`Erro ao trocar código por token: ${(err as Error).message}`);
    }
  });

  // 5. Test Integration Diagnostic (Mercado Livre & Shopee)
  app.post('/api/test-integration/:marketplace', async (req, res) => {
    const marketplace = req.params.marketplace.toUpperCase();

    if (marketplace === 'SHOPEE') {
      const account = findMarketplaceAccount('SHOPEE');
      const appId = account?.credentials_encrypted.shopee_app_id || process.env.SHOPEE_AFFILIATE_APP_ID || '';
      const secret = account?.credentials_encrypted.shopee_secret || process.env.SHOPEE_AFFILIATE_SECRET || '';

      const adapter = new ShopeeAffiliateAdapter(appId, secret);
      const testResult = await adapter.testConnection();
      return res.json(testResult);
    } else if (marketplace === 'MERCADOLIVRE') {
      const account = store.accounts.get('acc_mercadolivre_br');
      const adapter = new MercadoLivreAffiliateAdapter({
        clientId: account?.credentials_encrypted.ml_client_id,
        clientSecret: account?.credentials_encrypted.ml_client_secret,
        redirectUri: account?.credentials_encrypted.ml_redirect_uri,
        accessToken: account?.credentials_encrypted.ml_access_token,
      });
      const testResult = await adapter.testConnection();
      return res.json(testResult);
    } else {
      return res.status(400).json({ error: 'Marketplace inválido' });
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
  app.post('/api/offers/search-live', async (req, res) => {
    const { marketplace, keyword, category, minDiscount } = req.body;

    try {
      if (marketplace === 'SHOPEE') {
        const account = store.accounts.get('acc_shopee_br');
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
        // Mercado Livre live search
        const mlAccount = store.accounts.get('acc_mercadolivre_br');
        const adapter = new MercadoLivreAffiliateAdapter({
          clientId: mlAccount?.credentials_encrypted.ml_client_id,
          accessToken: mlAccount?.credentials_encrypted.ml_access_token,
        });

        const products = await adapter.searchOffers({
          keyword: keyword || 'smartphone',
          category,
          limit: 10,
        });

        const createdOffers: Offer[] = [];
        for (const p of products) {
          store.products.set(p.id, p);

          // Rule 4: Mercado Livre open API does not produce auto-affiliate links.
          // Ingest as VALIDATED, preserving original_url, requiring verified meli.la link before publish!
          const offer: Offer = {
            id: `offer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            product_id: p.id,
            product: p,
            marketplace: 'MERCADOLIVRE',
            price: p.price,
            original_price: p.original_price,
            discount: p.discount,
            commission: p.commission,
            score: Math.min(100, Math.round((p.discount || 10) * 1.5 + 40)),
            status: 'VALIDATED', // Requires manual or verified link import
            status_reason: 'Link de afiliado oficial do Mercado Livre (ex: meli.la) pendente de associação.',
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          };

          store.offers.set(offer.id, offer);
          createdOffers.push(offer);
        }

        return res.json({ count: createdOffers.length, offers: createdOffers });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 7. Rule 4: Associate Mercado Livre Affiliate Link
  app.post('/api/offers/:id/associate-ml-link', (req, res) => {
    const offer = store.offers.get(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Oferta não encontrada.' });
    }

    const { affiliateUrl, destinationId, campaignId } = req.body;
    if (!affiliateUrl) {
      return res.status(400).json({ error: 'affiliateUrl é obrigatória.' });
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
  app.post('/api/offers/:id/publish', async (req, res) => {
    const offer = store.offers.get(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Oferta não encontrada.' });
    }

    // MANDATORY GATE: Section 17
    // "PRODUCT_FOUND != AFFILIATE_LINK_READY"
    // "Somente AFFILIATE_LINK_READY poderá seguir para publicação automática."
    if (offer.status !== 'AFFILIATE_LINK_READY' && offer.status !== 'READY_TO_PUBLISH') {
      return res.status(400).json({
        error: `Bloqueio de Segurança: A oferta está no status '${offer.status}'. Apenas ofertas no status 'AFFILIATE_LINK_READY' com link rastreado e validado podem ser publicadas.`,
      });
    }

    const destinationId = req.body.destinationId || 'dest_pokemon';
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

    // Ensure AI message exists or generate it
    let message = offer.ai_generated_message;
    if (!message) {
      message = await AiMessageService.generateMessage({
        product: offer.product,
        marketplace: offer.marketplace,
        affiliateUrl: offer.affiliate_url!,
        destinationName: destination.name,
      });
      offer.ai_generated_message = message;
    }

    const publication: Publication = {
      id: `pub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      offer_id: offer.id,
      offer,
      destination_id: destination.id,
      destination,
      affiliate_link_id: offer.affiliate_link_id || 'link_direct',
      affiliate_url: offer.affiliate_url!,
      message,
      status: 'QUEUED',
      scheduled_at: new Date().toISOString(),
      tracking_subids: ['whatsapp', destination.id, offer.marketplace.toLowerCase()],
    };

    // Queue publication for asynchronous processing. The worker is the only component that sends to WhatsApp.
    store.publications.set(publication.id, publication);
    if (persistentStoreEnabled) await store.persist(req.user!.workspaceId);
    try {
      const { enqueuePublication } = await import('./src/infrastructure/queue.ts');
      await enqueuePublication({ publicationId: publication.id, destinationId: destination.id, offerId: offer.id });
    } catch (error) {
      publication.status = 'FAILED';
      publication.error_message = (error as Error).message;
      offer.status = 'FAILED';
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
    const destination: Destination = {
      id,
      workspace_id: 'ws_default',
      type: body.type || 'WHATSAPP_GROUP',
      identifier: body.identifier || '120363000000000000@g.us',
      name: body.name || 'Novo Grupo WhatsApp',
      description: body.description,
      categories: body.categories || [],
      marketplaces: body.marketplaces || ['SHOPEE', 'MERCADOLIVRE'],
      keywords: body.keywords || [],
      frequency_minutes: body.frequency_minutes || 60,
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

  // 12. Reports / Dashboard (Section 24: Separar claramente ML e Shopee)
  app.get('/api/reports', (req, res) => {
    const allOffers = Array.from(store.offers.values());
    const allPubs = Array.from(store.publications.values());
    const allConvs = Array.from(store.conversions.values());

    // Shopee Metrics
    const shopeeOffers = allOffers.filter((o) => o.marketplace === 'SHOPEE');
    const shopeeReadyLinks = shopeeOffers.filter((o) => o.status === 'AFFILIATE_LINK_READY' || o.status === 'PUBLISHED');
    const shopeePubs = allPubs.filter((p) => p.offer?.marketplace === 'SHOPEE');
    const shopeeConvs = allConvs.filter((c) => c.marketplace === 'SHOPEE');
    const shopeeCommission = shopeeConvs.reduce((sum, c) => sum + c.commission, 0);

    // Mercado Livre Metrics
    const mlOffers = allOffers.filter((o) => o.marketplace === 'MERCADOLIVRE');
    const mlReadyLinks = mlOffers.filter((o) => o.status === 'AFFILIATE_LINK_READY' || o.status === 'PUBLISHED');
    const mlPubs = allPubs.filter((p) => p.offer?.marketplace === 'MERCADOLIVRE');
    const mlConvs = allConvs.filter((c) => c.marketplace === 'MERCADOLIVRE');
    const mlCommission = mlConvs.reduce((sum, c) => sum + c.commission, 0);

    res.json({
      shopee: {
        productsFound: shopeeOffers.length,
        affiliateLinksReady: shopeeReadyLinks.length,
        publications: shopeePubs.length,
        clicksEstimated: shopeePubs.length * 48,
        conversions: shopeeConvs.length,
        commissionBrl: Number(shopeeCommission.toFixed(2)),
      },
      mercadolivre: {
        productsFound: mlOffers.length,
        affiliateLinksReady: mlReadyLinks.length,
        publications: mlPubs.length,
        clicksEstimated: mlPubs.length * 35,
        conversions: mlConvs.length,
        commissionBrl: Number(mlCommission.toFixed(2)),
      },
      recentConversions: allConvs,
    });
  });

  // 13. Audit records (Section 29)
  app.get('/api/audit', (req, res) => {
    const marketplace = req.query.marketplace as any;
    res.json(AuditService.getAuditRecords(marketplace));
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
