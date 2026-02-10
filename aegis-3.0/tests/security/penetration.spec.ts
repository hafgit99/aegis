import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Security Penetration Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-sec-'));
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

    test('XSS Injection Attempt in Entry Fields', async () => {
        // Vault Setup
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

        // Add Entry with XSS Payload
        const addBtn = window.locator('button:has-text("Yeni Ekle")').or(window.locator('button:has-text("Add New")')).first();
        await addBtn.click();
        await window.waitForSelector('div[role="dialog"]');

        const xssPayload = '<img src=x onerror=window.xssDetected=true>';

        const nameInput = window.locator('input[placeholder="Örn: Google"]').or(window.locator('input[placeholder="Ex: Google"]')).first();
        await nameInput.fill(xssPayload);
        await window.fill('input[type="password"]', 'pass');

        const saveBtn = window.locator('button:has-text("Kaydet")').or(window.locator('button:has-text("Save")')).first();
        await saveBtn.click();

        await expect(window.locator('div[role="dialog"]')).not.toBeVisible();

        // Check if payload executed
        const xssDetected = await window.evaluate(() => (window as any).xssDetected);
        expect(xssDetected).toBeUndefined();
        console.log('XSS Check: Passed (No execution detected)');

        // Check if text is displayed as text (not HTML)
        const entryCard = window.locator(`text=${xssPayload}`);
        // If it renders as HTML, the locator text might fail or succeed differently, 
        // but checking visibility of the raw string confirms it's escaped or safe.
        // Actually locator('text=...') searches for text content.
        await expect(entryCard).toBeVisible();
    });
});
