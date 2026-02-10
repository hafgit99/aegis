import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Session Management Security Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-session-'));
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

    test.afterEach(async () => {
        if (electronApp) await electronApp.close();
        try { fs.rmSync(userDataPath, { recursive: true, force: true }); } catch (e) { }
    });

    test('Session Auto-Lock Verification', async () => {
        // 1. Setup Vault
        await window.waitForTimeout(1000);
        const passwordInputs = await window.locator('input[type="password"]');
        if (await passwordInputs.count() >= 2) {
            await passwordInputs.nth(0).fill('SessionTest123!');
            await passwordInputs.nth(1).fill('SessionTest123!');
            await window.click('button[type="submit"]');
            await window.waitForSelector('input[type="checkbox"]');
            await window.click('input[type="checkbox"]');
            const finishBtn = window.locator('button:has-text("Tamamla")').or(window.locator('button:has-text("Finish")')).first();
            await finishBtn.click();
        }

        await window.waitForSelector('.grid'); // Dashboard

        // 2. Simulate Inactivity / Auto-Lock Trigger
        // We can manually trigger the IPC for locking to see if it clears the session
        await window.evaluate(async () => {
            await (window as any).aegis.vault.close();
        });

        // 3. Verify that we are back to the auth screen
        await window.waitForSelector('input[type="password"]');

        // 4. Verify that dbIsOpen returns false
        const isOpen = await window.evaluate(async () => {
            return await (window as any).aegis.database.isOpen();
        });
        expect(isOpen).toBeFalsy();
    });

    test('Brute Force Protection (Lockout)', async () => {
        // Try wrong password multiple times
        for (let i = 0; i < 6; i++) {
            try {
                await window.evaluate(async () => {
                    await (window as any).aegis.vault.open('wrong-password-' + Math.random());
                });
            } catch (e) {
                // Expected failure
            }
        }

        // Check if lockout file exists in userData
        const lockoutFile = path.join(userDataPath, 'vault.lockout');
        expect(fs.existsSync(lockoutFile)).toBeTruthy();

        // Next attempt should return ACCOUNT_LOCKED
        const result = await window.evaluate(async () => {
            try {
                await (window as any).aegis.vault.open('any-password');
                return { success: true };
            } catch (e: any) {
                return { error: e.message };
            }
        });

        expect(result.error).toContain('ACCOUNT_LOCKED');
    });

    test('Session Data Wipe on Logout', async () => {
        // Trigger logout
        await window.evaluate(async () => {
            await (window as any).aegis.vault.close();
        });

        // Check if sensitive data is still accessible via IPC (it shouldn't be)
        const entries = await window.evaluate(async () => {
            try {
                return await (window as any).aegis.database.getAll();
            } catch (e) {
                return 'error';
            }
        });

        expect(entries).toBe('error');
    });

    test('Persistent Session Prevention', async () => {
        // Ensure that app start doesn't have an open vault by default
        const isOpen = await window.evaluate(async () => {
            return await (window as any).aegis.database.isOpen();
        });
        expect(isOpen).toBeFalsy();
    });
});
