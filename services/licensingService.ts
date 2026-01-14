/**
 * Aegis Vault - Secure Licensing Service
 * 
 * SECURITY FEATURES:
 * - Backend-enforced trial period (not stored in localStorage)
 * - HMAC-signed license data to prevent tampering
 * - Monotonic time tracking to detect clock manipulation
 * - Device-bound licensing with hardware ID
 * - AES-256-GCM or DPAPI encryption for license storage
 */

export class LicensingService {
  private static TRIAL_DAYS = 3;
  private static STORAGE_KEY = 'aegis_license_data'; // Legacy - kept for backward compatibility
  private static INSTALL_KEY = 'aegis_install_date'; // Legacy - kept for backward compatibility
  private static initialized = false;
  private static cachedStatus: {
    isPro: boolean;
    remainingDays: number;
    isExpired: boolean;
    timeManipulated: boolean;
  } | null = null;

  // BURAYA: Üretici scriptinden aldığınız PUBLIC KEY'i yapıştırın (PEM formatında)
  private static PUBLIC_KEY_PEM = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3F8VMn76p9146qWrhHhEEjRcZqTd\n4SShA7jt9lUKNT8Uig0RCQavP457h71HDAsu6I5CF/EerrSebutQCPqLVA==\n-----END PUBLIC KEY-----";

  /**
   * Initialize the licensing system
   * Should be called at app startup
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if we're in Electron environment with secure licensing
      if ((window as any).electronAPI?.licensing) {
        await (window as any).electronAPI.licensing.init();
        this.initialized = true;
        console.log('[Licensing] Secure backend licensing initialized');
      } else {
        // Browser fallback - use localStorage (less secure)
        console.warn('[Licensing] Running in browser mode - using localStorage (less secure)');
        this.initLegacy();
        this.initialized = true;
      }
    } catch (e) {
      console.error('[Licensing] Initialization failed:', e);
      this.initLegacy();
      this.initialized = true;
    }
  }

  /**
   * Legacy initialization for browser/fallback mode
   */
  private static initLegacy(): void {
    let installDateStr = localStorage.getItem(this.INSTALL_KEY);
    if (!installDateStr) {
      installDateStr = Date.now().toString();
      localStorage.setItem(this.INSTALL_KEY, installDateStr);
    }
  }

  static async getDeviceId(): Promise<string> {
    if ((window as any).electronAPI) {
      return await (window as any).electronAPI.getDeviceId();
    }
    return "BROWSER-DEMO-MODE";
  }

  /**
   * Check if Pro license is active
   * Uses secure backend when available
   */
  static isPro(): boolean {
    // Return cached value if available for synchronous calls
    if (this.cachedStatus !== null) {
      return this.cachedStatus.isPro;
    }

    // Fallback to localStorage check for legacy/browser mode
    return !!localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Async version of isPro that checks the backend
   */
  static async isProAsync(): Promise<boolean> {
    try {
      if ((window as any).electronAPI?.licensing) {
        return await (window as any).electronAPI.licensing.isPro();
      }
    } catch (e) {
      console.error('[Licensing] isPro check failed:', e);
    }
    return this.isPro();
  }

  /**
   * Get remaining trial days
   * Uses monotonic counter from backend to prevent time manipulation
   */
  static getRemainingTrialDays(): number {
    // Return cached value if available
    if (this.cachedStatus !== null) {
      return this.cachedStatus.remainingDays;
    }

    // Legacy fallback for browser mode
    let installDateStr = localStorage.getItem(this.INSTALL_KEY);
    if (!installDateStr) {
      installDateStr = Date.now().toString();
      localStorage.setItem(this.INSTALL_KEY, installDateStr);
    }
    const installDate = parseInt(installDateStr);

    // NaN check
    if (isNaN(installDate)) {
      console.warn('[Licensing] Invalid install date, resetting...');
      localStorage.setItem(this.INSTALL_KEY, Date.now().toString());
      return this.TRIAL_DAYS;
    }

    const elapsed = Date.now() - installDate;
    const remaining = this.TRIAL_DAYS - (elapsed / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.ceil(remaining));
  }

  /**
   * Check if trial is expired
   * Considers time manipulation detection
   */
  static isTrialExpired(): boolean {
    if (this.isPro()) return false;

    // Check for time manipulation flag
    if (this.cachedStatus?.timeManipulated) {
      return true;
    }

    return this.getRemainingTrialDays() <= 0;
  }

  /**
   * Get full licensing status from backend
   * This is the primary method for getting license info
   */
  static async getStatus(): Promise<{
    isPro: boolean;
    remainingDays: number;
    isExpired: boolean;
    timeManipulated: boolean;
  }> {
    try {
      if ((window as any).electronAPI?.licensing) {
        const status = await (window as any).electronAPI.licensing.getStatus();
        this.cachedStatus = status;
        return status;
      }
    } catch (e) {
      console.error('[Licensing] getStatus failed:', e);
    }

    // Fallback
    return {
      isPro: this.isPro(),
      remainingDays: this.getRemainingTrialDays(),
      isExpired: this.isTrialExpired(),
      timeManipulated: false
    };
  }

  /**
   * Update activity timestamp
   * Called periodically to track usage for anti-tampering
   */
  static async updateActivity(): Promise<void> {
    try {
      if ((window as any).electronAPI?.licensing) {
        await (window as any).electronAPI.licensing.updateActivity();
      }
    } catch (e) {
      console.error('[Licensing] updateActivity failed:', e);
    }
  }

  // PEM formatını SubtleCrypto'nun anlayacağı ArrayBuffer'a çevirir
  private static pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n|\r/g, '');
    const binary = window.atob(b64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return buffer.buffer;
  }

