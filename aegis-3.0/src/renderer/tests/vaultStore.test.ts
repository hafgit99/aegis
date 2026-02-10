import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVaultStore } from '../store/vaultStore';

// Mock window.aegis
const mockAegis = {
    openVault: vi.fn(),
    dbGetAll: vi.fn(),
    dbSave: vi.fn(),
    dbDelete: vi.fn(),
    checkBreach: vi.fn(),
    generatePassword: vi.fn(),
};

global.window.aegis = mockAegis as any;

describe('VaultStore', () => {
    beforeEach(() => {
        useVaultStore.setState({ entries: [], isLocked: true, isLoading: false, error: null });
        vi.clearAllMocks();
    });

    it('should unlock the vault successfully', async () => {
        mockAegis.openVault.mockResolvedValue(true);
        mockAegis.dbGetAll.mockResolvedValue([{ id: '1', title: 'Test' }]);

        const success = await useVaultStore.getState().unlock('password');

        expect(success).toBe(true);
        expect(useVaultStore.getState().isLocked).toBe(false);
        expect(useVaultStore.getState().entries).toHaveLength(1);
    });

    it('should handle unlock failure', async () => {
        mockAegis.openVault.mockResolvedValue(false);

        const success = await useVaultStore.getState().unlock('wrong_password');

        expect(success).toBe(false);
        expect(useVaultStore.getState().isLocked).toBe(true);
        expect(useVaultStore.getState().error).toBeTruthy();
    });

    it('should delete an entry', async () => {
        mockAegis.dbDelete.mockResolvedValue(undefined);
        mockAegis.dbGetAll.mockResolvedValue([]);

        await useVaultStore.getState().deleteEntry('1');

        expect(mockAegis.dbDelete).toHaveBeenCalledWith('1');
        expect(mockAegis.dbGetAll).toHaveBeenCalled(); // Should fetch after delete
    });
});
