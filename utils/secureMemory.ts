/**
 * Aegis Vault - Secure Memory Management
 * SECURITY: Utilities for securely handling sensitive data in memory
 */

export class SecureMemory {
    /**
     * Securely wipe a buffer from memory
     * Overwrites with random data first, then zeros
     */
    static wipe(buffer: Uint8Array | ArrayBuffer | null | undefined): void {
        if (!buffer) return;

        try {
            const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

            // Step 1: Overwrite with random data
            if (bytes.length > 0 && window.crypto && window.crypto.getRandomValues) {
                try {
                    window.crypto.getRandomValues(bytes);
                } catch (e) {
                    // Fallback if getRandomValues fails
                    for (let i = 0; i < bytes.length; i++) {
                        bytes[i] = Math.floor(Math.random() * 256);
                    }
                }
            }

            // Step 2: Overwrite with zeros
            bytes.fill(0);

            // Step 3: Overwrite with 0xFF for good measure
            bytes.fill(0xFF);

            // Step 4: Final zero
            bytes.fill(0);
        } catch (e) {
            console.error('Memory wipe failed:', e);
        }
    }

    /**
     * Securely wipe multiple buffers
     */
    static wipeAll(...buffers: (Uint8Array | ArrayBuffer | null | undefined)[]): void {
        for (const buffer of buffers) {
            this.wipe(buffer);
        }
    }

    /**
     * Create a temporary extractable key for a specific operation, then wipe it
     */
    static async withTemporaryExtractableKey<T>(
        rawKey: Uint8Array,
        operation: (key: CryptoKey, raw: Uint8Array) => Promise<T>
    ): Promise<T> {
        let tempKey: CryptoKey | null = null;
        const rawCopy = new Uint8Array(rawKey);

        try {
            // Import as EXTRACTABLE temporarily
            tempKey = await window.crypto.subtle.importKey(
                'raw',
                rawCopy,
                { name: 'AES-GCM' },
                true, // Temporarily extractable
                ['encrypt', 'decrypt']
            );

            // Perform operation
            const result = await operation(tempKey, rawCopy);

            return result;
        } finally {
            // SECURITY: Wipe all traces
            this.wipe(rawCopy);
            tempKey = null; // Dereference for GC
        }
    }

    /**
     * Lock memory pages (Windows VirtualLock / Unix mlock)
     * Prevents OS from paging sensitive data to disk
     */
    static async lockMemoryPages(): Promise<boolean> {
        if ((window as any).electronAPI?.secureMemory?.lockPages) {
            try {
                return await (window as any).electronAPI.secureMemory.lockPages();
            } catch (e) {
                console.warn('Memory page locking failed:', e);
                return false;
            }
        }
        return false;
    }

    /**
     * Get memory protection status
     */
    static async getMemoryProtectionStatus(): Promise<{
        locked: boolean;
        supported: boolean;
    }> {
        if ((window as any).electronAPI?.secureMemory?.getStatus) {
            try {
                return await (window as any).electronAPI.secureMemory.getStatus();
            } catch (e) {
                return { locked: false, supported: false };
            }
        }
        return { locked: false, supported: false };
    }
}
