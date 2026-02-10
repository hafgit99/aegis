import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { generatePassword } from './generator';
import { auditVault } from './security';

function askPassword(): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        // TTY-only: Masking password input
        let password = '';
        process.stdout.write('\x1b[36m[SECURITY]\x1b[0m Enter Master Password: ');

        // Use raw mode to capture characters without printing them
        const stdin = process.stdin;
        if (stdin.isTTY) {
            stdin.setRawMode(true);
        }

        const onData = (char: Buffer) => {
            const charStr = char.toString();
            switch (charStr) {
                case '\n':
                case '\r':
                case '\u0004': // End of transmission
                    stdin.removeListener('data', onData);
                    if (stdin.isTTY) stdin.setRawMode(false);
                    process.stdout.write('\n');
                    rl.close();
                    resolve(password);
                    break;
                case '\u0003': // Ctrl-C
                    stdin.removeListener('data', onData);
                    if (stdin.isTTY) stdin.setRawMode(false);
                    process.stdout.write('\nCancelled.\n');
                    process.exit(1);
                    break;
                case '\u0008':
                case '\x7f': // Backspace
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    break;
                default:
                    // Only mask if it's a printable character
                    if (charStr.length === 1 && charStr >= ' ' && charStr <= '~') {
                        password += charStr;
                        process.stdout.write('*');
                    }
                    break;
            }
        };

        stdin.on('data', onData);
    });
}

function getHardwareId(): string {
    const { execSync } = require('child_process');
    try {
        let id = '';
        if (process.platform === 'win32') {
            id = execSync('wmic csproduct get uuid').toString().split('\n')[1].trim();
        } else if (process.platform === 'darwin') {
            id = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID').toString().split('"')[3];
        } else {
            if (fs.existsSync('/etc/machine-id')) {
                id = fs.readFileSync('/etc/machine-id', 'utf8').trim();
            }
        }
        return crypto.createHash('sha256').update(id || 'fallback').digest('hex').substring(0, 16).toUpperCase();
    } catch (err) {
        return 'CLI-FALLBACK-ID';
    }
}

// This function will be called from index.ts if cli arguments are present
export async function handleCLI(args: string[], native: any) {
    const command = args[0] || '--help';
    const subCommand = args[1];

    if (command === '--help' || command === '-h') {
        showHelp();
        app.quit();
        return;
    }

    if (command === '--version' || command === '-v') {
        console.log(`Aegis Vault v${app.getVersion()}`);
        app.quit();
        return;
    }

    if (command === '--gen' || command === '-p') {
        const length = parseInt(subCommand) || 20;
        const pass = generatePassword({ length, numbers: true, symbols: true, uppercase: true });
        console.log(`Generated Password: ${pass}`);
        app.quit();
        return;
    }

    // Commands that need DB access
    console.log('\n--- AEGIS VAULT CLI ---');

    try {
        const dbPath = path.join(app.getPath('userData'), 'vault.db');
        if (!fs.existsSync(dbPath)) {
            console.error('Error: Vault database not found. Please create one in the app first.');
            app.quit();
            return;
        }

        const password = await askPassword();
        const salt = getHardwareId();
        const passwordHash = native.argon2Derive(password, salt);

        const success = native.dbOpen(dbPath, passwordHash);
        if (!success) {
            console.error('Error: Invalid master password.');
            app.quit();
            return;
        }

        switch (command) {
            case '--list':
            case '-l':
                await listEntries(native);
                break;

            case '--get':
            case '-g':
                if (!subCommand) {
                    console.error('Error: Please specify an entry title or ID.');
                } else {
                    await getEntry(subCommand, native);
                }
                break;

            case '--audit':
            case '-a':
                await runAudit(native);
                break;

            default:
                console.log('Unknown command. Use --help for available commands.');
                break;
        }
    } catch (error: any) {
        console.error('CLI Error:', error.message);
    } finally {
        // SECURITY: Ensure database is closed and memory is cleared
        const { CloudSyncService } = require('./sync-service');
        CloudSyncService.getInstance().clearSyncKey();
        native.dbClose();
        console.log('\x1b[32m[SECURITY]\x1b[0m Session closed. Database connection purged.');
    }

    console.log('-----------------------\n');
    app.quit();
}

function showHelp() {
    console.log('Available Commands:');
    console.log('  --list, -l            List all entries in the vault');
    console.log('  --get, -g <title>     Get details of a specific entry');
    console.log('  --gen, -p [length]    Generate a secure password (default 20)');
    console.log('  --audit, -a           Run a security audit on your vault');
    console.log('  --version, -v         Show version information');
    console.log('  --help, -h            Show this help message');
    console.log('\nExample: aegis-vault --cli --get "Google"');
}

async function listEntries(native: any) {
    try {
        const entries = native.dbGetAll();
        if (entries.length === 0) {
            console.log('No entries found in vault.');
            return;
        }

        console.log(`Found ${entries.length} entries:`);
        entries.forEach((e: any, i: number) => {
            console.log(`${i + 1}. [${e.type.toUpperCase()}] ${e.title} (${e.username || 'No username'})`);
        });
    } catch (err) {
        console.error('Failed to list entries. Is the vault open?');
    }
}

async function getEntry(query: string, native: any) {
    try {
        const entries = native.dbGetAll();
        const entry = entries.find((e: any) =>
            e.title.toLowerCase().includes(query.toLowerCase()) ||
            e.id === query
        );

        if (!entry) {
            console.log(`No entry matching "${query}" found.`);
            return;
        }

        let decodedData: any = {};
        try {
            const decodedBuffer = Buffer.from(entry.data, 'hex');
            decodedData = JSON.parse(decodedBuffer.toString());
        } catch (err) { }

        console.log(`Title:    ${entry.title}`);
        console.log(`Type:     ${entry.type.toUpperCase()}`);
        console.log(`User:     ${entry.username || 'N/A'}`);

        if (decodedData.password) console.log(`Password: ${decodedData.password}`);
        if (decodedData.website) console.log(`Website:  ${decodedData.website}`);
        if (decodedData.notes) console.log(`Notes:    ${decodedData.notes}`);
        if (decodedData.cardNumber) console.log(`Card #:   ${decodedData.cardNumber}`);

        console.log(`Category: ${entry.category}`);
        console.log(`Last Used: ${entry.lastUsed || 'Never'}`);
    } catch (err) {
        console.error('Failed to retrieve entry.');
    }
}

async function runAudit(native: any) {
    try {
        const rawEntries = native.dbGetAll();
        const entries = rawEntries.map((e: any) => {
            try {
                const decodedBuffer = Buffer.from(e.data, 'hex');
                const decodedData = JSON.parse(decodedBuffer.toString());
                return { ...e, ...decodedData };
            } catch (err) {
                return e;
            }
        });

        const report = auditVault(entries);
        console.log('Security Audit Report:');
        console.log(`  Overall Score: ${report.score}/100`);
        console.log(`  Total Entries: ${report.summary.total}`);
        console.log(`  Weak Passwords: ${report.summary.weak}`);
        console.log(`  Reused Passwords: ${report.summary.reused}`);
        console.log(`  Old Passwords: ${report.summary.old}`);

        if (report.weakEntries.length > 0) {
            console.log('\nWeak Entries (IDs):', report.weakEntries.join(', '));
        }
    } catch (err) {
        console.error('Audit failed.');
    }
}
