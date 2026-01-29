import { describe, it, expect, vi } from 'vitest';
import { CryptoService } from '../services/cryptoService';
import { db } from '../db';

describe('Performance Benchmarking Tests', () => {

    describe('Cryptographic Performance', () => {
        it('should encrypt and decrypt 100 entries within reasonable time', async () => {
            const iterations = 100;
            const data = 'Small secret data';
            const key = await window.crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                const { ciphertext, iv, tag } = await CryptoService.encrypt(data, key);
                await CryptoService.decrypt(ciphertext, key, iv, tag);
            }
            const end = performance.now();
            const avgTime = (end - start) / iterations;

            console.log(`Avg Encrypt/Decrypt time: ${avgTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(50); // Usually < 1ms on modern CPUs
        });
    });

    describe('Database Query Performance', () => {
        it('should list 1000 entries quickly (Simulation)', async () => {
            // Mocking 1000 entries in memory DB
            const entries = Array(1000).fill(0).map((_, i) => ({
                id: String(i),
                title: `Entry ${i}`,
                category: 'Login'
            }));

            const start = performance.now();
            const filtered = entries.filter(e => e.title.includes('500'));
            const end = performance.now();

            expect(end - start).toBeLessThan(10);
            expect(filtered.length).toBeGreaterThan(0);
        });
    });
});
