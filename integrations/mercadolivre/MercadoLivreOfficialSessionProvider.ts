import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { MarketplaceAccount, AffiliateProduct } from '../../src/types/affiliate.ts';
import { MercadoLivreAffiliateService } from './MercadoLivreAffiliateService.ts';

const PORTAL_URLS = [
  'https://www.mercadolivre.com.br/afiliados/linkbuilder',
  'https://www.mercadolivre.com.br/afiliados',
  'https://www.mercadolivre.com.br/l/afiliados-home',
];
const SEARCH_URL = 'https://lista.mercadolivre.com.br/';
const ML_HOST = /(^|\.)mercadolivre\.com\.br$/i;
const MeliShortLink = /^https:\/\/(?:www\.)?meli\.la\/[A-Za-z0-9_-]+/i;

type Runtime = { browser: Browser; context: BrowserContext; page: Page };
const runtimes = new Map<string, Runtime>();

function sessionFromAccount(account: MarketplaceAccount): any | undefined {
  const raw = account.credentials_encrypted.ml_session_state;
  if (!raw) return undefined;
  try { return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')); } catch { return undefined; }
}

async function persistSession(account: MarketplaceAccount, context: BrowserContext, status: MarketplaceAccount['credentials_encrypted']['ml_session_status']) {
  const state = await context.storageState();
  account.credentials_encrypted.ml_session_state = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  account.credentials_encrypted.ml_session_status = status;
  account.credentials_encrypted.ml_session_updated_at = new Date().toISOString();
  account.status = status === 'CONNECTED' ? 'CONNECTED' : status === 'EXPIRED' ? 'TOKEN_EXPIRED' : 'AWAITING_CONFIG';
  account.status_message =
    status === 'CONNECTED' ? 'Sessão do Mercado Livre conectada e pronta para automação.' :
    status === 'EXPIRED' ? 'Sessão do Mercado Livre expirada. Reconecte para continuar.' :
    'Aguardando autenticação no Mercado Livre.';
  account.updated_at = new Date().toISOString();
}

async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  if (/login|auth|signin/i.test(url)) return false;
  try {
    // Mercado Livre pages can contain "Entrar" in menus/footers even when the
    // authenticated session is valid. Do not use generic body text as a
    // negative signal; only an actual login form/redirect means the session is
    // expired.
    const password = page.locator('input[type="password"]').first();
    if (await password.count() && await password.isVisible().catch(() => false)) return false;
    const loginForm = page.locator('form').filter({ has: page.locator('input[type="password"]') }).first();
    if (await loginForm.count() && await loginForm.isVisible().catch(() => false)) return false;
    return true;
  } catch {
    return !/login|auth|signin/i.test(page.url());
  }
}

async function waitForAuthentication(page: Page, timeoutMs = 5 * 60 * 1000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) return true;
    await page.waitForTimeout(1500);
  }
  return false;
}

async function launch(account: MarketplaceAccount, headed: boolean): Promise<Runtime> {
  const existing = runtimes.get(account.id);
  if (existing) {
    try {
      if (!existing.browser.isConnected() || existing.context.pages().length === 0 || existing.page.isClosed()) {
        throw new Error('runtime closed');
      }
      // A runtime created for the interactive login must remain headed. Reuse it
      // only when it is actually alive; otherwise create a fresh browser.
      return existing;
    } catch {
      runtimes.delete(account.id);
      try { await existing.context.close(); } catch {}
      try { await existing.browser.close(); } catch {}
    }
  }

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const saved = sessionFromAccount(account);
  const context = await browser.newContext(saved ? { storageState: saved } : {});
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const runtime = { browser, context, page };
  runtimes.set(account.id, runtime);

  browser.on('disconnected', () => {
    runtimes.delete(account.id);
  });
  return runtime;
}

async function closeAndPersist(account: MarketplaceAccount, runtime: Runtime) {
  try { await persistSession(account, runtime.context, 'CONNECTED'); } catch {}
  try { await runtime.browser.close(); } catch {}
  runtimes.delete(account.id);
}