  /**
   * Activate Pro license
   * Verifies ECDSA signature and stores in secure backend
   */
  static async activateLicense(licenseKey: string): Promise<boolean> {
    try {
      const trimmedKey = licenseKey.trim().replace(/\s/g, '');
      const [payloadB64, signatureB64] = trimmedKey.split('.');

      if (!payloadB64 || !signatureB64) {
        console.error("❌ Lisans formatı hatalı (Nokta ile ayrılmış iki parça olmalı).");
        return false;
      }

      // Base64'ten veriyi çöz
      const payloadRaw = decodeURIComponent(escape(window.atob(payloadB64)));
      const payload = JSON.parse(payloadRaw);
      const currentDeviceId = await this.getDeviceId();

      // Cihaz ID'lerini temizle (Parantezleri ve boşlukları sil)
      const payloadId = payload.deviceId.trim().replace(/[\[\]]/g, '').toUpperCase();
      const currentId = currentDeviceId.trim().replace(/[\[\]]/g, '').toUpperCase();

      console.group("🛡️ Aegis Lisans Doğrulama");
      console.log("Gelen Cihaz ID:", payloadId);
      console.log("Mevcut Cihaz ID:", currentId);
      console.log("ID Eşleşmesi:", payloadId === currentId);

      // 1. Cihaz ID Kontrolü
      if (payloadId !== currentId) {
        console.error("❌ Hata: Bu lisans başka bir cihaza ait.");
        console.groupEnd();
        return false;
      }

      // 2. Dijital İmza Doğrulaması
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        this.pemToArrayBuffer(this.PUBLIC_KEY_PEM),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      // Signature B64 -> Uint8Array
      const sigBinary = window.atob(signatureB64);
      const signature = new Uint8Array(sigBinary.length);
      for (let i = 0; i < sigBinary.length; i++) signature[i] = sigBinary.charCodeAt(i);

      const encoder = new TextEncoder();
      const isValid = await window.crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        publicKey,
        signature,
        encoder.encode(payloadRaw)
      );

      console.log("İmza Geçerliliği:", isValid);
      console.groupEnd();

      if (isValid) {
        // Store in secure backend
        if ((window as any).electronAPI?.licensing) {
          const result = await (window as any).electronAPI.licensing.activatePro(trimmedKey);
          if (result.success) {
            // Also update localStorage for legacy compatibility
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
              activatedAt: Date.now(),
              licenseKey: trimmedKey
            }));

            // Update cache
            this.cachedStatus = {
              isPro: true,
              remainingDays: -1,
              isExpired: false,
              timeManipulated: false
            };

            return true;
          }
          return false;
        }

        // Fallback for browser mode
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
          activatedAt: Date.now(),
          licenseKey: trimmedKey
        }));
        return true;
      }
      return false;
    } catch (e) {
      console.error("❌ Lisans doğrulama hatası:", e);
      return false;
    }
  }

  /**
   * Clear cached status (force refresh)
   */
  static clearCache(): void {
    this.cachedStatus = null;
  }
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  // Delay initialization to ensure electronAPI is available
  setTimeout(() => {
    LicensingService.initialize().catch(console.error);

    // Update activity every 5 minutes
    setInterval(() => {
      LicensingService.updateActivity().catch(console.error);
    }, 5 * 60 * 1000);
  }, 1000);
}
