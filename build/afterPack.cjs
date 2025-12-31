const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  try {
    const appDir = context.appOutDir;
    
    // Gereksiz locales'i kaldır - Electron locales doğrudan win-unpacked'da
    const localesPath = path.join(appDir, 'locales');
    if (fs.existsSync(localesPath)) {
      const keepLocales = ['en-US.pak', 'tr.pak'];
      const files = fs.readdirSync(localesPath);
      
      let deletedCount = 0;
      files.forEach(file => {
        if (!keepLocales.includes(file)) {
          const filePath = path.join(localesPath, file);
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch (err) {
            console.error(`Silinemedi: ${file} - ${err.message}`);
          }
        }
      });
      
      if (deletedCount > 0) {
        console.log(`✓ ${deletedCount} locale dosyası silindi`);
      }
    } else {
      console.log(`Locales klasörü bulunamadı: ${localesPath}`);
    }
  } catch (error) {
    console.error('AfterPack hook hatası:', error);
  }
};


