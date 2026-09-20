import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { MarketplaceAccount, AffiliateProduct } from '../../src/types/affiliate.ts';
import { MercadoLivreAffiliateService } from './MercadoLivreAffiliateService.ts';

const PORTAL_URL = 'https://www.mercadolivre.com.br/afiliados/linkbuilder';
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
    const loginControls = page.getByRole('link', { name: /entrar|iniciar sessão/i });
    if (await loginControls.count()) {
      for (let i = 0; i < Math.min(3, await loginControls.count()); i++) {
        if (await loginControls.nth(i).isVisible().catch(() => false)) return false;
      }
    }
    const body = (await page.locator('body').innerText({ timeout: 5000 })).slice(0, 16000);
    if (/criar conta/i.test(body) && /entrar/i.test(body) && !/sair/i.test(body)) return false;
    return /sair|minha conta|afiliados|gerador de links|receitas|métricas/i.test(body);
  } catch { return false; }
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
    try { if (!existing.browser.isConnected()) throw new Error('browser disconnected'); return existing; } catch { runtimes.delete(account.id); }
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

  const body = await page.locator('body').innerText().catch(() => '');
  const match = body.match(/https:\/\/(?:www\.)?meli\.la\/[A-Za-z0-9_-]+/i);
  return match ? match[0] : null;
}

