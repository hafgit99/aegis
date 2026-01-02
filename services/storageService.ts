/**
 * Safe localStorage wrapper with JSON parsing error handling and schema validation
 * Prevents crashes from corrupted or invalid localStorage data
 */

export interface StorageSchema {
  [key: string]: (value: any) => boolean; // Key -> validation function
}

export class StorageService {
  /**
   * Safe localStorage get with default value and optional schema validation
   * @param key Storage key
   * @param defaultValue Default value if key doesn't exist or parsing fails
   * @param schema Optional validation schema for the parsed object
   * @returns Parsed value or default value if parsing/validation fails
   */
  static safeGet<T>(key: string, defaultValue: T, schema?: (value: any) => boolean): T {
    try {
      const item = localStorage.getItem(key);
      
      if (item === null) {
        return defaultValue;
      }

      // Try to parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(item);
      } catch (parseError) {
        console.warn(`Failed to parse localStorage[${key}]:`, parseError);
        return defaultValue;
      }

      // Validate against schema if provided
      if (schema && !schema(parsed)) {
        console.warn(`localStorage[${key}] failed schema validation`);
        return defaultValue;
      }

      return parsed as T;
    } catch (error) {
      console.error(`Unexpected error reading localStorage[${key}]:`, error);
      return defaultValue;
    }
  }

  /**
   * Safe localStorage get for objects with property validation
   * @param key Storage key
   * @param schema Object schema with validation functions for each property
   * @param defaultValue Default value if parsing/validation fails
   * @returns Parsed object or default value
   */
  static safeGetObject<T extends Record<string, any>>(
    key: string,
    schema: StorageSchema,
    defaultValue: T
  ): T {
    try {
      const item = localStorage.getItem(key);
      
      if (item === null) {
        return defaultValue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(item);
      } catch (parseError) {
        console.warn(`Failed to parse localStorage[${key}]:`, parseError);
        return defaultValue;
      }

      // Validate each property against schema
      for (const [prop, validator] of Object.entries(schema)) {
        if (!validator(parsed[prop])) {
          console.warn(`localStorage[${key}].${prop} failed validation`);
          return defaultValue;
        }
      }

      return parsed as T;
    } catch (error) {
      console.error(`Unexpected error reading localStorage[${key}]:`, error);
      return defaultValue;
    }
  }

  /**
   * Safe localStorage set with error handling
   * @param key Storage key
   * @param value Value to store (will be JSON.stringify'd)
   * @returns true if successful, false otherwise
   */
  static safeSet(key: string, value: any): boolean {
    try {
      const jsonString = JSON.stringify(value);
      localStorage.setItem(key, jsonString);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        // QuotaExceededError - localStorage is full
        console.error(`localStorage quota exceeded when setting ${key}`);
      } else {
        console.error(`Failed to set localStorage[${key}]:`, error);
      }
      return false;
    }
  }

  /**
   * Safe localStorage remove
   * @param key Storage key to remove
   * @returns true if key existed and was removed
   */
  static safeRemove(key: string): boolean {
    try {
      const existed = localStorage.getItem(key) !== null;
      if (existed) {
        localStorage.removeItem(key);
      }
      return existed;
    } catch (error) {
      console.error(`Failed to remove localStorage[${key}]:`, error);
      return false;
    }
  }

  /**
   * Check if a key exists in localStorage
   * @param key Storage key to check
   * @returns true if key exists
   */
  static exists(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      console.error(`Failed to check localStorage[${key}]:`, error);
      return false;
    }
  }

  /**
   * Clear all localStorage entries (DANGEROUS - use carefully)
   * @returns true if successful
   */
  static clearAll(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }

  /**
   * Migrate data from one key to another, removing the source key
   * @param fromKey Source key
   * @param toKey Destination key
   * @returns true if migration successful
   */
  static migrate(fromKey: string, toKey: string): boolean {
    try {
      const value = localStorage.getItem(fromKey);
      if (value === null) {
        return false; // No data to migrate
      }

      localStorage.setItem(toKey, value);
      localStorage.removeItem(fromKey);
      return true;
    } catch (error) {
      console.error(`Failed to migrate localStorage from ${fromKey} to ${toKey}:`, error);
      return false;
    }
  }

  /**
   * Get all storage keys (for debugging/audit)
   * @returns Array of all localStorage keys
   */
  static getAllKeys(): string[] {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.error('Failed to enumerate localStorage keys:', error);
      return [];
    }
  }

  /**
   * Get total size of localStorage data (approximate)
   * @returns Size in bytes
   */
  static getApproximateSize(): number {
    try {
      let size = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            size += key.length + value.length;
          }
        }
      }
      return size * 2; // Approximate UTF-16 byte size
    } catch (error) {
      console.error('Failed to calculate localStorage size:', error);
      return 0;
    }
  }

  /**
   * Validate entire localStorage against a schema
   * @param schema Schema mapping keys to validation functions
   * @returns Array of validation errors (empty if all valid)
   */
  static validateAll(schema: Record<string, (value: any) => boolean>): string[] {
    const errors: string[] = [];

    try {
      for (const [key, validator] of Object.entries(schema)) {
        const item = localStorage.getItem(key);
        
        if (item === null) {
          errors.push(`Missing required key: ${key}`);
          continue;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(item);
        } catch {
          errors.push(`Failed to parse ${key}`);
          continue;
        }

        if (!validator(parsed)) {
          errors.push(`${key} failed validation`);
        }
      }
    } catch (error) {
      errors.push(`Validation error: ${String(error)}`);
    }

    return errors;
  }
}
