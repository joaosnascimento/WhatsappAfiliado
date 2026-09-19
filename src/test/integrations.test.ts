import { ShopeeSignatureService } from '../../integrations/shopee/ShopeeSignatureService.ts';
import { MercadoLivreAffiliateService } from '../../integrations/mercadolivre/MercadoLivreAffiliateService.ts';
import { DeduplicationService } from '../services/DeduplicationService.ts';
import { AiMessageService } from '../services/AiMessageService.ts';
import type { AffiliateProduct } from '../types/affiliate.ts';

export function runTests(): { total: number; passed: number; failed: number; results: Array<{ name: string; success: boolean; error?: string }> } {
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  function assert(name: string, condition: boolean, errorMsg?: string) {
    if (condition) {
      results.push({ name, success: true });
    } else {
      results.push({ name, success: false, error: errorMsg || 'Assertion failed' });
    }
  }

  // Test 1: Shopee SHA-256 Signature calculation consistency
  try {
    const testAppId = '123456';
    const testSecret = 'secret_shopee_key_999';
    const testTimestamp = 1710000000;
    const testPayload = '{"query":"query test { productOfferV2 { nodes { itemId } } }"}';

    const sig1 = ShopeeSignatureService.calculateSignature({
      appId: testAppId,
      secret: testSecret,
      timestamp: testTimestamp,
      payload: testPayload,
    });

    const sig2 = ShopeeSignatureService.calculateSignature({
      appId: testAppId,
      secret: testSecret,
      timestamp: testTimestamp,
      payload: testPayload,
    });

    assert('Shopee Signature: Deterministic and 64-character Hex', sig1 === sig2 && sig1.length === 64);

    const isValid = ShopeeSignatureService.validateSignature(
      { appId: testAppId, secret: testSecret, timestamp: testTimestamp, payload: testPayload },
      sig1
    );
    assert('Shopee Signature: Timing-safe validation passes', isValid === true);

    const headers = ShopeeSignatureService.buildAuthHeaders({
      appId: testAppId,
      secret: testSecret,
      timestamp: testTimestamp,
      payload: testPayload,
    });
    assert(
      'Shopee Signature: Authorization Header Format complies with Shopee Open API',
      headers.Authorization.startsWith(`SHA256 Credential=${testAppId}, Timestamp=${testTimestamp}, Signature=`)
    );
  } catch (err) {
    assert('Shopee Signature Exception', false, (err as Error).message);
  }

  // Test 2: Mercado Livre Affiliate Link Validation Rules
  try {
    const originalUrl = 'https://www.mercadolivre.com.br/produto/p/MLB123456';
    const ordinaryUrl = 'https://www.mercadolivre.com.br/produto/p/MLB123456';
    const officialMeliLa = 'https://meli.la/3abcXYZ';
    const officialTracked = 'https://www.mercadolivre.com.br/produto/p/MLB123456?matt_tool=99120&tracking_id=aff123';
    const fakeDomain = 'https://phishing-meli.com/fake';

    // Must reject ordinary URL pretending to be affiliate link
    const resOrdinary = MercadoLivreAffiliateService.validateAffiliateUrl(ordinaryUrl, originalUrl);
    assert('Mercado Livre Security: Rejects ordinary URL as affiliate link', resOrdinary.isValidAffiliateLink === false);

    // Must accept official meli.la shortlink
    const resMeli = MercadoLivreAffiliateService.validateAffiliateUrl(officialMeliLa, originalUrl);
    assert('Mercado Livre Security: Accepts official meli.la shortlink', resMeli.isValidAffiliateLink === true);

    // Must accept official tracked URL with matt_tool / tracking_id
    const resTracked = MercadoLivreAffiliateService.validateAffiliateUrl(officialTracked, originalUrl);
    assert('Mercado Livre Security: Accepts tracked affiliate URL', resTracked.isValidAffiliateLink === true);

    // Must reject external / fake domain
    const resFake = MercadoLivreAffiliateService.validateAffiliateUrl(fakeDomain, originalUrl);
    assert('Mercado Livre Security: Rejects untrusted domain', resFake.isValidAffiliateLink === false);
  } catch (err) {
    assert('Mercado Livre Link Validation Exception', false, (err as Error).message);
  }

  // Test 3: Deduplication Service
  try {
    const destId = 'dest_whatsapp_group_1';
    const productId = '998877';
    const shopId = '1001';

    DeduplicationService.recordPublication('pub_001', 'SHOPEE', productId, destId, shopId, Date.now());

    const checkImmediate = DeduplicationService.isDuplicate('SHOPEE', productId, destId, shopId, 24);
    assert('Deduplication: Identifies duplicate within 24h window', checkImmediate.isDuplicate === true);

    const checkDifferentDest = DeduplicationService.isDuplicate('SHOPEE', productId, 'dest_other', shopId, 24);
    assert('Deduplication: Allows publication to different destination', checkDifferentDest.isDuplicate === false);

    const checkDifferentProduct = DeduplicationService.isDuplicate('SHOPEE', 'different_id', destId, shopId, 24);
    assert('Deduplication: Allows different product in same destination', checkDifferentProduct.isDuplicate === false);
  } catch (err) {
    assert('Deduplication Exception', false, (err as Error).message);
  }

  // Test 4: AI Message Service - Fact Enforcement
  try {
    const sampleProduct: AffiliateProduct = {
      id: 'test_prod_1',
      marketplace: 'SHOPEE',
      external_product_id: '123',
      title: 'Fone Bluetooth TWS Gamer Baixa Latência',
      image: 'https://example.com/img.jpg',
      original_url: 'https://shopee.com.br/product/1/123',
      price: 89.9,
      original_price: 129.9,
      discount: 30,
    };

    const deterministicMsg = AiMessageService.buildDeterministicMessage({
      product: sampleProduct,
      marketplace: 'SHOPEE',
      affiliateUrl: 'https://s.shopee.com.br/test1234',
      couponCode: 'GAMER10',
    });

    assert('AI Message: Contains verified price', deterministicMsg.includes('R$ 89,90'));
    assert('AI Message: Contains verified original price strikeout', deterministicMsg.includes('R$ 129,90'));
    assert('AI Message: Contains verified coupon code', deterministicMsg.includes('GAMER10'));
    assert('AI Message: Contains affiliate URL', deterministicMsg.includes('https://s.shopee.com.br/test1234'));
  } catch (err) {
    assert('AI Message Generation Exception', false, (err as Error).message);
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
