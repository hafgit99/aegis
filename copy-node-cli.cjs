const fs = require('fs');
const path = require('path');

console.log('[Build] Copying Node.js for CLI support...');

try {
  const nodePath = process.execPath;
  const distDir = path.join(__dirname, 'dist_out');
  const winUnpackedDir = path.join(distDir, 'win-unpacked');

  if (!fs.existsSync(winUnpackedDir)) {
    console.error('[Build] Error: win-unpacked directory not found');
    process.exit(1);
  }

  const targetNodePath = path.join(winUnpackedDir, 'node.exe');

  console.log(`[Build] Copying Node.js from ${nodePath} to ${targetNodePath}`);
  fs.copyFileSync(nodePath, targetNodePath);
  console.log('[Build] Node.js copied successfully to win-unpacked');
} catch (error) {
  console.error('[Build] Error copying Node.js:', error.message);
  process.exit(1);
}