
export class LicensingService {
  private static TRIAL_DAYS = 3;
  private static STORAGE_KEY = 'aegis_license_data';
  private static INSTALL_KEY = 'aegis_install_date';

  // BURAYA: Üretici scriptinden aldığınız PUBLIC KEY'i yapıştırın (PEM formatında)
  private static PUBLIC_KEY_PEM = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3F8VMn76p9146qWrhHhEEjRcZqTd\n4SShA7jt9lUKNT8Uig0RCQavP457h71HDAsu6I5CF/EerrSebutQCPqLVA==\n-----END PUBLIC KEY-----";

  static async getDeviceId(): Promise<string> {
    if ((window as any).electronAPI) {
      return await (window as any).electronAPI.getDeviceId();
    }
    return "BROWSER-DEMO-MODE";
  }

  static isPro(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }

  static getRemainingTrialDays(): number {
    const installDate = parseInt(localStorage.getItem(this.INSTALL_KEY) || Date.now().toString());
    const elapsed = Date.now() - installDate;
    const remaining = this.TRIAL_DAYS - (elapsed / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.ceil(remaining));
  }

  static isTrialExpired(): boolean {
    if (this.isPro()) return false;
    return this.getRemainingTrialDays() <= 0;
  }

  // PEM formatını SubtleCrypto'nun anlayacağı ArrayBuffer'a çevirir
  private static pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n|\r/g, '');
    const binary = window.atob(b64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return buffer.buffer;
  }

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
}
