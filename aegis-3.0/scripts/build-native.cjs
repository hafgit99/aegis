const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

console.log(`🔨 Building native module for ${process.platform}...`);

// Environment variables
const env = { ...process.env };
if (isWin) {
    // Add Strawberry Perl and default Cargo bin path to PATH if they exist
    const perlPath = 'C:\\Strawberry\\perl\\bin;C:\\Strawberry\\c\\bin';
    const cargoPath = path.join(process.env.USERPROFILE || '', '.cargo', 'bin');

    // Combine paths, ensuring we don't duplicate or lose existing PATH
    const extraPaths = [perlPath, cargoPath].filter(p => p).join(';');
    env.PATH = `${extraPaths};${env.PATH || ''}`;
    env.OPENSSL_NO_ASM = '1';
}

try {
    // 1. Build using cargo
    console.log('📦 Running cargo build...');
    execSync('cargo build --release', {
        cwd: path.join(__dirname, '../native'),
        env,
        stdio: 'inherit'
    });

    // 2. Identify the built artifact
    let artifactName;
    if (isWin) artifactName = 'aegis_native.dll';
    else if (isMac) artifactName = 'libaegis_native.dylib';
    else if (isLinux) artifactName = 'libaegis_native.so';

    const sourcePath = path.join(__dirname, '../native/target/release', artifactName);
    const destPath = path.join(__dirname, '../index.node');

    // 3. Copy the artifact to index.node
    console.log(`🚚 Copying ${artifactName} to index.node...`);
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log('✅ Native module built and copied successfully.');
    } else {
        // Try without 'lib' prefix for unix if it failed
        const altArtifactName = artifactName.startsWith('lib') ? artifactName.substring(3) : 'lib' + artifactName;
        const altSourcePath = path.join(__dirname, '../native/target/release', altArtifactName);

        if (fs.existsSync(altSourcePath)) {
            fs.copyFileSync(altSourcePath, destPath);
            console.log('✅ Native module built and copied successfully (using alternate name).');
        } else {
            console.error(`❌ Could not find built artifact at ${sourcePath}`);
            process.exit(1);
        }
    }
} catch (error) {
    console.error('❌ Failed to build native module:', error.message);
    process.exit(1);
}
