import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    main: string;
    permissions: string[];
}

export interface PluginInfo extends PluginManifest {
    enabled: boolean;
    path: string;
}

export class PluginService {
    private static instance: PluginService;
    private plugins: Map<string, PluginInfo> = new Map();
    private pluginsDir: string;

    private constructor() {
        this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
        this.ensurePluginsDir();
    }

    public static getInstance(): PluginService {
        if (!PluginService.instance) {
            PluginService.instance = new PluginService();
        }
        return PluginService.instance;
    }

    private ensurePluginsDir() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }
    }

    public async loadPlugins() {
        log.info('[PLUGINS] Loading plugins from:', this.pluginsDir);
        try {
            const dirs = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
            for (const dir of dirs) {
                if (dir.isDirectory()) {
                    const pluginPath = path.join(this.pluginsDir, dir.name);
                    const manifestPath = path.join(pluginPath, 'manifest.json');

                    if (fs.existsSync(manifestPath)) {
                        const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        this.plugins.set(manifest.id, {
                            ...manifest,
                            enabled: this.isPluginEnabled(manifest.id),
                            path: pluginPath
                        });
                    }
                }
            }
        } catch (error) {
            log.error('[PLUGINS] Failed to load plugins:', error);
        }
    }

    private isPluginEnabled(id: string): boolean {
        const configPath = path.join(this.pluginsDir, 'plugins.config.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return config[id] !== false; // Default to true if not specified
            } catch (e) {
                return true;
            }
        }
        return true;
    }

    public getPlugins(): PluginInfo[] {
        return Array.from(this.plugins.values());
    }

    public togglePlugin(id: string, enabled: boolean) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            plugin.enabled = enabled;
            
            // Persist state
            const configPath = path.join(this.pluginsDir, 'plugins.config.json');
            let config: Record<string, boolean> = {};
            if (fs.existsSync(configPath)) {
                try {
                    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } catch (e) {}
            }
            config[id] = enabled;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
            
            log.info(`[PLUGINS] Plugin ${id} state changed to: ${enabled}`);
            return true;
        }
        return false;
    }

    public setupIpcHandlers() {
        ipcMain.handle('plugins:list', () => this.getPlugins());
        ipcMain.handle('plugins:toggle', (_event, id: string, enabled: boolean) => this.togglePlugin(id, enabled));
        ipcMain.handle('plugins:get-marketplace', () => this.getMarketplacePlugins());
    }

    private getMarketplacePlugins() {
        // Mocked marketplace for demonstration
        return [
            {
                id: 'aegis.theme.darker',
                name: 'Gece Modu Pro',
                description: 'Göz yorgunluğunu azaltan, ultra koyu ve modern bir tema deneyimi.',
                version: '1.2.0',
                author: 'Aegis Team',
                category: 'Görünüm'
            },
            {
                id: 'aegis.autofill.google',
                name: 'Google Otomatik Doldurma Köprüsü',
                description: 'Chrome ve Google hesaplarınızdaki kayıtlı verileri Aegis ile senkronize edin.',
                version: '0.9.5',
                author: 'Aegis Community',
                category: 'Entegrasyon'
            },
            {
                id: 'aegis.security.auditor',
                name: 'Güvenlik Denetleyicisi',
                description: 'Şifrelerinizin karmaşıklığını ve sızdırılma durumlarını derinlemesine analiz eder.',
                version: '2.0.1',
                author: 'Cyber Guard',
                category: 'Güvenlik'
            }
        ];
    }
}