async function findAffiliateLink(page: Page): Promise<string | null> {
  const hrefs = await page.locator('a[href*="meli.la"]').evaluateAll((els) =>
    els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean)
  ).catch(() => [] as string[]);
  for (const href of hrefs) if (MeliShortLink.test(href)) return href.match(MeliShortLink)![0];

  const values = await page.locator('input, textarea').evaluateAll((els) =>
    els.map((el) => String((el as HTMLInputElement).value || (el as HTMLInputElement).getAttribute('value') || '')).filter(Boolean)
  ).catch(() => [] as string[]);
  for (const value of values) {
    const match = value.match(/https:\/\/(?:www\.)?meli\.la\/[A-Za-z0-9_-]+/i);
    if (match) return match[0];
  }
  const body = await page.locator('body').innerText().catch(() => '');
  const match = body.match(/https:\/\/(?:www\.)?meli\.la\/[A-Za-z0-9_-]+/i);
  return match ? match[0] : null;
}

async function openAffiliateGenerator(page: Page) {
  for (const url of PORTAL_URLS) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const hasGeneratorField = await page.locator(
        'textarea[placeholder*="url" i], textarea[name*="url" i], input[type="url"], input[placeholder*="url" i], input[name*="url" i], input[aria-label*="url" i], [contenteditable="true"]'
      ).count() > 0;
      if (hasGeneratorField) return;
    } catch {}
  }

  const generatorLink = page.getByRole('link', { name: /gerador de links|criar link|gerar link/i }).first();
  if (await generatorLink.count()) {
    await generatorLink.click();
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    return;
  }

  const generatorButton = page.getByRole('button', { name: /gerador de links|criar link|gerar link/i }).first();
  if (await generatorButton.count()) {
    await generatorButton.click();
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    return;
  }

  throw new Error('Não foi possível localizar o Gerador de Links no Portal de Afiliados do Mercado Livre.');
}

async function fillGenerator(page: Page, originalUrl: string) {
  const candidates = [
    page.getByLabel(/insira .*url|url.*produto|link.*produto/i).first(),
    page.getByPlaceholder(/insira .*url|cole.*url|url.*produto|uma ou mais urls/i).first(),
    page.locator('textarea[name*="url" i], textarea[placeholder*="url" i]').first(),
    page.locator('input[name*="url" i], input[aria-label*="url" i], input[type="url"]').first(),
    page.locator('[contenteditable="true"]').first(),
    page.locator('textarea').first(),
  ];

  let filled = false;
  for (const locator of candidates) {
    try {
      if (await locator.count() && await locator.isVisible().catch(() => false)) {
        await locator.fill(originalUrl);
        filled = true;
        break;
      }
    } catch {}
  }

  if (!filled) {
    throw new Error('O Gerador de Links do Mercado Livre mudou a interface e o campo de URL não foi localizado. Abra o gerador oficial ou use a opção de inserir o link manualmente.');
  }

  const buttons = [
    page.getByRole('button', { name: /gerar link|gerar|criar link/i }).first(),
    page.getByRole('button', { name: /compartilhar/i }).first(),
    page.getByText(/gerar link/i).first(),
    page.locator('button[type="submit"]').first(),
  ];

  for (const button of buttons) {
    try {
      if (await button.count() && await button.isVisible().catch(() => false)) {
        await button.click();
        return;
      }
    } catch {}
  }

  throw new Error('O botão para gerar o link não foi localizado no Portal de Afiliados. Use a opção de inserir o link manualmente.');
}

