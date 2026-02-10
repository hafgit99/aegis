import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

test.describe('Native Module Fuzzing Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeAll(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-fuzz-'));
        electronApp = await electron.launch({
            args: [
                path.join(__dirname, '../../'),
                `--user-data-dir=${userDataPath}`
            ],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        if (electronApp) await electronApp.close();
        try { fs.rmSync(userDataPath, { recursive: true, force: true }); } catch (e) { }
    });

    const fuzzIterations = 20;

    test('Fuzzing Argon2 Derivation', async () => {
        for (let i = 0; i < fuzzIterations; i++) {
            const randomPassword = crypto.randomBytes(Math.floor(Math.random() * 1024)).toString('hex');
            const randomSalt = crypto.randomBytes(Math.floor(Math.random() * 32)).toString('hex');

            // This call should either succeed or fail gracefully, but NOT crash the process
            try {
                // Use window.aegis instead of window.electron.invoke
                await window.evaluate(async (p) => {
                    try {
                        return await (window as any).aegis.vault.open(p);
                    } catch (e) {
                        return { error: true };
                    }
                }, randomPassword);
            } catch (e) {
                // Playwright might throw if the window closes due to crash
                expect(e.message).not.toContain('Target closed');
                expect(e.message).not.toContain('Crash');
            }
        }
    });

    test('Fuzzing AES Decrypt with Garbage', async () => {
        for (let i = 0; i < fuzzIterations; i++) {
            const garbageCipher = crypto.randomBytes(Math.floor(Math.random() * 2048)).toString('hex');
            const garbageKey = crypto.randomBytes(32).toString('hex');

            await window.evaluate(async ({ c, k }) => {
                try {
                    // PQC decrypt is exposed via window.aegis.crypto
                    return await (window as any).aegis.crypto.decryptPQC(c, k);
                } catch (e) {
                    return { error: true };
                }
            }, { c: garbageCipher, k: garbageKey });
        }
        // If we reach here, the app didn't crash
        expect(true).toBe(true);
    });

    test('Fuzzing PQC Encryption/Decryption', async () => {
        for (let i = 0; i < fuzzIterations; i++) {
            const randomPlaintext = crypto.randomBytes(Math.floor(Math.random() * 512)).toString('utf8');
            const invalidKey = crypto.randomBytes(1200).toString('hex'); // KYBER keys are specific sizes

            await window.evaluate(async ({ p, k }) => {
                try {
                    return await (window as any).aegis.crypto.encryptPQC(p, k);
                } catch (e) {
                    return { error: true };
                }
            }, { p: randomPlaintext, k: invalidKey });
        }
        expect(true).toBe(true);
    });

    test('Fuzzing Database Save with Large Inputs', async () => {
        const largeTitle = 'A'.repeat(1024 * 10);
        const largeData = crypto.randomBytes(1024 * 50).toString('hex');

        try {
            await window.evaluate(async ({ t, d }) => {
                try {
                    return await (window as any).aegis.database.save({
                        id: 'fuzz-test-id',
                        title: t,
                        data: d,
                        username: 'fuzzer'
                    });
                } catch (e) {
                    return { error: true };
                }
            }, { t: largeTitle, d: largeData });
        } catch (e) {
            expect(e.message).not.toContain('Target closed');
        }
    });
});
