import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Performance Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-perf-'));
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

    test('Vault Creation Time (PQC + Argon2id)', async () => {
        await window.waitForTimeout(1000); // warm up

        // Go to Create Vault
        const passwordInputs = await window.locator('input[type="password"]');
        if (await passwordInputs.count() >= 2) {
            await passwordInputs.nth(0).fill('MasterPass123!');
            await passwordInputs.nth(1).fill('MasterPass123!');

            const start = Date.now();
            await window.click('button[type="submit"]');

            // Wait for next screen (Mnemonic)
            await window.waitForSelector('input[type="checkbox"]');
            const end = Date.now();

            const duration = end - start;
            console.log(`Vault Creation Time: ${duration}ms`);

            // Expect it to be reasonable (e.g. < 5000ms for heavy crypto)
            expect(duration).toBeLessThan(5000);
        }
    });

    test('Entry Addition Performance', async () => {
        // Setup Vault
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

        // Measure Adding 5 Entries
        const start = Date.now();
        for (let i = 0; i < 5; i++) {
            const addBtn = window.locator('button:has-text("Yeni Ekle")').or(window.locator('button:has-text("Add New")')).first();
            await addBtn.click();

            await window.waitForSelector('div[role="dialog"]');

            const nameInput = window.locator('input[placeholder="Örn: Google"]').or(window.locator('input[placeholder="Ex: Google"]')).first();
            await nameInput.fill(`Perf Test ${i}`);
            await window.fill('input[type="password"]', 'pass');

            const saveBtn = window.locator('button:has-text("Kaydet")').or(window.locator('button:has-text("Save")')).first();
            await saveBtn.click();

            // Wait for dialog to close
            await expect(window.locator('div[role="dialog"]')).not.toBeVisible();
        }
        const end = Date.now();
        const duration = end - start;
        console.log(`Add 5 Entries Time: ${duration}ms`);
        // Avg 1s per entry (UI + DB + Anim)
        expect(duration).toBeLessThan(10000);
    });
});
