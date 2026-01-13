import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const filesToObfuscate = [
    'main.js',
    'cli.js',
    'factory-reset.js',
    'services/databaseService.js',
    'services/cloudSyncMain.js'
];

const options = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexesType: ['hexadecimal-number'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

async function obfuscateFiles() {
    console.log('[Security] Starting obfuscation for critical backend files...');

    for (const file of filesToObfuscate) {
        const filePath = path.join(rootDir, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`[Security] skipping ${file} - not found`);
            continue;
        }

        try {
            const code = fs.readFileSync(filePath, 'utf8');
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, options);

            const distPath = path.join(rootDir, 'dist_electron_obfuscated', file);
            const distDir = path.dirname(distPath);

            if (!fs.existsSync(distDir)) {
                fs.mkdirSync(distDir, { recursive: true });
            }

            fs.writeFileSync(distPath, obfuscationResult.getObfuscatedCode(), 'utf8');
            console.log(`[Security] Obfuscated: ${file}`);
        } catch (e) {
            console.error(`[Security] Failed to obfuscate ${file}:`, e.message);
        }
    }

    // Preload.cjs
    try {
        const preloadPath = path.join(rootDir, 'preload.cjs');
        if (fs.existsSync(preloadPath)) {
            const code = fs.readFileSync(preloadPath, 'utf8');
            const result = JavaScriptObfuscator.obfuscate(code, { ...options, stringArray: false }); // Less aggressive for preload
            const distPath = path.join(rootDir, 'dist_electron_obfuscated', 'preload.cjs');
            fs.writeFileSync(distPath, result.getObfuscatedCode(), 'utf8');
            console.log(`[Security] Obfuscated: preload.cjs`);
        }
    } catch (e) {
        console.error(`[Security] Failed to obfuscate preload.cjs:`, e.message);
    }

    console.log('[Security] Obfuscation complete. Files ready in dist_electron_obfuscated');
}

obfuscateFiles();
