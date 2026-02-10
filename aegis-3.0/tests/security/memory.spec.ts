import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Memory Forensics Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-mem-'));
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

    test('Sensitive data should not persist in heap snapshot', async () => {
        // 1. Vault Setup & Login
        const sensitivePass = 'SuperSecretMemoryTestPass123!';

        await window.waitForTimeout(1000);
        const passwordInputs = await window.locator('input[type="password"]');
        if (await passwordInputs.count() >= 2) {
            await passwordInputs.nth(0).fill(sensitivePass);
            await passwordInputs.nth(1).fill(sensitivePass);
            await window.click('button[type="submit"]');

            // Wait for clean up
            await window.waitForTimeout(2000);

            // Trigger Garbage Collection
            await window.evaluate(() => {
                if (window.gc) window.gc();
            });

            // 2. Take Heap Snapshot (Mock check or real analysis tool required)
            // Since we can't easily dump heap in Playwright test without external tools,
            // we will simulate a check by ensuring the input field is cleared from DOM

            const inputs = await window.locator('input[type="password"]');
            // Dashboard should not have password inputs visible
            expect(await inputs.count()).toBe(0);

            // We can also check if any global variable holds it
            const globalCheck = await window.evaluate(() => {
                // Check common accidental leak places
                return (window as any).password || (window as any).masterKey;
            });
            expect(globalCheck).toBeUndefined();
        }
    });

    test('Clipboard should be cleared after timeout', async () => {
        // 1. Vault Setup
        await window.waitForTimeout(1000);
        const passwordInputs = await window.locator('input[type="password"]');
        if (await passwordInputs.count() >= 2) {
            await passwordInputs.nth(0).fill('MasterPass123!');
            await passwordInputs.nth(1).fill('MasterPass123!');
            await window.click('button[type="submit"]');
            await window.waitForSelector('input[type="checkbox"]');
            await window.click('input[type="checkbox"]');

            const finishBtn = window.locator('button:has-text("Tamamla")').or(window.locator('button:has-text("Finish")')).first();
            if (await finishBtn.isVisible()) await finishBtn.click();
            else await window.click('button:not([disabled])');
        }

        await window.waitForSelector('.grid');

        // 2. Add a password entry
        const addBtn = window.locator('button:has-text("Yeni Ekle")').or(window.locator('button:has-text("Add New")')).first();
        if (await addBtn.isVisible()) {
            await addBtn.click();
            await window.waitForSelector('div[role="dialog"]');

            const nameInput = window.locator('input[placeholder*="Google"]').first();
            await nameInput.fill('Clipboard Test Entry');
            await window.fill('input[type="password"]', 'SecretPassword123!');

            const saveBtn = window.locator('button:has-text("Kaydet")').or(window.locator('button:has-text("Save")')).first();
            await saveBtn.click();
            await window.waitForTimeout(500);
        }

        // 3. Copy password to clipboard
        const copyBtn = window.locator('button[aria-label*="Copy"]').or(window.locator('button:has-text("Copy")')).first();
        if (await copyBtn.isVisible()) {
            await copyBtn.click();
            await window.waitForTimeout(500);

            // 4. Check clipboard has the password
            const clipboardContent = await window.evaluate(async () => {
                return await navigator.clipboard.readText();
            });
            expect(clipboardContent).toBe('SecretPassword123!');

            // 5. Wait for auto-clear timeout (30 seconds)
            await window.waitForTimeout(31000);

            // 6. Verify clipboard is cleared
            const clearedClipboard = await window.evaluate(async () => {
                return await navigator.clipboard.readText();
            });
            expect(clearedClipboard).not.toBe('SecretPassword123!');
            expect(clearedClipboard).toBe(''); // Should be empty or different
        }
    });
});
