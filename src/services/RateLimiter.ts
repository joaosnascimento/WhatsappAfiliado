import type { MarketplaceType } from '../types/affiliate.ts';

export interface RateLimiterOptions {
  tokensPerSecond: number;
  burstLimit: number;
}

export class RateLimiter {
  private static limiters: Map<MarketplaceType, { tokens: number; lastRefill: number; config: RateLimiterOptions }> = new Map([
    ['SHOPEE', { tokens: 5, lastRefill: Date.now(), config: { tokensPerSecond: 5, burstLimit: 10 } }],
    ['MERCADOLIVRE', { tokens: 10, lastRefill: Date.now(), config: { tokensPerSecond: 10, burstLimit: 20 } }],
  ]);

  /**
   * Waits for a token before allowing request to proceed
   */
  public static async acquire(marketplace: MarketplaceType): Promise<void> {
    const limiter = this.limiters.get(marketplace);
    if (!limiter) return;

    const now = Date.now();
    const elapsedSeconds = (now - limiter.lastRefill) / 1000;
    limiter.tokens = Math.min(
      limiter.config.burstLimit,
      limiter.tokens + elapsedSeconds * limiter.config.tokensPerSecond
    );
    limiter.lastRefill = now;

    if (limiter.tokens >= 1) {
      limiter.tokens -= 1;
      return;
    }

    // Must wait for token replenishment
    const waitTimeMs = ((1 - limiter.tokens) / limiter.config.tokensPerSecond) * 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitTimeMs)));
    limiter.tokens = 0;
    limiter.lastRefill = Date.now();
  }
}
