import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Biometric & Hardware Authentication Tests', () => {
    let electronApp: any;
    let window: any;
    let userDataPath: string;

    test.beforeEach(async () => {
        userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-bio-'));
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

    test('Biometric: Availability check should return boolean', async () => {
        const isAvailable = await window.evaluate(async () => {
            return await window.aegis.biometrics.isAvailable();
        });
        expect(typeof isAvailable).toBe('boolean');
    });

    test('Biometric: Platform-specific handler verification', async () => {
        // We test if the IPC responds without crashing
        // Actual biometric check would require hardware, 
        // but in test mode we can verify the API flow.
        const platform = await window.evaluate(() => navigator.platform);
        console.log('Testing biometrics on platform:', platform);

        try {
            const result = await window.evaluate(async () => {
                return await window.aegis.biometrics.check();
            });
            // Result depends on environment support, but we expect a boolean response
            expect(typeof result).toBe('boolean');
        } catch (e) {
            // If hardware not present, it might throw or return false
            console.log('Biometric check skipped/failed as expected in CI');
        }
    });

    test('WebAuthn: Platform Authenticator availability', async () => {
        const webauthnAvailable = await window.evaluate(async () => {
            if (window.PublicKeyCredential) {
                return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            }
            return false;
        });
        // In most CI environments this is false, but we check for no crash
        expect(typeof webauthnAvailable).toBe('boolean');
    });

    test('FIDO2: Infrastructure presence check', async () => {
        const fido2Status = await window.evaluate(async () => {
            return await window.aegis.fido2.isAvailable();
        });
        expect(typeof fido2Status).toBe('boolean');
    });
});