export class MercadoLivreOfficialSessionProvider {
  static async status(account: MarketplaceAccount) {
    const runtime = runtimes.get(account.id);
    if (runtime) {
      const logged = await isLoggedIn(runtime.page);
      if (logged) {
        await persistSession(account, runtime.context, 'CONNECTED');
        return { connected: true, status: 'CONNECTED', browserActive: true, updatedAt: account.credentials_encrypted.ml_session_updated_at };
      }
      await persistSession(account, runtime.context, 'EXPIRED');
      try { await runtime.browser.close(); } catch {}
      runtimes.delete(account.id);
      return { connected: false, status: 'EXPIRED', browserActive: false, updatedAt: account.credentials_encrypted.ml_session_updated_at };
    }

    const saved = sessionFromAccount(account);
    if (!saved) {
      account.credentials_encrypted.ml_session_status = 'DISCONNECTED';
      account.status = 'AWAITING_CONFIG';
      account.status_message = 'Mercado Livre desconectado.';
      return { connected: false, status: 'DISCONNECTED', browserActive: false };
    }

    // Never trust a persisted CONNECTED flag alone: the user can revoke the
    // Mercado Livre session outside this application.
    const runtimeCheck = await launch(account, false);
    try {
      await runtimeCheck.page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const logged = await isLoggedIn(runtimeCheck.page);
      if (!logged) {
        await persistSession(account, runtimeCheck.context, 'EXPIRED');
        return { connected: false, status: 'EXPIRED', browserActive: false, updatedAt: account.credentials_encrypted.ml_session_updated_at };
      }
      await persistSession(account, runtimeCheck.context, 'CONNECTED');
      return { connected: true, status: 'CONNECTED', browserActive: false, updatedAt: account.credentials_encrypted.ml_session_updated_at };
    } catch (error) {
      account.credentials_encrypted.ml_session_status = 'ERROR';
      account.status = 'AUTH_ERROR';
      account.status_message = 'Não foi possível validar a sessão do Mercado Livre: ' + (error as Error).message;
      account.updated_at = new Date().toISOString();
      return { connected: false, status: 'ERROR', browserActive: false, error: account.status_message };
    } finally {
      try { await runtimeCheck.browser.close(); } catch {}
      runtimes.delete(account.id);
    }
  }

  static async connect(account: MarketplaceAccount) {
    account.credentials_encrypted.ml_session_status = 'CONNECTING';
    account.status = 'AWAITING_CONFIG';
    account.status_message = 'Abrindo sessão do Mercado Livre...';
    account.updated_at = new Date().toISOString();
    const runtime = await launch(account, true);
    try {
      await runtime.page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      runtimes.delete(account.id);
      try { await runtime.context.close(); } catch {}
      try { await runtime.browser.close(); } catch {}
      throw new Error(`Não foi possível abrir o Mercado Livre no navegador: ${(error as Error).message}`);
    }
    const logged = await isLoggedIn(runtime.page);
    if (!logged) {
      account.credentials_encrypted.ml_session_status = 'LOGIN_REQUIRED';
      account.status = 'AWAITING_CONFIG';
      account.status_message = 'Faça login no navegador Mercado Livre aberto pelo WhatsappAfiliado.';
      account.updated_at = new Date().toISOString();

      // Keep the connect request alive until the first login is completed. This
      // guarantees the captured storage state is persisted before the request
      // finishes, so the Chromium window can be closed afterwards.
      const authenticated = await waitForAuthentication(runtime.page);
      if (!authenticated) {
        return { connected: false, status: 'LOGIN_REQUIRED', message: 'Navegador aberto. Faça login no Mercado Livre; a sessão será capturada automaticamente.' };
      }
      await persistSession(account, runtime.context, 'CONNECTED');
      try { await runtime.browser.close(); } catch {}
      runtimes.delete(account.id);
      return { connected: true, status: 'CONNECTED', message: 'Login capturado. A sessão foi salva e o navegador pode permanecer fechado.' };
    }
    await runtime.page.goto(PORTAL_URLS[0], { waitUntil: 'domcontentloaded' });
    await persistSession(account, runtime.context, 'CONNECTED');
    return { connected: true, status: 'CONNECTED', message: 'Mercado Livre conectado e pronto para automação.' };
  }

