export interface CloudFileInfo {
    id?: string;
    name: string;
    lastModified: number;
    size: number;
}

export interface ICloudProvider {
    name: string;
    initialize(config?: any): Promise<void>;
    listVaultFiles(): Promise<CloudFileInfo[]>;
    uploadVaultFile(name: string, content: ArrayBuffer | Blob): Promise<void>;
    downloadVaultFile(fileIdOrName: string): Promise<ArrayBuffer>;
    deleteVaultFile(fileIdOrName: string): Promise<void>;
    isAuthenticated(): boolean;
    logout(): Promise<void>;
}
