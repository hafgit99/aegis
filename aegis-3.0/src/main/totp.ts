import * as crypto from 'crypto';
import * as https from 'https';
import log from 'electron-log';

/**
 * Base32 Alphabet (RFC 4648)
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

let timeOffset = 0;

/**
 * Syncs app time with world time using HTTP Date header
 */
export async function syncTime(): Promise<number> {
    return new Promise((resolve) => {
        try {
            const req = https.get('https://www.google.com', { timeout: 5000 }, (res) => {
                const dateStr = res.headers.date;
                if (dateStr) {
                    const serverTime = new Date(dateStr).getTime();
                    const now = Date.now();
                    timeOffset = serverTime - now;
                    log.info(`[TOTP] Time synced. Offset: ${timeOffset}ms`);
                    resolve(timeOffset);
                } else {
                    resolve(0);
                }
            });
            req.on('error', () => resolve(0));
            req.on('timeout', () => {
                req.destroy();
                resolve(0);
            });
        } catch (e) {
            resolve(0);
        }
    });
}

function getSyncedTimestamp(): number {
    return Date.now() + timeOffset;
}

/**
 * Decodes a Base32 string into a Buffer
 */
function decodeBase32(str: string): Buffer {
    str = str.toUpperCase().replace(/=+$/, '').replace(/0/g, 'O').replace(/1/g, 'L').replace(/8/g, 'B');
    if (!/^[A-Z2-7]*$/.test(str)) {
        throw new Error('Invalid Base32 characters');
    }

    let bits = 0;
    let value = 0;
    let index = 0;
    const output = Buffer.alloc(Math.ceil((str.length * 5) / 8));

    for (let i = 0; i < str.length; i++) {
        value = (value << 5) | ALPHABET.indexOf(str[i]);
        bits += 5;

        if (bits >= 8) {
            output[index++] = (value >> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return output;
}

/**
 * Generates a TOTP code for a given timestamp
 */
export function generateTOTP(
    secret: string,
    options: { algorithm?: string, digits?: number, period?: number, timestamp?: number } = {}
): string {
    const algorithm = options.algorithm || 'sha1';
    const digits = options.digits || 6;
    const period = options.period || 30;
    const timestamp = options.timestamp || getSyncedTimestamp();

    const secretBuffer = decodeBase32(secret);

    // Counter is number of periods since epoch
    const counter = BigInt(Math.floor(timestamp / 1000 / period));

    // Counter to 8-byte big-endian buffer
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(counter);

    const hmac = crypto.createHmac(algorithm, secretBuffer);
    hmac.update(counterBuffer);
    const hash = hmac.digest();

    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const binary = ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    let code = (binary % Math.pow(10, digits)).toString();
    while (code.length < digits) {
        code = '0' + code;
    }
    return code;
}

/**
 * Verifies a TOTP code with time drift window (default +/- 1 period)
 */
export function verifyTOTP(code: string, secret: string, window: number = 1): boolean {
    const now = getSyncedTimestamp();
    const period = 30000; // 30 seconds in ms

    for (let i = -window; i <= window; i++) {
        const testTimestamp = now + (i * period);
        const expected = generateTOTP(secret, { timestamp: testTimestamp });
        if (code === expected) return true;
    }
    return false;
}

/**
 * Generates a secure random Base32 secret for TOTP setup
 */
export function generateSecret(length: number = 32): string {
    const bytes = crypto.randomBytes(length);
    let secret = '';
    for (let i = 0; i < bytes.length; i++) {
        secret += ALPHABET[bytes[i] % 32];
    }
    return secret;
}

/**
 * Generates an otpauth:// URI for QR code generation
 */
export function generateOTPAuthURI(secret: string, accountName: string, issuer: string = 'AegisVault'): string {
    const encodedAccount = encodeURIComponent(accountName);
    const encodedIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates a set of one-time backup codes
 */
export function generateBackupCodes(count: number = 8, length: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(length / 2).toString('hex').toUpperCase();
        codes.push(code);
    }
    return codes;
}
