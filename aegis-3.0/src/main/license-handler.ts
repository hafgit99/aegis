import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import log from 'electron-log';
import { getHardwareId } from './utils/hardware-id';

interface LicenseInfo {
    installDate: number;
    licenseKey?: string;
    isPremium: boolean;
}

const LICENSE_FILE = 'license.json';

// Embedded Public Key for license verification
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArAEt/pXsQ2qhMsxPshlO
hZMT0Hx8LYfmTRRnM79KYLKL+pPdFGTWhdOuBMzCO6IBwB8+S5wRi7SpN4o1DXpz
02XlvfdwxeiMnsWHxRWsAfuGoQOtwAEMBe6ACDyfOwtQFfaAJrpbh7lpdIBzm2Uj
TixybYRPm27B0zNUNbK8IxkI5/D9kvY1v4yzRkBhFHt3yRQPupGIZ3W8gzwi7jNQ
wO8A4NtU7OxDanvmO0JkVVuq4P2TcIFsOb7gvuREXnMgMVhCtwdyWI06Y8iUf3Ms
OeLT0I6QPRp3D6cMMMb1PTuMiWM1e9OAiMsP7zgMbivEb45ZShpkQUujyfryTeso
bQIDAQAB
-----END PUBLIC KEY-----`;

export function setupLicenseHandlers() {
    const userDataPath = app.getPath('userData');
    const licensePath = path.join(userDataPath, LICENSE_FILE);

    // Initialize license file if not exists
    if (!fs.existsSync(licensePath)) {
        const initialLicense: LicenseInfo = {
            installDate: Date.now(),
            isPremium: false
        };
        fs.writeFileSync(licensePath, JSON.stringify(initialLicense, null, 2), 'utf8');
        log.info('[LICENSE] Initialized license storage');
    }

    function getLicenseInfo(): LicenseInfo {
        try {
            if (fs.existsSync(licensePath)) {
                const info = JSON.parse(fs.readFileSync(licensePath, 'utf8'));

                // Re-verify existing license on load
                if (info.isPremium && info.licenseKey) {
                    if (!verifyLicenseKey(info.licenseKey)) {
                        log.warn('[LICENSE] Saved license failed verification, revoking premium');
                        info.isPremium = false;
                    }
                }
                return info;
            }
        } catch (e) {
            log.error('[LICENSE] Failed to read license file');
        }
        return { installDate: Date.now(), isPremium: false };
    }

    function saveLicenseInfo(info: LicenseInfo) {
        try {
            fs.writeFileSync(licensePath, JSON.stringify(info, null, 2), 'utf8');
        } catch (e) {
            log.error('[LICENSE] Failed to save license file');
        }
    }

    // Check license status
    ipcMain.handle('license:check', () => {
        const info = getLicenseInfo();
        const now = Date.now();
        const trialDuration = 3 * 24 * 60 * 60 * 1000; // 3 days
        const expirationDate = info.installDate + trialDuration;
        const daysLeft = Math.max(0, Math.ceil((expirationDate - now) / (24 * 60 * 60 * 1000)));
        const isExpired = !info.isPremium && now > expirationDate;

        return {
            isPremium: info.isPremium,
            installDate: info.installDate,
            trialDaysLeft: daysLeft,
            isExpired: isExpired,
            expirationDate: expirationDate
        };
    });

    // Activate license
    ipcMain.handle('license:activate', (_event, key: string) => {
        const info = getLicenseInfo();

        if (verifyLicenseKey(key)) {
            info.isPremium = true;
            info.licenseKey = key;
            saveLicenseInfo(info);
            log.info('[LICENSE] Premium activated successfully via digital signature');
            return { success: true };
        }

        log.warn('[LICENSE] Activation failed: Invalid digital signature');
        return { success: false, error: 'INVALID_LICENSE' };
    });
}

/**
 * Verifies a Base64-encoded RSA signature against the current Device ID
 */
function verifyLicenseKey(key: string): boolean {
    try {
        if (!key || key.length < 50) return false;

        const deviceId = getHardwareId().toUpperCase().trim();
        const verifier = crypto.createVerify('sha256');
        verifier.update(deviceId);

        return verifier.verify(PUBLIC_KEY, Buffer.from(key, 'base64'));
    } catch (error) {
        log.error('[LICENSE] Verification error:', error);
        return false;
    }
}
