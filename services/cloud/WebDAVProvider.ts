import { ICloudProvider, CloudFileInfo } from './ICloudProvider';

export class WebDAVProvider implements ICloudProvider {
    name = "WebDAV";
    private config: any = null;

    constructor() {
        const saved = localStorage.getItem('aegis_webdav_config');
        if (saved) this.config = JSON.parse(saved);
    }

    async initialize(): Promise<void> {
        if (!this.config) throw new Error("WebDAV not configured");
        // Verify connection through IPC
        const ok = await (window as any).electronAPI.cloud.webdav.test(this.config);
        if (!ok) throw new Error("WebDAV connection failed");
    }

    async listVaultFiles(): Promise<CloudFileInfo[]> {
        return await (window as any).electronAPI.cloud.webdav.list(this.config);
    }

    async uploadVaultFile(name: string, content: ArrayBuffer): Promise<void> {
        await (window as any).electronAPI.cloud.webdav.upload(this.config, name, content);
    }

    async downloadVaultFile(name: string): Promise<ArrayBuffer> {
        return await (window as any).electronAPI.cloud.webdav.download(this.config, name);
    }

    async deleteVaultFile(name: string): Promise<void> {
        await (window as any).electronAPI.cloud.webdav.delete(this.config, name);
    }

    isAuthenticated(): boolean {
        return !!this.config;
    }

    async logout(): Promise<void> {
        this.config = null;
        localStorage.removeItem('aegis_webdav_config');
    }
}
