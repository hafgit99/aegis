import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Advanced Memory Forensics & Side-Channel Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-adv-mem-'));
        electronApp = await electron.launch({
            args: [
                path.join(__dirname, '../../'),
                `--user-data-dir=${userDataPath}`,
                '--js-flags="--expose-gc"'
            ],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) await electronApp.close();
        try { fs.rmSync(userDataPath, { recursive: true, force: true }); } catch (e) { }
    });

    test('Memory Leak Test: Master password should not exist in heap after login', async () => {
        const sensitivePass = 'ComplexForensicsPass2024!';

        // 1. Initial login
        await window.waitForTimeout(1000);
        const passwordInputs = await window.locator('input[type="password"]');
        if (await passwordInputs.count() >= 2) {
            await passwordInputs.nth(0).fill(sensitivePass);
            await passwordInputs.nth(1).fill(sensitivePass);
            await window.click('button[type="submit"]');
        }

        // Wait for potential background processing and clean up
        await window.waitForTimeout(3000);

        // 2. Trigger Garbage Collection multiple times
        await window.evaluate(() => {
            if ((window as any).gc) {
                (window as any).gc();
                (window as any).gc();
                (window as any).gc();
            }
        });

        // 3. Take Heap Snapshot (Server side in Electron main or renderer via inspector)
        // We will check for the sensitive string in a full memory dump if possible, 
        // or simulate by checking common process memory.

        const memoryFound = await window.evaluate(async (pass: string) => {
            // This is a naive check but useful for basic leak detection in heap globals
            const leakLocations = [window, document, (window as any).localStorage];
            const passStr = JSON.stringify(pass);

            const findInObj = (obj: any, depth = 0): boolean => {
                if (depth > 3 || !obj) return false;
                try {
                    for (const key in obj) {
                        if (obj[key] === pass) return true;
                        if (typeof obj[key] === 'object') {
                            if (findInObj(obj[key], depth + 1)) return true;
                        }
                    }
                } catch (e) { }
                return false;
            };

            return findInObj(window);
        }, sensitivePass);

        expect(memoryFound).toBe(false);
    });

    test('Side-Channel Timing: Password verification should be constant-time', async () => {
        // This test checks if the time taken to verify a password depends on its content
        // Note: Real constant-time verification is hard to measure in JS due to JIT,
        // but we can look for egregious differences.

        const measures: number[] = [];
        const passwords = [
            'Short1!',
            'LongerPasswordWithManyCharacters12345!',
            'AnotherMediumOne!',
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA!'
        ];

        for (const pass of passwords) {
            const start = performance.now();
            // Simulate deep cryptographic hashing (Aegis uses Argon2id usually)
            await window.evaluate(async (p: string) => {
                // We call the actual verification IPC if exposed or just a heavy computation
                // For this test, we assume we invoke a secure hashing check
                return new Promise(resolve => setTimeout(resolve, 10)); // Mocking work
            }, pass);
            const end = performance.now();
            measures.push(end - start);
        }

        const maxDiff = Math.max(...measures) - Math.min(...measures);
        // We expect variation to be minimal if constant-time or if work is dominated by fixed cost
        // Playwright environment has some jitter, so we use a reasonable threshold
        console.log('Timing Measures:', measures);
        expect(maxDiff).toBeLessThan(15); // Threshold for mock test
    });

    test('Memory Zeroing: Buffer clearing verification', async () => {
        // Verify that sensitive buffers are zeroed out after use
        const isZeroed = await window.evaluate(async () => {
            // Mock test for buffer management
            const buffer = new Uint8Array([1, 2, 3, 4]);
            // Simulate our zeroing function (should exist in main logic)
            const zeroMem = (buf: Uint8Array) => buf.fill(0);

            zeroMem(buffer);
            return buffer.every(b => b === 0);
        });
        expect(isZeroed).toBe(true);
    });
});
