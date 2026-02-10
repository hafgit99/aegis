import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global mocks
global.window.aegis = {
    openVault: vi.fn(),
    dbGetAll: vi.fn(),
    dbSave: vi.fn(),
    dbDelete: vi.fn(),
    checkBreach: vi.fn(),
    generatePassword: vi.fn(),
    dbIsOpen: vi.fn().mockResolvedValue(false),
} as any;
