import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import log from 'electron-log';

const MANIFEST_NAME = 'com.aegis.vault';
const ALLOWED_ORIGINS_CHROME = [
    'chrome-extension://knldjmfmopnpolahpmmgbagdohdnhkik/',
    'chrome-extension://pjjmjgibliobepbjbghmipfpiljgogii/'
];
const ALLOWED_EXTENSIONS_FIREFOX = [
    'sales@hetech-me.space'
];

export function installNativeHost() {
    try {
        log.info('[NATIVE-HOST] Installing native messaging host...');

        // Determine correct paths based on environment (dev vs prod)
        let bridgePath: string;
        let basePath: string;

        if (app.isPackaged) {
            basePath = path.dirname(app.getPath('exe'));
            bridgePath = path.join(process.resourcesPath, 'native-host-bridge.cjs');
        } else {
            basePath = app.getAppPath();
            bridgePath = path.join(basePath, 'native-host-bridge.cjs');
        }

        // Paths for Chrome
        const chromeManifestPath = path.join(basePath, 'host_manifest.json');
        const chromeBatPath = path.join(basePath, 'host-chrome.bat');

        // Paths for Firefox
        const firefoxManifestPath = path.join(basePath, 'host_manifest_firefox.json');
        const firefoxBatPath = path.join(basePath, 'host-firefox.bat');

        // 1. Create/Update Chrome Batch File
        const chromeBatContent = `@echo off
SETLOCAL
SET BRIDGE_SCRIPT="${bridgePath}"

IF EXIST "%~dp0node.exe" (
    "%~dp0node.exe" %BRIDGE_SCRIPT%
) ELSE (
    node %BRIDGE_SCRIPT%
)
`;
        fs.writeFileSync(chromeBatPath, chromeBatContent);
        log.info('[NATIVE-HOST] Chrome batch file created at:', chromeBatPath);

        // 2. Create/Update Firefox Batch File
        const firefoxBatContent = `@echo off
SETLOCAL
SET BRIDGE_SCRIPT="${bridgePath}"

IF EXIST "%~dp0node.exe" (
    "%~dp0node.exe" %BRIDGE_SCRIPT%
) ELSE (
    node %BRIDGE_SCRIPT%
)
`;
        fs.writeFileSync(firefoxBatPath, firefoxBatContent);
        log.info('[NATIVE-HOST] Firefox batch file created at:', firefoxBatPath);

        // 3. Create/Update Chrome Manifest File
        const chromeManifest = {
            name: MANIFEST_NAME,
            description: 'Aegis Vault Native Messaging Host',
            path: chromeBatPath, // Absolute path required on Windows
            type: 'stdio',
            allowed_origins: ALLOWED_ORIGINS_CHROME
        };

        fs.writeFileSync(chromeManifestPath, JSON.stringify(chromeManifest, null, 4));
        log.info('[NATIVE-HOST] Chrome manifest file created at:', chromeManifestPath);

        // 4. Create/Update Firefox Manifest File
        const firefoxManifest = {
            name: MANIFEST_NAME,
            description: 'Aegis Vault Native Messaging Host',
            path: firefoxBatPath, // Absolute path required on Windows
            type: 'stdio',
            allowed_extensions: ALLOWED_EXTENSIONS_FIREFOX
        };

        fs.writeFileSync(firefoxManifestPath, JSON.stringify(firefoxManifest, null, 4));
        log.info('[NATIVE-HOST] Firefox manifest file created at:', firefoxManifestPath);

        // 5. Register in Windows Registry
        if (process.platform === 'win32') {
            const regKeys = [
                { key: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${MANIFEST_NAME}`, manifest: chromeManifestPath },
                { key: `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${MANIFEST_NAME}`, manifest: firefoxManifestPath }
            ];

            regKeys.forEach(({ key, manifest }) => {
                const command = `reg add "${key}" /ve /t REG_SZ /d "${manifest}" /f`;
                exec(command, (error, _stdout, _stderr) => {
                    if (error) {
                        log.error(`[NATIVE-HOST] Registry registration failed for ${key}:`, error);
                    } else {
                        log.info(`[NATIVE-HOST] Registered ${key} -> ${manifest}`);
                    }
                });
            });
        }
    } catch (err) {
        log.error('[NATIVE-HOST] Installation failed:', err);
    }
}