  static async generateLink(account: MarketplaceAccount, originalUrl: string, labels?: string[]) {
    if (!/^https:\/\/(?:www\.)?mercadolivre\.com\.br\//i.test(originalUrl)) throw new Error('A URL precisa ser um anúncio do Mercado Livre Brasil.');
    if (/(^|\/)(busca|categorias|ofertas|home|cart|checkout)(\/|$)/i.test(new URL(originalUrl).pathname)) throw new Error('Somente páginas individuais de produto podem gerar link de afiliado.');

    let runtime = runtimes.get(account.id);
    if (!runtime || !runtime.browser.isConnected() || runtime.page.isClosed()) {
      runtime = await launch(account, false);
      try {
        await runtime.page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (error) {
        runtimes.delete(account.id);
        try { await runtime.context.close(); } catch {}
        try { await runtime.browser.close(); } catch {}
        throw new Error(`Não foi possível abrir o Mercado Livre: ${(error as Error).message}`);
      }
    }
    if (!(await isLoggedIn(runtime.page))) {
      await persistSession(account, runtime.context, 'EXPIRED');
      throw new Error('Sessão do Mercado Livre expirada. Clique em Conectar Mercado Livre e faça login novamente.');
    }

    await openAffiliateGenerator(runtime.page);
    if (!(await isLoggedIn(runtime.page))) {
      await persistSession(account, runtime.context, 'EXPIRED');
      throw new Error('O Portal de Afiliados redirecionou para o login. Reconecte o Mercado Livre.');
    }
    await fillGenerator(runtime.page, originalUrl);

    // The official browser portal is the only attribution flow used here.
    // Do not inject custom IDs/subIds into the portal: its current UI can reject
    // generated Custom Id values (for example when a value contains ':').
    // The portal can take several seconds to create the attribution link.
    // Poll instead of using a fixed short delay so the publication pipeline does not
    // get stuck in "link pending" while the portal is still processing.
    let affiliateUrl: string | null = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !affiliateUrl) {
      affiliateUrl = await findAffiliateLink(runtime.page);
      if (affiliateUrl) break;
      await runtime.page.waitForTimeout(750);
    }
    if (!affiliateUrl) throw new Error('O Portal de Afiliados do Mercado Livre não retornou o link em até 30 segundos. Verifique a sessão do programa de afiliados e tente novamente.');
    const validation = MercadoLivreAffiliateService.validateAffiliateUrl(affiliateUrl, originalUrl);
    if (!validation.isValidAffiliateLink) throw new Error(validation.reason || 'Link afiliado inválido.');
    await persistSession(account, runtime.context, 'CONNECTED');
    return affiliateUrl;
  }

  static async discover(account: MarketplaceAccount, keyword: string, limit = 10): Promise<AffiliateProduct[]> {
    const q = keyword.trim();
    if (!q) return [];
    const saved = sessionFromAccount(account);
    if (!saved || account.credentials_encrypted.ml_session_status !== 'CONNECTED') {
      throw new Error('Mercado Livre não está conectado. Faça o primeiro login em Conectar Mercado Livre.');
    }

    const runtime = await launch(account, false);
    try {
      // Validate the persisted session before scraping. If Mercado Livre redirected
      // the restored context to authentication, never silently scrape the login page.
      await runtime.page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!(await isLoggedIn(runtime.page))) {
        await persistSession(account, runtime.context, 'EXPIRED');
        throw new Error('A sessão salva do Mercado Livre expirou. Reconecte pelo botão Conectar Mercado Livre.');
      }

      await runtime.page.goto(SEARCH_URL + encodeURIComponent(q), { waitUntil: 'domcontentloaded', timeout: 30000 });
      await runtime.page.waitForLoadState('networkidle').catch(() => undefined);
      if (!(await isLoggedIn(runtime.page))) {
        await persistSession(account, runtime.context, 'EXPIRED');
        throw new Error('O Mercado Livre perdeu a sessão durante a busca. Reconecte pelo botão Conectar Mercado Livre.');
      }

    // Mercado Livre renders search results progressively. Reading the DOM only once
    // captures the first 1-2 cards in many sessions. Scroll in controlled batches and
    // collect cards after each batch until we have enough distinct listings.
    const collectRows = async () => await runtime.page.locator('li, article').evaluateAll((els) =>
      els.map((el) => {
        const node = el as HTMLElement;
        const anchors = Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href]'));
        const productAnchor = anchors.find(a => /mercadolivre\.com\.br/i.test(a.href) && /\/MLB[-_]|\/p\/MLB/i.test(a.href));
        const image = node.querySelector<HTMLImageElement>('img');
        return {
          href: productAnchor?.href || '',
          text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
          image: image?.currentSrc || image?.src || '',
        };
      })
    ).catch(() => [] as Array<{href:string;text:string;image:string}>);

    const rowsByUrl = new Map<string, {href:string;text:string;image:string}>();
    const maxScrollRounds = Math.max(4, Number(process.env.ML_DISCOVERY_SCROLL_ROUNDS || 8));
    const scrollPauseMs = Math.max(500, Number(process.env.ML_DISCOVERY_SCROLL_PAUSE_MS || 1200));
    let stableRounds = 0;

    for (let round = 0; round < maxScrollRounds; round++) {
      for (const row of await collectRows()) {
        if (row.href) rowsByUrl.set(row.href, row);
      }
      const before = rowsByUrl.size;
      await runtime.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await runtime.page.waitForTimeout(scrollPauseMs);
      await runtime.page.waitForLoadState('networkidle').catch(() => undefined);
      for (const row of await collectRows()) {
        if (row.href) rowsByUrl.set(row.href, row);
      }
      if (rowsByUrl.size === before) stableRounds++;
      else stableRounds = 0;
      if (rowsByUrl.size >= Math.max(limit * 3, 20) && stableRounds >= 2) break;
    }

    const rows = [...rowsByUrl.values()];
    const seen = new Set<string>();
    const products: AffiliateProduct[] = [];

    for (const row of rows) {
      if (products.length >= limit) break;
      if (!row.href || !ML_HOST.test(new URL(row.href).hostname)) continue;
      if (!/\/MLB[-_]|\/p\/MLB/i.test(row.href)) continue;
      if (seen.has(row.href)) continue;

      const cardText = row.text;
      const discountMatch = cardText.match(/(\d{1,3})\s*%\s*(?:OFF|de\s*desconto|desconto)/i);
      if (!discountMatch) continue;

      // Prefer an explicit "De R$ X por R$ Y" / "R$ X R$ Y" pair.
      // We require the original price to be strictly greater than the current price.
      const prices = [...cardText.matchAll(/R\$\s*([0-9.]+(?:,[0-9]{2})?)/gi)]
        .map(m => Number(m[1].replace(/\./g, '').replace(',', '.')))
        .filter(Number.isFinite);

      if (prices.length < 2) continue;

      const currentPrice = Math.min(...prices);
      const originalCandidates = prices.filter(price => price > currentPrice);
      if (!originalCandidates.length) continue;

      const originalPrice = Math.max(...originalCandidates);
      const discount = Number(discountMatch[1]);
      const calculatedDiscount = Math.round((1 - currentPrice / originalPrice) * 100);

      // Reject inconsistent/stale card data instead of inventing a discount.
      if (currentPrice <= 0 || originalPrice <= currentPrice || discount <= 0) continue;
      if (Math.abs(calculatedDiscount - discount) > 3) continue;

      const title = cardText
        .replace(/R\$\s*[0-9.]+(?:,[0-9]{2})?/gi, '')
        .replace(/\d{1,3}\s*%\s*(?:OFF|de\s*desconto|desconto)/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || 'Produto Mercado Livre';

      const productIdMatch = row.href.match(/(?:\/p\/|\/)(MLB[-_][A-Za-z0-9_-]+)/i);
      const externalId = productIdMatch?.[1] || Buffer.from(row.href).toString('base64url').slice(0, 32);

      products.push({
        id: 'ml_auto_' + Buffer.from(row.href).toString('base64url').slice(0, 36),
        marketplace: 'MERCADOLIVRE',
        external_product_id: externalId,
        title,
        image: row.image,
        original_url: row.href,
        price: currentPrice,
        original_price: originalPrice,
        discount,
        metadata: {
          source: 'mercadolivre_browser_search',
          keyword: q,
          discount_verified: true,
          discount_calculated: calculatedDiscount,
        },
      });
      seen.add(row.href);
    }

      await persistSession(account, runtime.context, 'CONNECTED');
      return products;
    } finally {
      // Discovery is headless; do not leave Chromium running after each scan.
      try { await runtime.browser.close(); } catch {}
      runtimes.delete(account.id);
    }
  }

  static async disconnect(account: MarketplaceAccount) {
    const runtime = runtimes.get(account.id);
    if (runtime) await closeAndPersist(account, runtime);
    delete account.credentials_encrypted.ml_session_state;
    account.credentials_encrypted.ml_session_status = 'DISCONNECTED';
    account.credentials_encrypted.ml_session_updated_at = new Date().toISOString();
    account.status = 'AWAITING_CONFIG';
    account.status_message = 'Mercado Livre desconectado.';
    account.updated_at = new Date().toISOString();
  }
}
