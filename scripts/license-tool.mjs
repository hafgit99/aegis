import crypto from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const KEY_FILE = 'private_key.pem';
const PUBLIC_KEY_FILE = 'public_key.pem';

/**
 * Yeni bir ECDSA anahtar çifti oluşturur.
 */
function generateKeys() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    writeFileSync(KEY_FILE, privateKey);
    writeFileSync(PUBLIC_KEY_FILE, publicKey);
    console.log('✅ Yeni anahtar çifti oluşturuldu!');
    console.log('Public Key (Bunu LicensingService.ts içine yapıştırın):\n');
    console.log(publicKey);
}

/**
 * Belirli bir Device ID için lisans anahtarı üretir.
 */
function createLicense(deviceId) {
    try {
        // Parantezleri, boşlukları sil ve büyük harf yap
        const cleanId = deviceId.trim().replace(/[\[\]]/g, '').toUpperCase();
        const privateKey = readFileSync(KEY_FILE, 'utf8');

        const payload = JSON.stringify({
            deviceId: cleanId,
            type: 'premium',
            issuedAt: Date.now()
        });

        const payloadB64 = Buffer.from(payload).toString('base64');

        const signer = crypto.createSign('sha256');
        signer.update(payload);
        signer.end();

        const signature = signer.sign({
            key: privateKey,
            dsaEncoding: 'ieee-p1363'
        });
        const signatureB64 = signature.toString('base64');

        const licenseKey = `${payloadB64}.${signatureB64}`;

        console.log('\n💎 ÜRETİLEN PRO LİSANS ANAHTARI (Base64):\n');
        console.log(licenseKey);
        console.log('\n------------------------------------------------');
    } catch (error) {
        console.error('❌ Hata: private_key.pem bulunamadı. Önce anahtar üretin.');
    }
}

// Komut satırı argümanlarını kontrol et
const args = process.argv.slice(2);
if (args[0] === 'init') {
    generateKeys();
} else if (args[0] === 'gen' && args[1]) {
    createLicense(args[1]);
} else {
    console.log('Kullanım:');
    console.log('  node license-tool.mjs init          -> Yeni anahtarlar oluşturur');
    console.log('  node license-tool.mjs gen [DEVICE_ID] -> Lisans anahtarı üretir');
}
