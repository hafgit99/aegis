/**
 * File Validation Service
 * Validates file uploads against security constraints
 * - MIME type validation
 * - Magic bytes verification (file signature)
 * - Extension whitelist
 * - File size limits
 * - Compression bomb detection
 */

export class FileValidationService {
  // Maksimum dosya boyutu: 25MB (önceki 5MB'den yükseltildi)
  private static readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

  // İzin verilen MIME türleri
  private static readonly ALLOWED_MIMES = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Documents
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    
    // Office documents
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  ];

  // Tehlikeli uzantılar (blacklist)
  private static readonly BLOCKED_EXTENSIONS = [
    // Executables
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr',
    'ps1', 'ps2', 'psc1', 'psc2', 'msh', 'msh1', 'msh2', 'mshxml', 'msh1xml', 'msh2xml',
    
    // Scripts
    'vbs', 'vbe', 'js', 'jse', 'jar', 'jnlp',
    
    // Libraries/Plugins
    'dll', 'app', 'bin', 'dylib', 'so', 'msi',
    
    // Archives (zip bombs)
    'zip', 'rar', '7z', 'gz', 'tar', 'bz2', 'iso', 'dmg',
    
    // Symbolic links (security risk)
    'lnk', 'sym',
    
    // System files
    'sys', 'ini', 'reg',
  ];

  // Magic bytes (file signatures) for type verification
  private static readonly MAGIC_BYTES: Record<string, Uint8Array> = {
    // JPEG: FF D8 FF
    'jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
    
    // PNG: 89 50 4E 47
    'png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
    
    // GIF: 47 49 46 38
    'gif': new Uint8Array([0x47, 0x49, 0x46, 0x38]),
    
    // PDF: 25 50 44 46
    'pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    
    // ZIP: 50 4B 03 04 or 50 4B 05 06
    'zip': new Uint8Array([0x50, 0x4B]),
    
    // WEBP: 52 49 46 46 (RIFF)
    'webp': new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  };

  /**
   * Validate file upload against all security constraints
   */
  static async validateFileUpload(file: File): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. File existence check
    if (!file) {
      errors.push('FILE_MISSING');
      return { valid: false, errors, warnings };
    }

    // 2. File size validation
    if (file.size === 0) {
      errors.push('FILE_EMPTY');
    } else if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`FILE_TOO_LARGE (${this.formatBytes(file.size)} > ${this.formatBytes(this.MAX_FILE_SIZE)})`);
    }

    // 3. Extract file extension
    const fileName = file.name.toLowerCase();
    const ext = fileName.split('.').pop() || '';

    // 4. Extension whitelist check
    if (this.BLOCKED_EXTENSIONS.includes(ext)) {
      errors.push(`BLOCKED_EXTENSION (.${ext})`);
    }

    // 5. MIME type validation
    if (file.type && !this.ALLOWED_MIMES.includes(file.type)) {
      errors.push(`UNSUPPORTED_MIME_TYPE (${file.type})`);
    } else if (!file.type) {
      warnings.push('MIME_TYPE_MISSING');
    }

    // 6. Magic bytes verification (if not already errored)
    if (errors.length === 0) {
      const magicBytesError = await this.validateMagicBytes(file);
      if (magicBytesError) {
        errors.push(magicBytesError);
      }
    }

    // 7. Compression bomb detection (for ZIP, 7Z, RAR, etc.)
    if (errors.length === 0) {
      const compressionError = await this.detectCompressionBomb(file);
      if (compressionError) {
        errors.push(compressionError);
      }
    }

    // 8. Additional warnings for risky patterns
    if (fileName.includes('..')) {
      warnings.push('PATH_TRAVERSAL_PATTERN');
    }

    if (fileName.includes(' ')) {
      warnings.push('FILENAME_HAS_SPACES');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Verify file content matches declared MIME type via magic bytes
   */
  private static async validateMagicBytes(file: File): Promise<string | null> {
    try {
      const headerSize = 8; // Most magic bytes are within first 8 bytes
      const header = await file.slice(0, headerSize).arrayBuffer();
      const headerArray = new Uint8Array(header);

      // Determine expected magic bytes based on MIME type
      let expectedMagic: Uint8Array | null = null;

      if (file.type.includes('jpeg')) {
        expectedMagic = this.MAGIC_BYTES['jpeg'];
      } else if (file.type.includes('png')) {
        expectedMagic = this.MAGIC_BYTES['png'];
      } else if (file.type.includes('gif')) {
        expectedMagic = this.MAGIC_BYTES['gif'];
      } else if (file.type.includes('pdf')) {
        expectedMagic = this.MAGIC_BYTES['pdf'];
      } else if (file.type.includes('webp')) {
        expectedMagic = this.MAGIC_BYTES['webp'];
      }

      // Verify magic bytes match
      if (expectedMagic) {
        const matches = this.bytesMatch(headerArray, expectedMagic);
        if (!matches) {
          return `INVALID_FILE_SIGNATURE (${file.type} expected, got ${this.bytesToHex(headerArray.slice(0, 4))})`;
        }
      }

      return null;
    } catch (e) {
      console.error('Magic bytes validation error:', e);
      return 'MAGIC_BYTES_CHECK_FAILED';
    }
  }

  /**
   * Detect compression bombs (highly compressed files that expand to huge sizes)
   */
  private static async detectCompressionBomb(file: File): Promise<string | null> {
    try {
      // Get first 4 bytes to detect ZIP
      const header = await file.slice(0, 4).arrayBuffer();
      const headerArray = new Uint8Array(header);
      const headerHex = this.bytesToHex(headerArray);

      // ZIP magic bytes: 504B0304 or 504B0506
      const isZip = headerHex.startsWith('504b0304') || headerHex.startsWith('504b0506');

      if (isZip) {
        // Simple heuristic: compression ratio should not exceed 1000:1
        // Most legitimate files compress at 2-10:1 ratio
        const MAX_COMPRESSION_RATIO = 1000;
        const MAX_ESTIMATED_SIZE = file.size * MAX_COMPRESSION_RATIO;

        // Warn if potential bomb
        if (MAX_ESTIMATED_SIZE > 500 * 1024 * 1024) { // 500MB estimated
          return 'POTENTIAL_COMPRESSION_BOMB (archive size unusually large)';
        }
      }

      return null;
    } catch (e) {
      console.error('Compression bomb detection error:', e);
      // Don't fail hard, just warn
      return null;
    }
  }

  /**
   * Compare byte arrays for magic bytes matching
   */
  private static bytesMatch(data: Uint8Array, expected: Uint8Array): boolean {
    if (data.length < expected.length) {
      return false;
    }

    for (let i = 0; i < expected.length; i++) {
      if (data[i] !== expected[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert bytes to hex string for logging
   */
  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();
  }

  /**
   * Format bytes to human-readable size
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get user-friendly error messages
   */
  static getErrorMessage(errorCode: string, lang: 'en' | 'tr' = 'en'): string {
    const messages: Record<string, Record<string, string>> = {
      FILE_MISSING: {
        en: 'No file selected',
        tr: 'Dosya seçilmedi'
      },
      FILE_EMPTY: {
        en: 'File is empty',
        tr: 'Dosya boş'
      },
      FILE_TOO_LARGE: {
        en: 'File size exceeds maximum limit (25MB)',
        tr: 'Dosya boyutu maksimum limiti aşıyor (25MB)'
      },
      BLOCKED_EXTENSION: {
        en: 'This file type is not allowed for security reasons',
        tr: 'Bu dosya türü güvenlik nedeniyle izin verilmiyor'
      },
      UNSUPPORTED_MIME_TYPE: {
        en: 'File MIME type is not supported',
        tr: 'Dosya MIME türü desteklenmiyor'
      },
      MIME_TYPE_MISSING: {
        en: 'File MIME type could not be detected',
        tr: 'Dosya MIME türü algılanamadı'
      },
      INVALID_FILE_SIGNATURE: {
        en: 'File content does not match its declared type',
        tr: 'Dosya içeriği bildirilen türle eşleşmiyor'
      },
      POTENTIAL_COMPRESSION_BOMB: {
        en: 'Archive file is suspiciously large (compression bomb detection)',
        tr: 'Arşiv dosyası şüphe uyandıracak şekilde büyük (zip bomb tespiti)'
      },
      PATH_TRAVERSAL_PATTERN: {
        en: 'File name contains suspicious path patterns',
        tr: 'Dosya adı şüpheli yol desenleri içeriyor'
      },
      FILENAME_HAS_SPACES: {
        en: 'File name contains spaces (not recommended)',
        tr: 'Dosya adı boşluk içeriyor (önerilmez)'
      },
      MAGIC_BYTES_CHECK_FAILED: {
        en: 'Could not verify file signature',
        tr: 'Dosya imzası doğrulanamadı'
      }
    };

    return messages[errorCode]?.[lang] || errorCode;
  }
}
