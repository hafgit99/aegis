
export interface ErrorLog {
    message: string;
    stack?: string;
    context?: string;
    timestamp: string;
}

export class ErrorHandlingService {
    private static isDebugMode = localStorage.getItem('aegis_debug_mode') === 'true';

    static setDebugMode(enabled: boolean) {
        this.isDebugMode = enabled;
        localStorage.setItem('aegis_debug_mode', enabled.toString());
        console.log(`[ErrorService] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    static getDebugMode(): boolean {
        return this.isDebugMode;
    }

    /**
     * Standardized error handling
     * Returns a translation key to be used with useLanguage hook
     */
    static handle(error: any, context?: string): string {
        const message = error.message || error.toString();

        const errorDetail: ErrorLog = {
            message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        };

        // Internal logging
        this.logToStorage(errorDetail);

        if (this.isDebugMode) {
            console.group(`%c [AEGIS DEBUG] Error in ${context || 'Unknown'} `, 'background: #222; color: #ff5555; font-weight: bold;');
            console.error("Message:", message);
            console.error("Trace:", error);
            console.groupEnd();
        } else {
            console.error(`[Aegis] ${context ? `[${context}] ` : ''}${message}`);
        }

        return this.getTranslationKey(message);
    }

    private static getTranslationKey(errorMsg: string): string {
        if (!errorMsg) return 'error_unknown';

        const msg = errorMsg.toLowerCase();

        if (msg.includes('decryption_failed')) return 'error_decryption_failed';
        if (msg.includes('quota')) return 'error_storage_full';
        if (msg.includes('network')) return 'error_network';
        if (msg.includes('unauthorized') || msg.includes('401')) return 'error_unauthorized';
        if (msg.includes('not found') || msg.includes('404')) return 'error_not_found';
        if (msg.includes('file too large')) return 'error_file_large';
        if (msg.includes('locked')) return 'error_vault_locked';
        if (msg.includes('verified')) return 'error_2fa_failed';

        return 'error_generic';
    }

    private static logToStorage(detail: ErrorLog) {
        try {
            const logsStr = localStorage.getItem('aegis_error_logs') || '[]';
            const logs: ErrorLog[] = JSON.parse(logsStr);
            logs.unshift(detail);
            // Keep last 50 errors
            localStorage.setItem('aegis_error_logs', JSON.stringify(logs.slice(0, 50)));
        } catch (e) {
            // Silently fail if localStorage is full or corrupted
        }
    }

    static getLogs(): ErrorLog[] {
        try {
            return JSON.parse(localStorage.getItem('aegis_error_logs') || '[]');
        } catch {
            return [];
        }
    }

    static clearLogs() {
        localStorage.removeItem('aegis_error_logs');
    }
}
