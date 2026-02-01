import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitingService } from '../services/rateLimitingService';

describe('Rate Limiting Service Tests', () => {
    beforeEach(() => {
        RateLimitingService.clearAll();
    });

    it('should allow requests within the limit', () => {
        const key = 'test-action';
        const config = { maxAttempts: 3, windowMs: 1000 };

        expect(RateLimitingService.check(key, config).isAllowed).toBe(true);
        expect(RateLimitingService.check(key, config).isAllowed).toBe(true);
        expect(RateLimitingService.check(key, config).isAllowed).toBe(true);
    });

    it('should block requests exceeding the limit', () => {
        const key = 'test-block';
        const config = { maxAttempts: 2, windowMs: 1000 };

        RateLimitingService.check(key, config);
        RateLimitingService.check(key, config);

        const status = RateLimitingService.check(key, config);
        expect(status.isAllowed).toBe(false);
        expect(status.remaining).toBe(0);
        expect(status.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should reset limits after the time window expires', () => {
        vi.useFakeTimers();
        const key = 'test-expiry';
        const config = { maxAttempts: 1, windowMs: 1000 };

        RateLimitingService.check(key, config);
        expect(RateLimitingService.check(key, config).isAllowed).toBe(false);

        vi.advanceTimersByTime(1100);

        expect(RateLimitingService.check(key, config).isAllowed).toBe(true);
        vi.useRealTimers();
    });

    it('should maintain independent limits for different keys', () => {
        const config = { maxAttempts: 1, windowMs: 1000 };

        expect(RateLimitingService.check('user-1', config).isAllowed).toBe(true);
        expect(RateLimitingService.check('user-1', config).isAllowed).toBe(false);

        expect(RateLimitingService.check('user-2', config).isAllowed).toBe(true);
    });

    it('should correctly handle weighted increments', () => {
        const key = 'weighted';
        const config = { maxAttempts: 10, windowMs: 1000 };

        RateLimitingService.increment(key, 5, config);
        const status = RateLimitingService.getStatus(key, config);
        expect(status.remaining).toBe(5);

        RateLimitingService.increment(key, 6, config);
        expect(RateLimitingService.getStatus(key, config).isAllowed).toBe(false);
    });
});
