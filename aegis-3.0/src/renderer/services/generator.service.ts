export interface GeneratorOptions {
    length: number;
    includeUppercase: boolean;
    includeNumbers: boolean;
    includeSymbols: boolean;
}

export class PasswordGeneratorService {
    /**
     * Generate a secure random password using the native bridge
     */
    static async generate(options: GeneratorOptions): Promise<string> {
        // @ts-ignore
        return window.aegis.crypto.generatePassword({
            length: options.length,
            uppercase: options.includeUppercase,
            numbers: options.includeNumbers,
            symbols: options.includeSymbols,
        });
    }

    /**
     * Calculate password entropy/strength
     */
    static calculateStrength(password: string): { score: number; labelKey: string; color: string } {
        if (!password) return { score: 0, labelKey: 'generator.strength.none', color: 'bg-gray-500' };

        let score = 0;

        // Length score (up to 40 points)
        score += Math.min(password.length * 4, 40);

        // Variety score
        if (/[A-Z]/.test(password)) score += 15;
        if (/[a-z]/.test(password)) score += 10;
        if (/[0-9]/.test(password)) score += 15;
        if (/[^A-Za-z0-9]/.test(password)) score += 20;

        // Bonus for very long passwords
        if (password.length > 16) score += 10;

        if (score < 40) return { score, labelKey: 'generator.strength.weak', color: 'bg-red-500' };
        if (score < 70) return { score, labelKey: 'generator.strength.medium', color: 'bg-yellow-500' };
        if (score < 90) return { score, labelKey: 'generator.strength.strong', color: 'bg-teal-500' };
        return { score, labelKey: 'generator.strength.unbreakable', color: 'bg-indigo-500' };
    }
}
