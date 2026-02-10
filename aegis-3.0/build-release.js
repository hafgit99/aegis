const builder = require('electron-builder');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function buildAndHash() {
    console.log('🔨 Building Aegis Vault 3.0...');

    // Build the application components first
    console.log('📦 Compiling frontend and backend...');
    try {
        execSync('npm run build', { stdio: 'inherit' });
    } catch (err) {
        console.error('❌ Compilation failed!');
        process.exit(1);
    }

    console.log('\n📦 Packaging application...\n');

    // Build the application
    await builder.build({
        targets: builder.Platform.WINDOWS.createTarget(['nsis', 'portable', 'zip'], builder.Arch.x64),
        publish: 'never', // Don't auto-publish to GitHub
        config: {
            // Config is read from package.json
        }
    });

    console.log('\n✅ Build completed!\n');
    console.log('📝 Generating SHA256SUMS.txt...\n');

    const releaseDir = path.join(__dirname, 'release');
    const files = fs.readdirSync(releaseDir).filter(f =>
        f.endsWith('.exe') || f.endsWith('.zip') || f.endsWith('.nsis.7z')
    );

    const checksums = [];

    for (const file of files) {
        const filePath = path.join(releaseDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');

        checksums.push(`${hex}  ${file}`);
        console.log(`✓ ${file}`);
        console.log(`  SHA256: ${hex}\n`);
    }

    // Write SHA256SUMS.txt
    const checksumsPath = path.join(releaseDir, 'SHA256SUMS.txt');
    fs.writeFileSync(checksumsPath, checksums.join('\n') + '\n');

    console.log(`\n✅ SHA256SUMS.txt created at: ${checksumsPath}`);
    console.log('\n🎉 Release package ready!\n');
    console.log('📦 Output files:');
    files.forEach(f => console.log(`   - ${f}`));
    console.log(`   - SHA256SUMS.txt\n`);
}

buildAndHash().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
