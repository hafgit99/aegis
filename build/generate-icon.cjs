/**
 * Icon Generator Script
 * BrandIcon SVG'sini PNG ve ICO formatlarına dönüştürür
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// BrandIcon SVG'si - Modern ve teknolojik güvenlik temalı
const brandIconSvg = `
<svg
  width="256"
  height="256"
  viewBox="0 0 200 200"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <defs>
    {/* Merkezi mavi parıltı */}
    <radialGradient id="core-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.6" />
      <stop offset="70%" stopColor="#1d4ed8" stopOpacity="0.3" />
      <stop offset="100%" stopColor="#1e40af" stopOpacity="0" />
    </radialGradient>

    {/* Cam efekti gradyanı */}
    <linearGradient id="glass-surface" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="white" stopOpacity="0.2" />
      <stop offset="50%" stopColor="white" stopOpacity="0.05" />
      <stop offset="100%" stopColor="white" stopOpacity="0.02" />
    </linearGradient>

    {/* Kalkan gövdesi gradyanı */}
    <linearGradient id="shield-body" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#0f172a" />
      <stop offset="100%" stopColor="#0c0f1a" />
    </linearGradient>

    {/* Güvenlik detayı gradyanı */}
    <linearGradient id="security-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#60a5fa" />
      <stop offset="100%" stopColor="#3b82f6" />
    </linearGradient>

    {/* Altın detay gradyanı */}
    <linearGradient id="gold-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#fbbf24" />
      <stop offset="100%" stopColor="#d97706" />
    </linearGradient>

    {/* Parıltı filtresi */}
    <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  {/* Arka plan parıltısı */}
  <circle cx="100" cy="100" r="90" fill="url(#core-glow)" />

  {/* Dış kalkan kontur */}
  <path
    d="M100 15C65 15 35 30 35 65C35 125 100 180 100 180C100 180 165 125 165 65C165 30 135 15 100 15Z"
    fill="none"
    stroke="url(#security-accent)"
    strokeWidth="2"
    strokeOpacity="0.3"
  />

  {/* Ana kalkan gövdesi */}
  <path
    d="M100 20C70 20 40 35 40 70C40 120 100 170 100 170C100 170 160 120 160 70C160 35 130 20 100 20Z"
    fill="url(#shield-body)"
    stroke="rgba(96, 165, 250, 0.1)"
    strokeWidth="1"
  />

  {/* Cam katmanı */}
  <path
    d="M100 35C80 35 55 45 55 75C55 110 100 150 100 150C100 150 145 110 145 75C145 45 120 35 100 35Z"
    fill="url(#glass-surface)"
    stroke="rgba(255, 255, 255, 0.1)"
    strokeWidth="1"
  />

  {/* Merkezdeki kilit sembolü */}
  <g filter="url(#glow-filter)">
    <rect x="92" y="65" width="16" height="35" rx="8" fill="url(#gold-accent)" />
    <circle cx="100" cy="108" r="8" fill="url(#security-accent)" />
  </g>

  {/* Çapraz güvenlik çizgileri */}
  <path
    d="M70 50L130 150"
    stroke="url(#security-accent)"
    strokeWidth="1.5"
    strokeOpacity="0.2"
    strokeLinecap="round"
  />
  <path
    d="M130 50L70 150"
    stroke="url(#security-accent)"
    strokeWidth="1.5"
    strokeOpacity="0.2"
    strokeLinecap="round"
  />

  {/* Üst ışık yansımaları */}
  <path
    d="M65 45C65 45 85 35 100 35C115 35 135 45 135 45"
    stroke="white"
    strokeOpacity="0.2"
    strokeWidth="1.5"
    strokeLinecap="round"
  />
</svg>
`;

async function generateIcon() {
  try {
    const buildDir = path.dirname(__filename);
    
    console.log('📝 BrandIcon SVG → PNG → ICO dönüştürülüyor...\n');

    // 1. PNG oluştur (256x256)
    await sharp(Buffer.from(brandIconSvg))
      .png()
      .toFile(path.join(buildDir, 'icon.png'));
    console.log('✓ PNG oluşturuldu: icon.png (256x256)');

    // 2. ICO oluştur (çoklu boyutlar: 256, 128, 64, 32, 16)
    const sizes = [256, 128, 64, 32, 16];
    const buffers = await Promise.all(
      sizes.map(size =>
        sharp(Buffer.from(brandIconSvg))
          .resize(size, size)
          .png()
          .toBuffer()
      )
    );

    // ICO dosyası için header oluştur
    const icoData = createIcoFile(buffers, sizes);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoData);
    console.log('✓ ICO oluşturuldu: icon.ico (16, 32, 64, 128, 256 px)');

    console.log('\n✅ Icon dosyaları başarıyla güncellendi!');
  } catch (error) {
    console.error('❌ Icon oluşturmada hata:', error.message);
    process.exit(1);
  }
}

/**
 * PNG buffer'larından ICO dosyası oluştur
 */
function createIcoFile(pngBuffers, sizes) {
  // ICO header: 2 byte (0, 0) + 2 byte type (1, 0) + 2 byte count
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
    entry.writeUInt8(0, 2);    // colors
    entry.writeUInt8(0, 3);    // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp (bits per pixel)
    entry.writeUInt32LE(pngBuffers[i].length, 8); // size
    entry.writeUInt32LE(dataOffset, 12); // offset

    entries.push(entry);
    dataOffset += pngBuffers[i].length;
  }

  // Tüm parçaları birleştir
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

// Çalıştır
generateIcon();
