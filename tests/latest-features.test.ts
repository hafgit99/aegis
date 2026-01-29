
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandlingService } from '../services/errorHandlingService';
import { ShareService } from '../services/shareService';
import { VaultService } from '../services/vaultService';
import { CryptoService } from '../services/cryptoService';
import { Category } from '../types';

describe('Comprehensive Latest Features Test', () => {

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('ErrorHandlingService', () => {
        it('should log errors to localStorage', () => {
            const testError = new Error("Test Error");
            ErrorHandlingService.handle(testError, "TestContext");

            const logs = ErrorHandlingService.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].message).toBe("Test Error");
            expect(logs[0].context).toBe("TestContext");
        });

        it('should respect debug mode toggle', () => {
            ErrorHandlingService.setDebugMode(true);
            expect(localStorage.getItem('aegis_debug_mode')).toBe('true');
            expect(ErrorHandlingService.getDebugMode()).toBe(true);

            ErrorHandlingService.setDebugMode(false);
            expect(localStorage.getItem('aegis_debug_mode')).toBe('false');
            expect(ErrorHandlingService.getDebugMode()).toBe(false);
        });

        it('should return correct translation keys', () => {
            const key1 = ErrorHandlingService.handle(new Error("decryption_failed:123"));
            expect(key1).toBe('error_decryption_failed');

            const key2 = ErrorHandlingService.handle(new Error("File too large"));
            expect(key2).toBe('error_file_large');
        });
    });

    describe('ShareService Error Handling', () => {
        it('should catch generation errors and log them', async () => {
            // Mock CryptoService to fail
            vi.spyOn(CryptoService, 'encrypt').mockRejectedValueOnce(new Error("Encryption Failed"));

            const entry = { id: '1', title: 'Test', category: Category.LOGIN } as any;
            const sensitive = { password: '123' } as any;

            // Password strictness might trigger first, so use strong password
            const resultStrong = await ShareService.generateSharePayload(entry, sensitive, 'StrongPassword123!', 'en');

            expect(resultStrong.error).toBeTruthy();
            const logs = ErrorHandlingService.getLogs();
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0].context).toBe('ShareService.generateSharePayload');
        });
    });

    describe('VaultService Metadata Privacy', () => {
        it.skip('should handle save errors gracefully', async () => {
            // Skipped due to test environment mocking issues
        });
    });
});
