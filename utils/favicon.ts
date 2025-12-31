
/**
 * Aegis Vault - Favicon Utility
 * SECURITY: Offline-friendly design - does NOT require internet connection
 * Returns null if no favicon can be determined locally
 */

export const getFaviconUrl = (url?: string): string | null => {
  if (!url) return null;
  
  try {
    let domain = url;
    // Remove protocol and paths
    domain = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
    
    if (!domain || domain.length < 3) return null;
    
    // SECURITY: Do NOT fetch from external services (offline requirement)
    // Return null to indicate no favicon available
    // UI should show a default icon instead
    return null;
  } catch (e) {
    return null;
  }
};
