import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-a11y-'));
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

    test('Dashboard should have no critical a11y violations', async () => {
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

        // Accessiblity Scan
        const accessibilityScanResults = await new AxeBuilder({ page: window }).analyze();

        // Log breaches
        if (accessibilityScanResults.violations.length > 0) {
            console.log('A11y Violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
        }

        expect(accessibilityScanResults.violations).toEqual([]);
    });
});
