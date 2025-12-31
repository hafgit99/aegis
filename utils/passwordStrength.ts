
/**
 * Aegis Vault - Bit-Entropy Strength Analyzer
 */

export interface StrengthResult {
  score: number; // 0 - 4
  bits: number;
  label: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' | 'Ironclad';
  color: string;
}

export const analyzeStrength = (password: string, mode: 'random' | 'readable' = 'random'): StrengthResult => {
  if (!password) return { score: 0, bits: 0, label: 'Very Weak', color: 'bg-zinc-800' };

  let bits = 0;
  
  if (mode === 'random') {
    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^A-Za-z0-9]/.test(password)) poolSize += 33;
    
    // Entropy formula: L * log2(Pool)
    bits = Math.floor(password.length * Math.log2(poolSize || 1));
  } else {
    // For readable (Diceware-like), we assume a word pool of ~1024 words
    // log2(1024) = 10 bits per word. 
    // Words are separated by dashes.
    const wordCount = password.split('-').length;
    bits = wordCount * 10; 
  }

  let score = 0;
  if (bits >= 40) score = 1; // Weak
  if (bits >= 60) score = 2; // Medium
  if (bits >= 80) score = 3; // Strong
  if (bits >= 100) score = 4; // Ironclad

  const results: StrengthResult[] = [
    { score: 0, bits, label: 'Very Weak', color: 'bg-red-500' },
    { score: 1, bits, label: 'Weak', color: 'bg-orange-500' },
    { score: 2, bits, label: 'Medium', color: 'bg-amber-500' },
    { score: 3, bits, label: 'Strong', color: 'bg-blue-500' },
    { score: 4, bits, label: 'Ironclad', color: 'bg-emerald-500' },
  ];

  return results[score] || results[0];
};
