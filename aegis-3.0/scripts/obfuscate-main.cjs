const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist/main');
const preloadDir = path.join(__dirname, '../dist/main/preload');

function obfuscateFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    console.log(`🔒 Obfuscating: ${path.relative(path.join(__dirname, '..'), filePath)}`);
    const code = fs.readFileSync(filePath, 'utf8');
    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: false, // Keep it off for main process performance
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false
    });

    fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode());
}

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.js')) {
            obfuscateFile(fullPath);
        }
    }
}

console.log('🛡️ Starting main process obfuscation...');
processDir(distDir);
console.log('✅ Main process obfuscation complete.');
