#!/usr/bin/env node

/**
 * FABRİKA AYARLARINA SIFIRLAMA ARACI
 * 
 * Bu araç tüm Aegis Vault verilerini (SQLite, IndexedDB, Configs) siler.
 * Yedeğiniz varsa bunu kullanın!
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

const appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : os.homedir());
const userDataPath = path.join(appData, 'Aegis Vault');

console.log('\n🗑️  AEGIS VAULT - FABRİKA SIFIRLAMA ARACI\n');
console.log('⚠️  DİKKAT: Bu işlem tüm şifrelerinizi ve ayarlarınızı silecektir!');
console.log('    Eğer yedeğiniz (.json veya .csv) yoksa DEVAM ETMEYİN.\n');

// Onay fonksiyonu
async function askConfirmation() {
    return new Promise((resolve) => {
        process.stdout.write('Onaylıyor musunuz? (evet/hayir): ');
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.once('data', (data) => {
            resolve(data.toString().trim().toLowerCase());
        });
    });
}

(async () => {
    const confirmation = await askConfirmation();

    if (confirmation !== 'evet') {
        console.log('\n❌ İşlem iptal edildi.\n');
        process.exit(0);
    }

    console.log('\n🔄 Temizlik başlıyor...');

    try {
        // Uygulamayı kapatmaya çalış (Windows)
        try {
            console.log('   Uygulama kapatılıyor...');
            execSync('taskkill /F /IM "Aegis Vault.exe" /T', { stdio: 'ignore' });
        } catch (e) {
            // Zaten kapalı olabilir
        }

        // Klasörü temizle
        if (fs.existsSync(userDataPath)) {
            console.log(`   Veri klasörü siliniyor: ${userDataPath}`);
            fs.rmSync(userDataPath, { recursive: true, force: true });
            console.log('✅ Veri klasörü başarıyla silindi.');
        } else {
            console.log('ℹ️  Veri klasörü zaten yok.');
        }

        console.log('\n✨ SIFIRLAMA TAMAMLANDI!\n');

        console.log('📋 YAPMANIZ GEREKENLER:');
        console.log('─────────────────────────────────────────────────────────');
        console.log('1. Aegis Vault uygulamasını açın');
        console.log('2. Yeni bir Master Şifre oluşturun (Setup ekranı gelecek)');
        console.log('3. Dashboard açıldığında "Import" (İçe Aktar) yapın');
        console.log('4. Yedeğinizi seçin');
        console.log('5. Import bittiğinde şifreleriniz görünecek');
        console.log('6. CLI\'ı test edin: node cli.js list\n');

        console.log('Bu temiz kurulum sayesinde tüm veritabanı hataları ve migration sorunları çözülecektir.\n');

    } catch (err) {
        console.error('\n❌ Hata oluştu:', err.message);
        console.log('Lütfen klasörü manuel silin:', userDataPath);
    }

    process.exit(0);
})();
