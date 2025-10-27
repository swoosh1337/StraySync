// Simple in-memory cache with TTL (Time To Live)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    if (__DEV__) {
      const age = Math.round((now - entry.timestamp) / 1000);
      console.log(`[Cache] Hit for "${key}" (age: ${age}s)`);
    }

    return entry.data;
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });

    if (__DEV__) {
      console.log(`[Cache] Set "${key}" (TTL: ${Math.round((ttl || this.defaultTTL) / 1000)}s)`);
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Invalidate (delete) a cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    if (__DEV__) {
      console.log(`[Cache] Invalidated "${key}"`);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    const matchingKeys = keys.filter(key => key.includes(pattern));
    
    matchingKeys.forEach(key => this.cache.delete(key));
    
    if (__DEV__) {
      console.log(`[Cache] Invalidated ${matchingKeys.length} entries matching "${pattern}"`);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    if (__DEV__) {
      console.log('[Cache] Cleared all entries');
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    return {
      total: entries.length,
      valid: entries.filter(([_, entry]) => now <= entry.expiresAt).length,
      expired: entries.filter(([_, entry]) => now > entry.expiresAt).length,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    entries.forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    });
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Cache keys constants
export const CACHE_KEYS = {
  ANIMALS_LIST: (filter: string) => `animals:list:${filter}`,
  ANIMAL_DETAIL: (id: string) => `animals:detail:${id}`,
  USER_ANIMALS: (userId: string) => `user:${userId}:animals`,
  USER_FAVORITES: (userId: string) => `user:${userId}:favorites`,
  USER_STATS: (userId: string) => `user:${userId}:stats`,
  COMMENTS: (animalId: string) => `comments:${animalId}`,
  COMMENT_COUNT: (animalId: string) => `comments:count:${animalId}`,
};

// Run cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 10 * 60 * 1000);
}
