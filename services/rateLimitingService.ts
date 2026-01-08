/**
 * Rate limiting service for protecting against brute force and DoS attacks
 * Implements sliding window counter with configurable limits
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Max attempts within window
  keyPrefix?: string; // Prefix for storage keys to isolate different limits
}

export interface RateLimitStatus {
  isAllowed: boolean; // Whether action is allowed
  remaining: number; // Remaining attempts in current window
  resetTime: number; // When the limit resets (timestamp)
  retryAfterSeconds: number; // Seconds until next attempt allowed
}

export class RateLimitingService {
  private static readonly DEFAULT_WINDOW_MS = 60000; // 1 minute
  private static readonly DEFAULT_MAX_ATTEMPTS = 5;
  
  private static inMemoryStorage = new Map<string, { count: number; windowStart: number; windowEnd: number }>();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Check if an action is allowed under rate limit
   * @param key Unique identifier for rate limit (e.g., "login:user@example.com", "pin:recovery")
   * @param config Rate limit configuration
   * @returns RateLimitStatus indicating if action is allowed
   */
  static check(key: string, config: Partial<RateLimitConfig> = {}): RateLimitStatus {
    const windowMs = config.windowMs ?? this.DEFAULT_WINDOW_MS;
    const maxAttempts = config.maxAttempts ?? this.DEFAULT_MAX_ATTEMPTS;
    const storageKey = `${config.keyPrefix || ''}${key}`;

    const now = Date.now();
    let data = this.inMemoryStorage.get(storageKey);

    if (!data || now > data.windowEnd) {
      data = {
        count: 1,
        windowStart: now,
        windowEnd: now + windowMs,
      };
      this.inMemoryStorage.set(storageKey, data);

      return {
        isAllowed: true,
        remaining: maxAttempts - 1,
        resetTime: data.windowEnd,
        retryAfterSeconds: 0,
      };
    }

    if (data.count < maxAttempts) {
      data.count++;
      this.inMemoryStorage.set(storageKey, data);

      return {
        isAllowed: true,
        remaining: maxAttempts - data.count,
        resetTime: data.windowEnd,
        retryAfterSeconds: 0,
      };
    } else {
      // Rate limit exceeded
      const retryAfterMs = data.windowEnd - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      return {
        isAllowed: false,
        remaining: 0,
        resetTime: data.windowEnd,
        retryAfterSeconds,
      };
    }
  }

  /**
   * Reset rate limit for a specific key (e.g., after successful auth)
   * @param key Unique identifier for rate limit
   * @param keyPrefix Optional prefix used in check()
   * @returns true if reset successful
   */
  static reset(key: string, keyPrefix?: string): boolean {
    const storageKey = `${keyPrefix || ''}${key}`;
    this.inMemoryStorage.delete(storageKey);
    return true;
  }

  /**
   * Increment attempts by a specific amount (for weighted penalties)
   * @param key Unique identifier
   * @param amount Number of attempts to add
   * @param config Rate limit configuration
   * @returns Updated remaining attempts
   */
  static increment(key: string, amount: number = 1, config: Partial<RateLimitConfig> = {}): number {
    const windowMs = config.windowMs ?? this.DEFAULT_WINDOW_MS;
    const maxAttempts = config.maxAttempts ?? this.DEFAULT_MAX_ATTEMPTS;
    const storageKey = `${config.keyPrefix || ''}${key}`;

    const now = Date.now();
    let data = this.inMemoryStorage.get(storageKey);

    if (!data || now > data.windowEnd) {
      data = {
        count: amount,
        windowStart: now,
        windowEnd: now + windowMs,
      };
    } else {
      data.count = Math.min(data.count + amount, maxAttempts);
    }

    this.inMemoryStorage.set(storageKey, data);
    return Math.max(0, maxAttempts - data.count);
  }

  /**
   * Get current status without incrementing
   * @param key Unique identifier
   * @param config Rate limit configuration
   * @returns Current RateLimitStatus
   */
  static getStatus(key: string, config: Partial<RateLimitConfig> = {}): RateLimitStatus {
    const maxAttempts = config.maxAttempts ?? this.DEFAULT_MAX_ATTEMPTS;
    const storageKey = `${config.keyPrefix || ''}${key}`;

    const now = Date.now();
    const data = this.inMemoryStorage.get(storageKey);

    if (!data || now > data.windowEnd) {
      return {
        isAllowed: true,
        remaining: maxAttempts,
        resetTime: now + (config.windowMs ?? this.DEFAULT_WINDOW_MS),
        retryAfterSeconds: 0,
      };
    }

    const remaining = Math.max(0, maxAttempts - data.count);
    const retryAfterMs = data.windowEnd - now;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return {
      isAllowed: data.count < maxAttempts,
      remaining,
      resetTime: data.windowEnd,
      retryAfterSeconds: data.count >= maxAttempts ? retryAfterSeconds : 0,
    };
  }

  /**
   * Clean up expired rate limit entries from localStorage
   * Should be called periodically (e.g., on app startup)
   * @returns Number of entries cleaned up
   */
  static cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, data] of this.inMemoryStorage.entries()) {
      if (now > data.windowEnd) {
        this.inMemoryStorage.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clear all rate limit data (use carefully)
   * @returns true if successful
   */
  static clearAll(): boolean {
    this.inMemoryStorage.clear();
    return true;
  }

  static startAutoCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  static stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Pre-configured rate limiters for common authentication scenarios
 */
export const RateLimiters = {
  // Master key attempts: 5 attempts per 15 minutes
  masterKeyChange: {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
    keyPrefix: 'master_key_change:',
  },

  // PIN verification: 10 attempts per 30 minutes
  pinVerification: {
    windowMs: 30 * 60 * 1000,
    maxAttempts: 10,
    keyPrefix: 'pin_verify:',
  },

  // 2FA disable: 3 attempts per 1 hour
  twoFactorDisable: {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 3,
    keyPrefix: '2fa_disable:',
  },

  // Recovery words: 3 attempts per 24 hours
  recoveryVerification: {
    windowMs: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    keyPrefix: 'recovery_verify:',
  },

  // Login attempts: 5 attempts per 5 minutes
  login: {
    windowMs: 5 * 60 * 1000,
    maxAttempts: 5,
    keyPrefix: 'login:',
  },
};
