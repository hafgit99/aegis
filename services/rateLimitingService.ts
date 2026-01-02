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
  private static readonly STORAGE_PREFIX = 'rate_limit_';

  /**
   * Check if an action is allowed under rate limit
   * @param key Unique identifier for rate limit (e.g., "login:user@example.com", "pin:recovery")
   * @param config Rate limit configuration
   * @returns RateLimitStatus indicating if action is allowed
   */
  static check(key: string, config: Partial<RateLimitConfig> = {}): RateLimitStatus {
    const windowMs = config.windowMs ?? this.DEFAULT_WINDOW_MS;
    const maxAttempts = config.maxAttempts ?? this.DEFAULT_MAX_ATTEMPTS;
    const storageKey = `${this.STORAGE_PREFIX}${config.keyPrefix || ''}${key}`;

    const now = Date.now();
    let data = this.getAttemptData(storageKey);

    // Initialize if first attempt or window expired
    if (!data || now > data.windowEnd) {
      data = {
        count: 1,
        windowStart: now,
        windowEnd: now + windowMs,
      };
      this.setAttemptData(storageKey, data);

      return {
        isAllowed: true,
        remaining: maxAttempts - 1,
        resetTime: data.windowEnd,
        retryAfterSeconds: 0,
      };
    }

    // Window still active
    if (data.count < maxAttempts) {
      // Still within limit
      data.count++;
      this.setAttemptData(storageKey, data);

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
    const storageKey = `${this.STORAGE_PREFIX}${keyPrefix || ''}${key}`;
    try {
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.error(`Failed to reset rate limit for ${key}:`, error);
      return false;
    }
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
    const storageKey = `${this.STORAGE_PREFIX}${config.keyPrefix || ''}${key}`;

    const now = Date.now();
    let data = this.getAttemptData(storageKey);

    if (!data || now > data.windowEnd) {
      data = {
        count: amount,
        windowStart: now,
        windowEnd: now + windowMs,
      };
    } else {
      data.count = Math.min(data.count + amount, maxAttempts);
    }

    this.setAttemptData(storageKey, data);
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
    const storageKey = `${this.STORAGE_PREFIX}${config.keyPrefix || ''}${key}`;

    const now = Date.now();
    const data = this.getAttemptData(storageKey);

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
    const keysToRemove: string[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          const data = this.getAttemptData(key);
          if (data && now > data.windowEnd) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        cleaned++;
      });
    } catch (error) {
      console.error('Failed to cleanup rate limit entries:', error);
    }

    return cleaned;
  }

  /**
   * Clear all rate limit data (use carefully)
   * @returns true if successful
   */
  static clearAll(): boolean {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear rate limit data:', error);
      return false;
    }
  }

  // Private helper methods

  private static getAttemptData(key: string): { count: number; windowStart: number; windowEnd: number } | null {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Failed to parse rate limit data for ${key}:`, error);
      return null;
    }
  }

  private static setAttemptData(key: string, data: { count: number; windowStart: number; windowEnd: number }): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        console.error('localStorage quota exceeded for rate limiting');
      } else {
        console.error('Failed to store rate limit data:', error);
      }
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
