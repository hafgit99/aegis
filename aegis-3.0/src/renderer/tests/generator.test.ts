import { describe, it, expect, vi, beforeAll } from 'vitest';
import { PasswordGeneratorService } from '../services/generator.service';

describe('PasswordGeneratorService', () => {
    beforeAll(() => {
        // Mock window.aegis
        global.window.aegis = {
            generatePassword: vi.fn().mockImplementation(async (options) => {
                // Mock implementation to return a string of requested length
                return 'x'.repeat(options.length);
            })
        } as any;
    });

    it('should generate a password of correct length', async () => {
        const password = await PasswordGeneratorService.generate({
            length: 16,
            includeNumbers: true,
            includeSymbols: true,
            includeUppercase: true
        });
        expect(password.length).toBe(16);
    });

    it('should calculate correct strength score', () => {
        const weak = PasswordGeneratorService.calculateStrength('123');
        const strong = PasswordGeneratorService.calculateStrength('A1b2C3d4!@#$Qwerty');

        expect(weak.score).toBeLessThan(40);
        expect(strong.score).toBeGreaterThan(80);
    });
});
