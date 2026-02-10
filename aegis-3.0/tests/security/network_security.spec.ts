import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Network Security Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeAll(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-net-'));
        electronApp = await electron.launch({
            args: [
                path.join(__dirname, '../../'),
                `--user-data-dir=${userDataPath}`
            ],
            env: { ...process.env, NODE_ENV: 'test' }
        });
        window = await electronApp.firstWindow();
    });

    test.afterAll(async () => {
        if (electronApp) await electronApp.close();
        try { fs.rmSync(userDataPath, { recursive: true, force: true }); } catch (e) { }
    });

    test('Content Security Policy (CSP) Check', async () => {
        const response = await window.goto('about:blank'); // Force a reload or just check current
        await window.goto('file:///' + path.join(__dirname, '../../dist/index.html').replace(/\\/g, '/'));

        // Check if CSP is present in meta tags or headers
        const csp = await window.evaluate(() => {
            const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            return meta ? meta.getAttribute('content') : null;
        });

        expect(csp).not.toBeNull();
        console.log('CSP found:', csp);

        // Verify restrictive CSP
        expect(csp).toContain("default-src 'self'");
        expect(csp).not.toContain("unsafe-inline"); // Ideally, but Aegis might use it for some styles
    });

    test('External Protocol Protection', async () => {
        // Test that clicking an external link doesn't navigate the main window
        await window.evaluate(() => {
            const link = document.createElement('a');
            link.href = 'https://google.com';
            link.id = 'trigger-nav';
            document.body.appendChild(link);
            link.click();
        });

        await window.waitForTimeout(500);
        const url = window.url();
        expect(url).not.toContain('google.com');
    });

    test('Node Integration check in Renderer', async () => {
        const nodeAvailable = await window.evaluate(() => {
            return typeof (process as any) !== 'undefined' && (process as any).versions && (process as any).versions.node;
        });
        expect(nodeAvailable).toBeFalsy();
    });

    test('P2P Network Status Leak Check', async () => {
        const status = await window.evaluate(async () => {
            try {
                return await (window as any).aegis.p2p.getStatus();
            } catch (e) {
                return null;
            }
        });

        if (status) {
            // Ensure sensitive info like real IP or private keys aren't leaked in status
            expect(status.privateKey).toBeUndefined();
            expect(status.secret).toBeUndefined();
        }
    });

    test('Fetch/XHR restricts to allowed domains', async () => {
        const fetchCheck = await window.evaluate(async () => {
            try {
                await fetch('https://evil.com');
                return 'success';
            } catch (e) {
                return 'blocked';
            }
        });
        // In a strict CSP environment, this should be blocked unless evil.com is whitelisted
        expect(fetchCheck).toBe('blocked');
    });
});
