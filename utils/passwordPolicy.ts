import zxcvbn from 'zxcvbn';

/**
 * SECURITY: Master Password Policy Enforcement
 * OWASP 2024 compliant password requirements
 */

export interface PasswordPolicyResult {
  valid: boolean;
  strength: number; // 0-100
  errors: string[];
  warnings: string[];
  estimatedCrackTime: string;
}

export class PasswordPolicy {
  // SECURITY: Minimum requirements for master password
  private static readonly MIN_LENGTH = 12;
  private static readonly MIN_ZXCVBN_SCORE = 3; // 0-4 scale, 3 = "safely unguessable"

  // Common weak password patterns (offline check, no internet needed)
  private static readonly COMMON_WEAK_PASSWORDS = new Set([
    'password', '123456', '123456789', '12345678', '12345', '1234567', '1234567890',
    'qwerty', 'abc123', 'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'sunshine', 'princess', 'football', 'iloveyou', 'shadow',
    'passw0rd', 'password1', 'Password1', 'Password123', 'Admin123', 'Welcome123'
  ]);

  /**
   * Validate master password against security policy
   * @param password - The password to validate
   * @returns Policy validation result
   */
  static validateMasterPassword(password: string): PasswordPolicyResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Length check
    if (!password || password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    // 2. Character diversity check (recommended but not required)
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    const diversityCount = [hasLowercase, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (diversityCount < 3) {
      warnings.push('Consider using a mix of uppercase, lowercase, numbers, and special characters');
    }

    // 3. Common weak password check (offline, no internet needed)
    const lowerPassword = password.toLowerCase();
    if (this.COMMON_WEAK_PASSWORDS.has(lowerPassword)) {
      errors.push('This password is too common and appears in breach databases');
    }

    // Check if password contains common words
    for (const weak of this.COMMON_WEAK_PASSWORDS) {
      if (lowerPassword.includes(weak) && weak.length > 5) {
        warnings.push(`Avoid using common words like "${weak}" in your password`);
        break;
      }
    }

    // 4. Sequential characters check (e.g., "123456", "abcdef")
    if (this.hasSequentialChars(password, 4)) {
      warnings.push('Avoid sequential characters (e.g., 1234, abcd)');
    }

    // 5. Repeated characters check (e.g., "aaaa", "1111")
    if (this.hasRepeatedChars(password, 4)) {
      warnings.push('Avoid repeated characters (e.g., aaaa, 1111)');
    }

    // 6. zxcvbn strength analysis (advanced entropy calculation)
    const zxcvbnResult = zxcvbn(password);
    const strengthScore = (zxcvbnResult.score / 4) * 100; // Convert 0-4 to 0-100

    if (zxcvbnResult.score < this.MIN_ZXCVBN_SCORE) {
      errors.push(`Password is too weak (strength: ${Math.round(strengthScore)}%). Use a stronger passphrase`);
    }

    // Add feedback from zxcvbn
    if (zxcvbnResult.feedback.warning) {
      warnings.push(zxcvbnResult.feedback.warning);
    }

    if (zxcvbnResult.feedback.suggestions && zxcvbnResult.feedback.suggestions.length > 0) {
      warnings.push(...zxcvbnResult.feedback.suggestions);
    }

    return {
      valid: errors.length === 0,
      strength: Math.round(strengthScore),
      errors,
      warnings,
      estimatedCrackTime: this.formatCrackTime(zxcvbnResult.crack_times_display.offline_slow_hashing_1e4_per_second)
    };
  }

  /**
   * Check for sequential characters (e.g., "1234", "abcd")
   */
  private static hasSequentialChars(password: string, minLength: number = 4): boolean {
    for (let i = 0; i <= password.length - minLength; i++) {
      const slice = password.slice(i, i + minLength);
      let isSequential = true;

      for (let j = 1; j < slice.length; j++) {
        if (slice.charCodeAt(j) !== slice.charCodeAt(j - 1) + 1) {
          isSequential = false;
          break;
        }
      }

      if (isSequential) return true;
    }

    return false;
  }

  /**
   * Check for repeated characters (e.g., "aaaa", "1111")
   */
  private static hasRepeatedChars(password: string, minLength: number = 4): boolean {
    for (let i = 0; i <= password.length - minLength; i++) {
      const slice = password.slice(i, i + minLength);
      if (new Set(slice).size === 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Format crack time for display
   */
  private static formatCrackTime(crackTime: string): string {
    // zxcvbn provides human-readable estimates
    return crackTime;
  }

  /**
   * Generate a strong random password suggestion
   * @param length - Password length (default 16)
   * @returns A cryptographically secure random password
   */
  static generateStrongPassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + special;

    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);

    let password = '';

    // Ensure at least one of each type
    password += uppercase[array[0] % uppercase.length];
    password += lowercase[array[1] % lowercase.length];
    password += numbers[array[2] % numbers.length];
    password += special[array[3] % special.length];

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[array[i] % allChars.length];
    }

    // Shuffle the password to avoid predictable pattern
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate a memorable passphrase (EFF wordlist style)
   * @param wordCount - Number of words (default 6)
   * @returns A memorable passphrase
   */
  static generatePassphrase(wordCount: number = 6): string {
    // Simple word list for offline use (no internet needed)
    const words = [
      'correct', 'horse', 'battery', 'staple', 'mountain', 'river', 'forest', 'ocean',
      'thunder', 'lightning', 'rainbow', 'sunset', 'galaxy', 'comet', 'planet', 'nebula',
      'crystal', 'diamond', 'emerald', 'sapphire', 'dragon', 'phoenix', 'griffin', 'unicorn',
      'castle', 'fortress', 'tower', 'palace', 'temple', 'cathedral', 'lighthouse', 'bridge',
      'anchor', 'compass', 'telescope', 'microscope', 'symphony', 'harmony', 'melody', 'rhythm',
      'canvas', 'palette', 'sculpture', 'mosaic', 'prism', 'spectrum', 'aurora', 'eclipse',
      'voyage', 'journey', 'adventure', 'quest', 'treasure', 'discovery', 'horizon', 'frontier'
    ];

    const array = new Uint32Array(wordCount);
    window.crypto.getRandomValues(array);

    const selectedWords = Array.from(array).map(val => words[val % words.length]);
    return selectedWords.join('-');
  }
}
