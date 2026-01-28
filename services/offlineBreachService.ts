/**
 * Offline Breach Monitoring Service
 *
 * 100% offline-first breach detection using local SHA-1 hash database.
 * No network requests are made - all checking is done locally.
 *
 * Database contains top 1M+ most common leaked passwords (SHA-1 hashed).
 *
 * Security guarantees:
 * - Passwords never leave the device
 * - SHA-1 hash is computed locally
 * - Database lookup is entirely offline
 * - IndexedDB caching for performance
 */

import { BreachCheckResult, BreachDatabaseEntry, BreachDatabase, BreachEntry, BreachDatabaseStats } from '../types';

// Error messages (TR/EN)
const BREACH_ERROR_MESSAGES = {
  DATABASE_NOT_INITIALIZED: {
    tr: "Breach veritabanı yüklenemedi. Lütfen uygulamayı yeniden başlatın.",
    en: "Breach database failed to load. Please restart the application."
  },
  DATABASE_UPDATE_FAILED: {
    tr: "Veritabanı güncellenemedi. Sonraki denemede tekrar edilecek.",
    en: "Database update failed. Will retry on next attempt."
  }
};

export class OfflineBreachService {
  private static database: Map<string, BreachEntry> | null = null;
  private static stats: BreachDatabaseStats = {
    patternCount: 0,
    initialized: false,
    totalChecks: 0
  };
  private static initPromise: Promise<void> | null = null;
  private static readonly DB_NAME = 'aegis-breach-cache';
  private static readonly STORE_NAME = 'breach-data';
  private static readonly DB_VERSION = 1;
  private static readonly CACHE_KEY = 'breach-database';

  // Fallback patterns for when database is not loaded
  private static readonly FALLBACK_PATTERNS = ['123456', 'password', 'qwerty', '12345678', 'admin', 'welcome'];

  /**
   * Initialize the breach database
   * Loads from public/data/breach-database.json or IndexedDB cache
   */
  static async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('[OfflineBreachService] Initializing breach database...');

        // Try to load from IndexedDB cache first
        const cachedData = await this.loadFromIndexedDB();
        if (cachedData) {
          console.log('[OfflineBreachService] Loaded from IndexedDB cache');
          await this.loadDatabase(cachedData);
          return;
        }

        // Load from public/data directory
        const response = await fetch('/data/breach-database.json');
        if (!response.ok) {
          throw new Error(`Failed to load breach database: ${response.status}`);
        }

        const data: BreachDatabase = await response.json();
        console.log(`[OfflineBreachService] Loaded ${data.entries.length} entries from /data/breach-database.json`);

        // Cache to IndexedDB for next time
        await this.saveToIndexedDB(data);

        await this.loadDatabase(data);
      } catch (error) {
        console.error('[OfflineBreachService] Initialization failed:', error);
        // Initialize with empty database (will use fallback patterns)
        this.database = new Map();
        this.stats = {
          patternCount: this.FALLBACK_PATTERNS.length,
          initialized: false,
          totalChecks: 0
        };
      }
    })();

    return this.initPromise;
  }

  /**
   * Load database data into memory Map
   */
  private static async loadDatabase(data: BreachDatabase): Promise<void> {
    this.database = new Map();

    for (const entry of data.entries) {
      this.database.set(entry.hash.toUpperCase(), entry);
    }

    this.stats = {
      patternCount: data.entries.length,
      initialized: true,
      version: data.version,
      lastUpdated: data.lastUpdated,
      totalChecks: 0
    };

    console.log(`[OfflineBreachService] Database loaded: ${this.stats.patternCount} entries`);
  }

  /**
   * Check if a password has been breached
   * @param password - Plain text password to check
   * @returns BreachCheckResult with breach status
   */
  static async checkPassword(password: string): Promise<BreachCheckResult> {
    if (!password) {
      return { isBreached: false, strength: 0, patterns: [] };
    }

    this.stats.totalChecks = (this.stats.totalChecks || 0) + 1;

    // If database is not initialized, try to initialize
    if (!this.database) {
      await this.initialize();
    }

    const hash = await this.sha1(password);
    const entry = this.database?.get(hash);

    const patterns: string[] = [];
    let isBreached = false;
    let breachCount = 0;

    // Check against hash database
    if (entry) {
      isBreached = true;
      breachCount = entry.occurrenceCount;
      patterns.push(`Found in ${breachCount.toLocaleString()} breaches`);
    }

    // Check against fallback patterns (for when database is not loaded)
    if (!isBreached && this.database && this.database.size === 0) {
      for (const pattern of this.FALLBACK_PATTERNS) {
        if (password.toLowerCase().includes(pattern)) {
          isBreached = true;
          patterns.push(`Contains common pattern: ${pattern}`);
        }
      }
    }

    return {
      isBreached,
      strength: isBreached ? 0 : this.calculateEntropy(password),
      patterns,
      breachCount
    };
  }

  /**
   * Get database statistics
   */
  static getStats(): BreachDatabaseStats {
    return { ...this.stats };
  }

  /**
   * Update the breach database from a remote source
   * This downloads the latest database and caches it to IndexedDB
   */
  static async updateDatabase(): Promise<boolean> {
    try {
      console.log('[OfflineBreachService] Updating breach database...');

      // In a real implementation, this would fetch from an update URL
      // For now, we'll just re-load from the public/data directory
      const response = await fetch('/data/breach-database.json?_=' + Date.now());
      if (!response.ok) {
        throw new Error(`Failed to update: ${response.status}`);
      }

      const data: BreachDatabase = await response.json();

      // Update memory
      await this.loadDatabase(data);

      // Update IndexedDB cache
      await this.saveToIndexedDB(data);

      console.log('[OfflineBreachService] Database updated successfully');
      return true;
    } catch (error) {
      console.error('[OfflineBreachService] Update failed:', error);
      return false;
    }
  }

  /**
   * Check if database is initialized
   */
  static isInitialized(): boolean {
    return this.stats.initialized;
  }

  /**
   * Compute SHA-1 hash of a string
   */
  private static async sha1(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /**
   * Calculate password entropy (bits)
   */
  private static calculateEntropy(password: string): number {
    let poolSize = 0;

    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

    if (poolSize === 0) return 0;

    return Math.floor(password.length * Math.log2(poolSize));
  }

  /**
   * Load database from IndexedDB cache
   */
  private static async loadFromIndexedDB(): Promise<BreachDatabase | null> {
    try {
      const db = await this.openIndexedDB();
      if (!db) return null;

      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(this.CACHE_KEY);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          resolve(request.result || null);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      });
    } catch (error) {
      console.warn('[OfflineBreachService] Failed to load from IndexedDB:', error);
      return null;
    }
  }

  /**
   * Save database to IndexedDB cache
   */
  private static async saveToIndexedDB(data: BreachDatabase): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      if (!db) return;

      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.put(data, this.CACHE_KEY);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    } catch (error) {
      console.warn('[OfflineBreachService] Failed to save to IndexedDB:', error);
    }
  }

  /**
   * Open IndexedDB
   */
  private static openIndexedDB(): Promise<IDBDatabase | null> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
    }).catch(() => null);
  }

  /**
   * Clear IndexedDB cache
   */
  static async clearCache(): Promise<void> {
    try {
      const db = await this.openIndexedDB();
      if (!db) return;

      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.delete(this.CACHE_KEY);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    } catch (error) {
      console.warn('[OfflineBreachService] Failed to clear cache:', error);
    }
  }
}

export default OfflineBreachService;
