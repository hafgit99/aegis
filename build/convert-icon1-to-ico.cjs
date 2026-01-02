/**
 * Convert icon1.png to icon.ico for Windows taskbar and shortcuts
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertIcon1AoIco() {
    try {
        const buildDir = path.dirname(__filename);
        const sourcePath = path.join(buildDir, 'icon1.png');

        if (!fs.existsSync(sourcePath)) {
            console.error('❌ Hata: icon1.png dosyası build klasöründe bulunamadı!');
            process.exit(1);
        }

        console.log('📝 icon1.png → PNG (çoklu boyutlar) → ICO dönüştürülüyor...\n');

        // 1. icon1.png'i oku
        const sourceImage = sharp(sourcePath);

        // 2. ICO için her boyutu ayrı ayrı, agresif trim ile oluştur
        // Bu, logonun icon dosyasının içinde olabildiğince büyük görünmesini sağlar.
        const icoSizes = [256, 128, 64, 48, 32, 16];
        const icoBuffers = await Promise.all(
            icoSizes.map(async (size) => {
                return await sharp(sourcePath)
                    .trim({ threshold: 12 }) // Kenarlardaki yarı-şeffaf gürültüleri temizle
                    .resize(size, size, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 },
                        kernel: sharp.kernel.lanczos3
                    })
                    .png()
                    .toBuffer();
            })
        );

        // ICO dosyası oluştur
        const icoData = createIcoFile(icoBuffers, icoSizes);
        const icoPath = path.join(buildDir, 'icon.ico');

        // Eski dosyayı sil (bazı sistemlerde üzerine yazma sorun çıkarabilir)
        if (fs.existsSync(icoPath)) fs.unlinkSync(icoPath);

        fs.writeFileSync(icoPath, icoData);
        console.log('✓ icon.ico oluşturuldu: 16-256 px boyutlarında (Agresif dolgu uygulandı)');

        // 3. icon.png'i (linux/mac/fallback) 512x512 ile güncelle
        await sharp(sourcePath)
            .trim({ threshold: 12 })
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toFile(path.join(buildDir, 'icon.png'));
        console.log('✓ icon.png güncellendi: 512x512');

        console.log('\n✅ İkon dosyaları başarıyla güncellendi!');
        console.log('   - icon.ico (Windows executable & shortcuts)');
        console.log('   - icon.png (linux/mac fallback)');

    } catch (error) {
        console.error('❌ Hata:', error.message);
        process.exit(1);
    }
}

/**
 * PNG buffer'larından ICO dosyası oluştur
 */
function createIcoFile(pngBuffers, sizes) {
    // ICO header: reserved (2 bytes) + type (2 bytes) + count (2 bytes)
    const header = Buffer.alloc(6);
    header.writeUInt8(0, 0);
    header.writeUInt8(0, 1);
    header.writeUInt8(1, 2);
    header.writeUInt8(0, 3);
    header.writeUInt16LE(pngBuffers.length, 4);

    // Her PNG için directory entry oluştur
    const dirSize = pngBuffers.length * 16;
    const entries = [];
    let dataOffset = 6 + dirSize;

    for (let i = 0; i < pngBuffers.length; i++) {
        const size = sizes[i];
        const entry = Buffer.alloc(16);

        // ICO formatında 256 boyut 0 olarak yazılır
        entry.writeUInt8(size === 256 ? 0 : size, 0); // width
        entry.writeUInt8(size === 256 ? 0 : size, 1); // height
        entry.writeUInt8(0, 2);    // palette colors (0 = no palette)
        entry.writeUInt8(0, 3);    // reserved
        entry.writeUInt16LE(1, 4); // color planes
        entry.writeUInt16LE(32, 6); // bits per pixel
        entry.writeUInt32LE(pngBuffers[i].length, 8); // size
        entry.writeUInt32LE(dataOffset, 12); // offset

        entries.push(entry);
        dataOffset += pngBuffers[i].length;
    }

    // Tüm parçaları birleştir
    return Buffer.concat([header, ...entries, ...pngBuffers]);
}

// Çalıştır
convertIcon1AoIco();
