import { chromium, type Browser } from 'playwright';
import { assertSafeOutboundUrl } from '../security/outboundUrl.ts';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export class BrandedOfferImageService {
  static async render(imageUrl: string, title = 'Oferta') {
    const safeUrl = await assertSafeOutboundUrl(imageUrl);
    const browser = await getBrowser();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
    try {
      await page.setContent(`
        <html><body style="margin:0;background:#101418;">
          <div style="width:1080px;height:1080px;box-sizing:border-box;padding:52px;font-family:Arial,sans-serif;background:linear-gradient(145deg,#111820 0%,#202a35 55%,#0c1117 100%);color:#fff;">
            <div style="height:74px;display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:30px;font-weight:800;letter-spacing:1px;">WHATSAPPAFILIADO</div>
              <div style="background:#f5c400;color:#111;padding:12px 20px;border-radius:999px;font-size:22px;font-weight:800;">OFERTA</div>
            </div>
            <div style="height:790px;margin-top:26px;border-radius:34px;background:linear-gradient(180deg,#f7f8fa,#e9edf2);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);">
              <img src="${escapeHtml(safeUrl.toString())}" style="max-width:92%;max-height:92%;object-fit:contain;" />
            </div>
            <div style="height:82px;margin-top:24px;display:flex;align-items:center;overflow:hidden;">
              <div style="font-size:24px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title.slice(0,90))}</div>
            </div>
          </div>
        </body></html>
      `);
      await page.locator('img').waitFor({ state: 'visible', timeout: 12000 });
      await page.waitForTimeout(700);
      const naturalWidth = await page.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth);
      if (!naturalWidth) throw new Error('A imagem do produto não carregou.');
      const buffer = await page.screenshot({ type: 'jpeg', quality: 90 });
      return buffer.toString('base64');
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  static async shutdown() {
    if (!browserPromise) return;
    try { (await browserPromise).close(); } catch {}
    browserPromise = null;
  }
}
