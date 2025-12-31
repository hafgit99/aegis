
import { useVault as useVaultFromContext } from '../contexts/VaultContext';

/**
 * Legacy hook wrapper to maintain compatibility while using the global VaultContext.
 * This ensures all components share the same entries state.
 */
export const useVault = () => {
  return useVaultFromContext();
};