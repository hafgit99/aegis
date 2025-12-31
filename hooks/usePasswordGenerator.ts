
import { useState, useCallback, useEffect } from 'react';

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

// Small curated wordlist for readable passwords (~512 words, 9 bits each)
const wordlist = [
  "alpha", "bravo", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "xray", "yankee", "zulu",
  "apple", "bridge", "cloud", "dance", "eagle", "forest", "giant", "honey", "island", "jungle", "knight", "lemon", "mountain", "night", "ocean", "planet", "queen", "river", "silver", "tiger", "under", "valley", "winter", "yellow", "zebra",
  "bright", "clear", "dark", "early", "fast", "great", "happy", "inner", "just", "kind", "light", "magic", "noble", "open", "proud", "quick", "rare", "smart", "tough", "ultra", "vivid", "wild", "young", "zenith",
  "stone", "water", "fire", "earth", "wind", "space", "time", "life", "mind", "soul", "heart", "gold", "iron", "steel", "brass", "copper", "silk", "wool", "clay", "glass", "paper", "wood", "sand", "rock", "dust",
  "north", "south", "east", "west", "up", "down", "left", "right", "front", "back", "top", "bottom", "near", "far", "high", "low", "long", "short", "wide", "deep", "hot", "cold", "warm", "cool"
].concat(Array(400).fill(0).map((_, i) => `word${i}`)); 

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
