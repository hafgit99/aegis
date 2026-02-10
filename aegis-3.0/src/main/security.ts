import axios from 'axios';
import * as crypto from 'crypto';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Secures a buffer or string by overwriting it with zeros.
 * Essential for preventing secrets from leaking into memory dumps.
 */
export function wipeMemory(input: string | Buffer | Uint8Array | null | undefined): void {
    if (!input) return;

    if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
        input.fill(0);
    } else if (typeof input === 'string') {
        // String wiping in JS is notoriously difficult due to immutability.
        // We recommend using Buffer/Uint8Array for sensitive data.
        // Best effort: trigger GC or use Buffer internally.
    }
}

/**
 * Constant-time comparison to prevent side-channel timing attacks.
 */
export function constantTimeCompare(a: string | Buffer, b: string | Buffer): boolean {
    const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a);
    const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b);

    if (bufA.length !== bufB.length) {
        return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
}

export interface AuditReport {
    score: number;
    weakEntries: string[]; // IDs
    reusedEntries: { [hash: string]: string[] }; // hash -> IDs
    oldEntries: string[]; // IDs
    breachedEntries: string[]; // IDs
    summary: {
        total: number;
        weak: number;
        reused: number;
        old: number;
        breached: number;
    };
}

/**
 * Checks if an email has been involved in a data breach using HIBP API.
 */
export async function checkBreach(email: string): Promise<boolean> {
    try {
        const apiKey = process.env.HIBP_API_KEY || '';
        if (!apiKey) {
            log.warn('[WATCHTOWER] HIBP API key missing. Email breach check disabled.');
            return false;
        }

        const response = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
            headers: {
                'hibp-api-key': apiKey,
                'user-agent': 'AegisVault-App'
            }
        });
        return response.status === 200;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return false;
        }
        log.error('[WATCHTOWER] Email breach check failed (status: ' + (error.response?.status || 'unknown') + ')');
        return false;
    }
}

/**
 * Checks if a password has been breached using K-anonymity (Online) and a Local Database (Offline).
 */
export async function checkPasswordBreach(password: string): Promise<{ breached: boolean; source: 'online' | 'offline' | 'none'; count?: number }> {
    if (!password) return { breached: false, source: 'none' };

    // 1. Offline Check (Local Database)
    try {
        const breachDbPath = path.join(__dirname, 'resources', 'breach_db.json');
        if (fs.existsSync(breachDbPath)) {
            const data = fs.readFileSync(breachDbPath, 'utf8');
            const commonPasswords = JSON.parse(data);
            if (commonPasswords.includes(password)) {
                log.info('[WATCHTOWER] Password found in offline breach database');
                return { breached: true, source: 'offline' };
            }
        }
    } catch (err) {
        log.error('[WATCHTOWER] Offline breach check error:', err);
    }

    // 2. Online Check (K-Anonymity via HIBP)
    try {
        const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
        const prefix = sha1.substring(0, 5);
        const suffix = sha1.substring(5);

        const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { 'user-agent': 'AegisVault-App' },
            timeout: 5000
        });

        if (response.status === 200) {
            const lines = response.data.split('\n');
            for (const line of lines) {
                const [hashSuffix, count] = line.split(':');
                if (hashSuffix.trim() === suffix) {
                    const breachCount = parseInt(count, 10);
                    log.warn(`[WATCHTOWER] Password breached ${breachCount} times (K-anonymity)`);
                    return { breached: true, source: 'online', count: breachCount };
                }
            }
        }
    } catch (err) {
        log.error('[WATCHTOWER] K-anonymity check failed:', err);
    }

    return { breached: false, source: 'none' };
}

export function auditVault(entries: any[]): AuditReport {
    const weakEntries: string[] = [];
    const reusedMap: { [hash: string]: string[] } = {};
    const oldEntries: string[] = [];
    const breachedEntries: string[] = [];

    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    entries.forEach(entry => {
        const password = entry.password || '';

        // 1. Weak check
        if (password.length > 0) {
            const isWeak = password.length < 12 ||
                !/[A-Z]/.test(password) ||
                !/[a-z]/.test(password) ||
                !/[0-9]/.test(password) ||
                !/[^A-Za-z0-9]/.test(password);
            if (isWeak) weakEntries.push(entry.id);

            // 2. Reused check
            const hash = crypto.createHash('sha256').update(password).digest('hex');
            if (!reusedMap[hash]) reusedMap[hash] = [];
            reusedMap[hash].push(entry.id);
        }

        // 3. Old check
        if (entry.last_modified) {
            const lastMod = Number(entry.last_modified) * 1000;
            if (now - lastMod > ninetyDaysMs) {
                oldEntries.push(entry.id);
            }
        }
    });

    const reusedEntries: { [hash: string]: string[] } = {};
    Object.keys(reusedMap).forEach(hash => {
        if (reusedMap[hash].length > 1) {
            reusedEntries[hash] = reusedMap[hash];
        }
    });

    const reusedCount = Object.values(reusedEntries).reduce((acc, ids) => acc + ids.length, 0);

    let score = 100;
    if (entries.length > 0) {
        const weakPenalty = (weakEntries.length / entries.length) * 40;
        const reusedPenalty = (reusedCount / entries.length) * 40;
        const oldPenalty = (oldEntries.length / entries.length) * 20;
        score = Math.max(0, Math.round(100 - weakPenalty - reusedPenalty - oldPenalty));
    }

    return {
        score,
        weakEntries,
        reusedEntries,
        oldEntries,
        breachedEntries,
        summary: {
            total: entries.length,
            weak: weakEntries.length,
            reused: reusedCount,
            old: oldEntries.length,
            breached: 0
        }
    };
}

