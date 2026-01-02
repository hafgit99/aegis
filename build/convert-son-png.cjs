/**
 * Convert son.png to icon.ico for Windows taskbar and shortcuts
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertSonPngToIco() {
  try {
    const buildDir = path.dirname(__filename);
    const sonPngPath = path.join(buildDir, 'son.png');
    
    if (!fs.existsSync(sonPngPath)) {
      console.error('❌ Hata: son.png dosyası build klasöründe bulunamadı!');
      process.exit(1);
    }

    console.log('📝 son.png → PNG (çoklu boyutlar) → ICO dönüştürülüyor...\n');

    // 1. son.png'i oku
    const sourceImage = sharp(sonPngPath);
    
    // 2. ICO oluştur (çoklu boyutlar: 256, 128, 64, 32, 16)
    const sizes = [256, 128, 64, 32, 16];
    const buffers = await Promise.all(
      sizes.map(size =>
        sourceImage
          .clone()
          .resize(size, size, {
            fit: 'cover',
            position: 'center'
          })
          .png()
          .toBuffer()
      )
    );

    // ICO dosyası oluştur
    const icoData = createIcoFile(buffers, sizes);
    const icoPath = path.join(buildDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoData);
    console.log('✓ icon.ico oluşturuldu: 16, 32, 64, 128, 256 px boyutlarında');

    // 3. Verification - icon.png de güncelle
    await sourceImage
      .resize(256, 256, { fit: 'cover', position: 'center' })
      .png()
      .toFile(path.join(buildDir, 'icon.png'));
    console.log('✓ icon.png güncellendi: 256x256');

    console.log('\n✅ İkon dosyaları başarıyla güncellendi!');
    console.log('   - icon.ico (Windows executable & shortcuts)');
    console.log('   - icon.png (yedek)');
    
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
convertSonPngToIco();
