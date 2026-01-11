#!/usr/bin/env node

import { fileURLToPath, pathToFileURL } from 'url';
const __filename = fileURLToPath(import.meta.url);
import path from 'path';
const __dirname = path.dirname(__filename);
import fs from 'fs';
import { execSync } from 'child_process';
import readline from 'readline';
import crypto from 'crypto';
import { argon2id } from 'hash-wasm';

const isPackaged = !fs.existsSync(path.join(__dirname, 'services', 'databaseService.js'));
let databaseService;

let userDataPath;
if (isPackaged) {
    userDataPath = path.join(path.dirname(process.execPath), 'aegis-data');
} else {
    userDataPath = path.join(__dirname, 'aegis-data');
}

const dbPath = path.join(userDataPath, 'vault.db');
const metaPath = path.join(userDataPath, 'vault_meta.json');

// --- SECURE IO: GUI & TERMINAL ---
async function secureAsk(query) {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            try {
                const prompt = query.replace('🔑 ', '').replace(':', '');
                const cmd = `powershell -Command "$ErrorActionPreference = 'Stop'; [System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic') | Out-Null; $p = [Microsoft.VisualBasic.Interaction]::InputBox('${prompt}', 'Aegis Vault CLI'); if($p) { $bytes = [System.Text.Encoding]::UTF8.GetBytes($p); [Convert]::ToBase64String($bytes) } else { '' }"`;
                const resultB64 = execSync(cmd, { encoding: 'utf8', windowsHide: true }).trim();
                if (resultB64) {
                    resolve(Buffer.from(resultB64, 'base64').toString('utf8'));
                    return;
                }
            } catch (e) { }
        }
        process.stdout.write(query);
        const rl = readline.createInterface({ input: process.stdin });
        rl.on('line', (l) => { rl.close(); resolve(l); });
    });
}

