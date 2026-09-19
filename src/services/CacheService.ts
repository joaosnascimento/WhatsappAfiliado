interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private static store = new Map<string, CacheEntry<unknown>>();

  /**
   * Sets cached value with TTL in seconds
   */
  public static set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Gets cached value if not expired
   */
  public static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Invalidate specific key
   */
  public static invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate by prefix (e.g. "product_ml_")
   */
  public static invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }
}
