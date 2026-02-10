import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('E2E Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        // Create a temp directory for userData to ensure clean state
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-e2e-'));
        console.log('Test User Data:', userDataPath);

        electronApp = await electron.launch({
            args: [
                path.join(__dirname, '../../'),
                `--user-data-dir=${userDataPath}`
            ],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });

        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterEach(async () => {
        if (electronApp) {
            await electronApp.close();
        }
        // Cleanup temp dir
        try {
            fs.rmSync(userDataPath, { recursive: true, force: true });
        } catch (e) {
            console.error('Failed to cleanup temp dir:', e);
        }
    });

    test('Fresh Install: Create Vault -> Add Entry -> Search', async () => {
        await window.waitForTimeout(2000);

        // --- Vault Creation ---
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

        // --- Dashboard Check ---
        await window.waitForSelector('.grid', { timeout: 15000 });

        // --- Add Entry ---
        const addBtn = window.locator('button:has-text("Yeni Ekle")').or(window.locator('button:has-text("Add New")')).first();
        if (await addBtn.isVisible()) {
            await addBtn.click();
            await window.waitForSelector('div[role="dialog"]');

            const nameInput = window.locator('input[placeholder*="Google"]').first();
            await nameInput.fill('Searchable Entry');
            await window.fill('input[type="password"]', 'pass');

            const saveBtn = window.locator('button:has-text("Kaydet")').or(window.locator('button:has-text("Save")')).first();
            await saveBtn.click();
            await window.waitForTimeout(500);
        }

        // --- Search Test ---
        const searchInput = window.locator('input[placeholder*="Ara"]').or(window.locator('input[placeholder*="Search"]')).first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('Searchable');
            await window.waitForTimeout(500);
            const result = window.locator('text=Searchable Entry');
            await expect(result).toBeVisible();

            await searchInput.fill('NonExistent');
            await window.waitForTimeout(500);
            await expect(result).not.toBeVisible();
        }
    });
});