async function fillGenerator(page: Page, originalUrl: string) {
  const candidates = [
    page.getByPlaceholder(/insira a url|cole.*url|url/i).first(),
    page.locator('input[type="url"]').first(),
    page.locator('textarea').first(),
    page.locator('input').first(),
  ];
  let filled = false;
  for (const locator of candidates) {
    try {
      if (await locator.count()) { await locator.fill(originalUrl); filled = true; break; }
    } catch {}
  }
  if (!filled) throw new Error('O Gerador de Links do Mercado Livre mudou a interface e o campo de URL não foi localizado.');

  const buttons = [
    page.getByRole('button', { name: /gerar link|gerar/i }).first(),
    page.getByText(/gerar link/i).first(),
    page.locator('button[type="submit"]').first(),
  ];
  for (const button of buttons) {
    try {
      if (await button.count()) { await button.click(); return; }
    } catch {}
  }
  throw new Error('O botão Gerar Link não foi localizado no Portal de Afiliados.');
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
    }
    const saved = sessionFromAccount(account);
    if (!saved) return { connected: false, status: 'DISCONNECTED', browserActive: false };
    return {
      connected: account.credentials_encrypted.ml_session_status === 'CONNECTED',
      status: account.credentials_encrypted.ml_session_status || 'LOGIN_REQUIRED',
      browserActive: false,
      updatedAt: account.credentials_encrypted.ml_session_updated_at,
    };
  }

  static async connect(account: MarketplaceAccount) {
    const runtime = await launch(account, true);
    await runtime.page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded' });
    const logged = await isLoggedIn(runtime.page);
    if (!logged) {
      account.credentials_encrypted.ml_session_status = 'LOGIN_REQUIRED';
      account.status = 'AWAITING_CONFIG';
      account.status_message = 'Faça login no navegador Mercado Livre aberto pelo WhatsappAfiliado.';
      account.updated_at = new Date().toISOString();
      void waitForAuthentication(runtime.page).then(async (ok) => {
        if (ok) {
          await runtime.page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
          await persistSession(account, runtime.context, 'CONNECTED');
        }
      });
      return { connected: false, status: 'LOGIN_REQUIRED', message: 'Navegador aberto. Faça login no Mercado Livre; a sessão será capturada automaticamente.' };
    }
    await runtime.page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' });
    await persistSession(account, runtime.context, 'CONNECTED');
    return { connected: true, status: 'CONNECTED', message: 'Mercado Livre conectado e pronto para automação.' };
  }

  static async generateLink(account: MarketplaceAccount, originalUrl: string, labels?: string[]) {
    if (!/^https:\/\/(?:www\.)?mercadolivre\.com\.br\//i.test(originalUrl)) throw new Error('A URL precisa ser um anúncio do Mercado Livre Brasil.');
    if (/(^|\/)(busca|categorias|ofertas|home|cart|checkout)(\/|$)/i.test(new URL(originalUrl).pathname)) throw new Error('Somente páginas individuais de produto podem gerar link de afiliado.');

    let runtime = runtimes.get(account.id);
    if (!runtime) {
      runtime = await launch(account, false);
      await runtime.page.goto('https://www.mercadolivre.com.br/', { waitUntil: 'domcontentloaded' });
    }
    if (!(await isLoggedIn(runtime.page))) {
      await persistSession(account, runtime.context, 'EXPIRED');
      throw new Error('Sessão do Mercado Livre expirada. Clique em Conectar Mercado Livre e faça login novamente.');
    }

    await runtime.page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' });
    await runtime.page.waitForLoadState('networkidle').catch(() => undefined);
    await fillGenerator(runtime.page, originalUrl);

    if (labels?.length) {
      for (const label of labels.slice(0, 5)) {
        try {
          const labelControl = runtime.page.getByText(label, { exact: true }).first();
          if (await labelControl.count()) await labelControl.click();
        } catch {}
      }
    }

    await runtime.page.waitForTimeout(1200);
    const affiliateUrl = await findAffiliateLink(runtime.page);
    if (!affiliateUrl) throw new Error('O Mercado Livre não retornou um link meli.la. A sessão pode não ter permissão para o programa ou o gerador mudou a interface.');
    const validation = MercadoLivreAffiliateService.validateAffiliateUrl(affiliateUrl, originalUrl);
    if (!validation.isValidAffiliateLink) throw new Error(validation.reason || 'Link afiliado inválido.');
    await persistSession(account, runtime.context, 'CONNECTED');
    return affiliateUrl;
  }

  static async discover(account: MarketplaceAccount, keyword: string, limit = 10): Promise<AffiliateProduct[]> {
    const q = keyword.trim();
    if (!q) return [];
    const runtime = await launch(account, false);
    await runtime.page.goto(SEARCH_URL + encodeURIComponent(q), { waitUntil: 'domcontentloaded' });
    await runtime.page.waitForLoadState('networkidle').catch(() => undefined);

    const rows = await runtime.page.locator('a[href*="mercadolivre.com.br/"]').evaluateAll((els) =>
      els.map((el) => {
        const href = (el as HTMLAnchorElement).href;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const card = el.closest('li, article, div');
        const cardText = (card?.textContent || '').replace(/\s+/g, ' ').trim();
        return { href, text, cardText };
      })
    ).catch(() => [] as Array<{href:string;text:string;cardText:string}>);

    const seen = new Set<string>();
    const products: AffiliateProduct[] = [];
    for (const row of rows) {
      if (products.length >= limit) break;
      if (!ML_HOST.test(new URL(row.href).hostname)) continue;
      if (!/\/MLB[-_]|\/p\/MLB/i.test(row.href)) continue;
      if (seen.has(row.href)) continue;
      seen.add(row.href);
      const title = row.text || row.cardText.slice(0, 180) || 'Produto Mercado Livre';
      const priceMatch = row.cardText.match(/R\$\s*([0-9.]+(?:,[0-9]{2})?)/);
      const price = priceMatch ? Number(priceMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
      const productIdMatch = row.href.match(/(?:\/p\/|\/)(MLB[-_][A-Za-z0-9_-]+)/i);
      const externalId = productIdMatch?.[1] || Buffer.from(row.href).toString('base64url').slice(0, 32);
      products.push({
        id: 'ml_auto_' + Buffer.from(row.href).toString('base64url').slice(0, 36),
        marketplace: 'MERCADOLIVRE',
        external_product_id: externalId,
        title,
        image: '',
        original_url: row.href,
        price,
        metadata: { source: 'mercadolivre_browser_search', keyword: q },
      });
    }
    const priorStatus = account.credentials_encrypted.ml_session_status;
    if (priorStatus === 'CONNECTED') await persistSession(account, runtime.context, 'CONNECTED');
    return products;
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
