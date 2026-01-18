import '@testing-library/jest-dom';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock Web Crypto API
if (!global.crypto) {
    // @ts-ignore
    global.crypto = {
        getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
            const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        },
        subtle: {
            decrypt: vi.fn(),
            encrypt: vi.fn(),
            exportKey: vi.fn(),
            importKey: vi.fn(),
            deriveKey: vi.fn(),
            deriveBits: vi.fn(),
            digest: vi.fn(),
            generateKey: vi.fn(),
            sign: vi.fn(),
            verify: vi.fn(),
            unwrapKey: vi.fn(),
            wrapKey: vi.fn(),
        } as any
    };
}

// Mock Electron API
(window as any).electronAPI = {
    vault: {
        setKey: vi.fn().mockResolvedValue(undefined),
        setVerifier: vi.fn().mockResolvedValue(undefined),
        encrypt: vi.fn().mockImplementation(async (data: string) => {
            // Simulate encryption result structure
            return {
                ciphertext: new TextEncoder().encode(data).buffer,
                iv: new Uint8Array(12).fill(0).buffer,
                tag: new Uint8Array(16).fill(0).buffer
            };
        }),
        decrypt: vi.fn().mockImplementation(async (ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array) => {
            return new TextDecoder().decode(ciphertext);
        }),
        encryptBinary: vi.fn().mockImplementation(async (data: Uint8Array) => {
            return {
                ciphertext: data.buffer,
                iv: new Uint8Array(12).fill(0).buffer,
                tag: new Uint8Array(16).fill(0).buffer
            };
        }),
        decryptBinary: vi.fn().mockImplementation(async (ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array) => {
            return ciphertext.buffer;
        }),
        clearKey: vi.fn().mockResolvedValue(undefined),
    },
    db: {
        getConfig: vi.fn(),
        setConfig: vi.fn(),
        saveEntry: vi.fn().mockResolvedValue(undefined),
        getAllEntries: vi.fn().mockResolvedValue([]),
        saveFolder: vi.fn().mockResolvedValue(undefined),
        deleteEntry: vi.fn().mockResolvedValue(undefined),
        bulkSaveEntries: vi.fn().mockResolvedValue(undefined),
    },
    audit: {
        logEvent: vi.fn().mockResolvedValue(undefined),
    }
};

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

