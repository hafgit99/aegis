
/**
 * Validation Service
 * Handles generic data validation across the application
 */
export class ValidationService {
    /**
     * Validates a URL against security constraints
     * - Protocol restriction (http/https only)
     * - Punycode conversion awareness
     * - Length limits
     */
    static validateUrl(url: string): { isValid: boolean; error?: string } {
        if (!url) return { isValid: true }; // Empty is okay

        if (url.length > 2048) {
            return { isValid: false, error: 'URL_TOO_LONG' };
        }

        try {
            const parsed = new URL(url);

            // 1. Protocol Restriction
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return { isValid: false, error: 'INVALID_PROTOCOL' };
            }

            // 2. Punycode awareness (IDN)
            // Check for 'xn--' which indicates Punycode
            if (parsed.hostname.includes('xn--')) {
                // High-security warning or strict check
                // For now, we allow it but recognize it
            }

            // 3. Prevent loopback or internal IP if necessary
            // (Optional: depending on requirements)

            return { isValid: true };
        } catch (e) {
            return { isValid: false, error: 'INVALID_URL_FORMAT' };
        }
    }

    /**
     * Universal password validator
     */
    static validatePassword(password: string): { isValid: boolean; issues: string[] } {
        // Unicode Normalization (NFKD)
        const normalized = password.normalize('NFKD');
        const issues: string[] = [];

        if (normalized.length < 12) issues.push("PASSWORD_TOO_SHORT");
        if (normalized.length > 128) issues.push("PASSWORD_TOO_LONG");

        const whitelistRegex = /^[^\x00-\x1F\x7F-\x9F]+$/;
        if (!whitelistRegex.test(normalized)) issues.push("INVALID_CHARACTERS");

        return {
            isValid: issues.length === 0,
            issues
        };
    }
}