function decryptData(ciphertext, key, iv, tag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// --- TOTP IMPLEMENTATION FOR 2FA ---
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(base32) {
    base32 = base32.toUpperCase().replace(/=+$/, '');
    let bits = 0, value = 0, index = 0;
    const output = Buffer.alloc(Math.floor((base32.length * 5) / 8));
    for (let i = 0; i < base32.length; i++) {
        const charValue = BASE32_ALPHABET.indexOf(base32[i]);
        if (charValue === -1) continue;
        value = (value << 5) | charValue;
        bits += 5;
        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return output;
}
function generateTOTP(key, counter) {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(0, 0);
    counterBuffer.writeUInt32BE(counter, 4);
    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    return (binary % 1000000).toString().padStart(6, '0');
}
async function verifyTOTP(secret, token) {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 30000);
    for (let i = -1; i <= 1; i++) {
        if (generateTOTP(key, counter + i) === token) return true;
    }
    return false;
}

async function main() {
    console.log('\n🛡️  Aegis Vault CLI (v2.0.1 - Hardened)');
    console.log('-------------------------------------');

    if (!fs.existsSync(dbPath)) {
        console.error('❌ Hata: Database dosyası bulunamadı!');
        process.exit(1);
    }

    const args = process.argv.slice(2);

    // Komut belirleme - "list get id" veya "get id" formatını destekle
    let command = args[0] || 'list';
    let subArgs = args.slice(1);

    // "list get <id>" formatını düzelt -> "get <id>" olarak işle
    if (command === 'list' && args[1] === 'get') {
        command = 'get';
        subArgs = args.slice(2);
    }

    // Yardım komutu
    if (command === 'help' || command === '-h' || command === '--help') {
        console.log('\n📖 Kullanım:');
        console.log('  cli.bat list              - Tüm kayıtları listele');
        console.log('  cli.bat get <id>          - Belirli bir kaydın ayrıntılarını göster');
        console.log('  cli.bat help              - Bu yardım mesajını göster');
        console.log('\nÖrnek:');
        console.log("  cli.bat get a1b2c3d4      - ID'si a1b2c3d4 ile başlayan kaydı göster");
        process.exit(0);
    }

    try {
        const dbServicePath = isPackaged
            ? path.join(path.dirname(process.execPath), 'resources', 'app.asar', 'services', 'databaseService.js')
            : path.join(__dirname, 'services', 'databaseService.js');
        const finalPath = fs.existsSync(dbServicePath) ? dbServicePath : path.join(__dirname, 'services', 'databaseService.js');
        const dbModule = await import(pathToFileURL(finalPath).href);
        databaseService = dbModule.databaseService;
    } catch (e) {
        console.error('❌ Hata: Database servisi yüklenemedi.');
        process.exit(1);
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const rawPassword = await secureAsk('🔑 Master Şifrenizi Girin: ');

    if (!rawPassword) {
        console.error('❌ Hata: Şifre girilmedi.');
        process.exit(1);
    }

    console.log('🔓 Kasa açılıyor...');

    try {
        const hash = await argon2id({
            password: rawPassword,
            salt: Buffer.from(meta.salt, 'base64'),
            iterations: meta.iterations || 20,
            memorySize: 65536,
            parallelism: 4,
            hashLength: 32,
            outputType: 'binary',
        });

        const masterKeyBuffer = Buffer.from(hash);
        const masterKeyHex = masterKeyBuffer.toString('hex');

        databaseService.init(userDataPath, masterKeyHex);
        databaseService.db.prepare('SELECT count(*) FROM config').get();

        // --- 2FA KONTROLÜ ---
        const twoFaConfigJson = databaseService.getConfig('aegis_2fa_config');
        if (twoFaConfigJson) {
            console.log('🛡️  İki Faktörlü Doğrulama Aktif');
            const configData = JSON.parse(twoFaConfigJson);
            const iv = Buffer.from(configData.iv, 'base64');
            const ciphertext = Buffer.from(configData.payload, 'base64');
            const tag = Buffer.from(configData.tag, 'base64');

            try {
                const decryptedConfigStr = decryptData(ciphertext, masterKeyBuffer, iv, tag);
                const config = JSON.parse(decryptedConfigStr);

                const code = await secureAsk('🔑 2FA Kodunu Girin (6 haneli): ');
                const isValid = await verifyTOTP(config.secret, code);

                if (!isValid) {
                    console.error('❌ Hata: Geçersiz 2FA kodu. Erişim reddedildi.');
                    process.exit(1);
                }
                console.log('✅ 2FA Doğrulandı!');
            } catch (err) {
                console.error('❌ Hata: 2FA çözme başarısız.');
                process.exit(1);
            }
        }

        if (command === 'list') {
            const entries = databaseService.getAllEntries();
            console.log(`\n✅ Giriş Başarılı! Toplam ${entries.length} kayıt listeleniyor:\n`);
            console.log('ID (Kısa) | Kategori | Favori');
            console.log('----------|----------|-------');
            for (const entry of entries) {
                console.log(`${entry.id.slice(0, 8)} | ${entry.category.padEnd(8)} | ${entry.is_favorite ? '⭐' : '  '}`);
            }
        } else if (command === 'get') {
            const id = subArgs[0];
            if (!id) {
                console.error('❌ Hata: Lütfen bir kayıt ID\'si belirtin.');
                console.error('   Örnek: cli.bat get a1b2c3d4');
            } else {
                const entries = databaseService.getAllEntries();
                const entry = entries.find(e => e.id.startsWith(id));
                if (!entry) {
                    console.error('❌ Hata: Kayıt bulunamadı.');
                } else {
                    const iv = Buffer.from(entry.iv, 'base64');
                    const tag = Buffer.from(entry.tag, 'base64');
                    const ciphertext = Buffer.from(entry.payload, 'base64');
                    const decryptedStr = decryptData(ciphertext, masterKeyBuffer, iv, tag);
                    const data = JSON.parse(decryptedStr);
                    console.log('\n📄 Kayıt Detayları:');
                    console.log('------------------');
                    console.log(`Başlık:   ${data.title}`);
                    console.log(`Kullanıcı:${data.username || 'Yok'}`);
                    console.log('------------------');
                    if (data.sensitive.password) console.log(`Şifre:    ${data.sensitive.password}`);
                    if (data.sensitive.url) console.log(`URL:      ${data.sensitive.url}`);
                }
            }
        }
        databaseService.close();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Kimlik Doğrulama Başarısız: Şifre yanlış.');
        process.exit(1);
    }
}
main();