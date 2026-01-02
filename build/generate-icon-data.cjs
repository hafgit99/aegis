/**
 * Generate icon-data.ts from son.png
 */
const fs = require('fs');
const path = require('path');

function generateIconData() {
  try {
    const buildDir = path.dirname(__filename);
    const sonPngPath = path.join(buildDir, 'son.png');

    if (!fs.existsSync(sonPngPath)) {
      console.error('❌ Hata: son.png dosyası build klasöründe bulunamadı!');
      process.exit(1);
    }

    // son.png dosyasını oku ve base64'e çevir
    const sonPngBuffer = fs.readFileSync(sonPngPath);
    const base64Data = sonPngBuffer.toString('base64');
    const iconBase64 = `data:image/png;base64,${base64Data}`;

    // icon-data.ts dosyasını oluştur
    const iconDataContent = `export const iconBase64 = '${iconBase64}';\n`;

    // components klasörüne yaz
    const componentsDir = path.join(path.dirname(buildDir), 'components');
    const iconDataPath = path.join(componentsDir, 'icon-data.ts');

    fs.writeFileSync(iconDataPath, iconDataContent);
    console.log('✓ icon-data.ts oluşturuldu:', iconDataPath);

    // src/assets klasörüne de kopyala (eski dosyanın üzerine yaz)
    const srcAssetsDir = path.join(path.dirname(path.dirname(buildDir)), 'src', 'assets');
    if (!fs.existsSync(srcAssetsDir)) {
      fs.mkdirSync(srcAssetsDir, { recursive: true });
    }
    const srcIconDataPath = path.join(srcAssetsDir, 'icon-data.ts');
    fs.writeFileSync(srcIconDataPath, iconDataContent);
    console.log('✓ src/assets/icon-data.ts güncellendi');

    console.log('\n✅ icon-data.ts dosyaları başarıyla güncellendi!');
  } catch (error) {
    console.error('❌ icon-data.ts oluşturmada hata:', error.message);
    process.exit(1);
  }
}

// Çalıştır
generateIconData();