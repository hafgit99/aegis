
import { useState, useCallback, useEffect } from 'react';
import { effWordlist as wordlist } from '../utils/effWordlist';

export interface GeneratorOptions {
  mode: 'random' | 'readable';
  length: number; // For random: char count, For readable: word count
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidSimilar: boolean;
  separator: string;
}

const DEFAULT_OPTIONS: GeneratorOptions = {
  mode: 'random',
  length: 18,
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
  avoidSimilar: true,
  separator: '-'
};

// EFF Long Wordlist (7,776 words, ~12.9 bits each)
// Imported from ../utils/effWordlist

export const usePasswordGenerator = () => {
  const [history, setHistory] = useState<string[]>([]);
  const [options, setOptionsState] = useState<GeneratorOptions>(() => {
    const saved = localStorage.getItem('aegis_generator_options');
    return saved ? JSON.parse(saved) : DEFAULT_OPTIONS;
  });

  const setOptions = (newOptions: GeneratorOptions) => {
    setOptionsState(newOptions);
    localStorage.setItem('aegis_generator_options', JSON.stringify(newOptions));
  };

  const generate = useCallback((opts?: GeneratorOptions) => {
    const currentOptions = opts || options;
    const { mode, length, upper, lower, numbers, symbols, avoidSimilar, separator } = currentOptions;

    if (mode === 'readable') {
      const resultWords: string[] = [];
      const array = new Uint32Array(length);
      window.crypto.getRandomValues(array);

      for (let i = 0; i < length; i++) {
        let word = wordlist[array[i] % wordlist.length];
        if (upper && i === 0) word = word.charAt(0).toUpperCase() + word.slice(1);
        resultWords.push(word);
      }

      let pass = resultWords.join(separator || "-");
      if (numbers) pass += Math.floor(Math.random() * 10);

      setHistory(prev => [pass, ...prev].slice(0, 5));
      return pass;
    }

    // Random Mode
    let charset = "";
    if (lower) charset += "abcdefghijklmnopqrstuvwxyz";
    if (upper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (numbers) charset += "0123456789";
    if (symbols) charset += "!@#$%^&*()_+~`|}{[]:;?><,./-=";

    if (avoidSimilar) {
      charset = charset.replace(/[il1Lo0O]/g, "");
    }

    if (charset.length === 0) return "";

    let password = "";
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      password += charset.charAt(array[i] % charset.length);
    }

    setHistory(prev => [password, ...prev].slice(0, 5));
    return password;
  }, [options]);

  return { generate, history, options, setOptions };
};
