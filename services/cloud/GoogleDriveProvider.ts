import { ICloudProvider, CloudFileInfo } from './ICloudProvider';

export class GoogleDriveProvider implements ICloudProvider {
    name = "Google Drive";

    async initialize(config?: { clientId: string, clientSecret: string }): Promise<void> {
        const auth = await (window as any).electronAPI.cloud.google.authenticate(config);
        if (!auth) throw new Error("Google authentication failed");
    }

    async listVaultFiles(): Promise<CloudFileInfo[]> {
        return await (window as any).electronAPI.cloud.google.list();
    }

    async uploadVaultFile(name: string, content: ArrayBuffer): Promise<void> {
        await (window as any).electronAPI.cloud.google.upload(name, content);
    }

    async downloadVaultFile(fileId: string): Promise<ArrayBuffer> {
        return await (window as any).electronAPI.cloud.google.download(fileId);
    }

    async deleteVaultFile(fileId: string): Promise<void> {
        await (window as any).electronAPI.cloud.google.delete(fileId);
    }

    isAuthenticated(): boolean {
        // Check if we have a valid token (handled by Main process usually)
        return true;
    }

    async logout(): Promise<void> {
        await (window as any).electronAPI.cloud.google.logout();
    }
}
