export class BruteForceService {
  private static async getDeviceId(): Promise<string> {
    if ((window as any).electronAPI?.getDeviceId) {
      return await (window as any).electronAPI.getDeviceId();
    }
    // Fallback: localStorage tabanlı ID (test ortamı)
    let id = localStorage.getItem('aegis_device_id');
    if (!id) {
      id = 'TEST_ID_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('aegis_device_id', id);
    }
    return id;
  }

  static async recordFailure(): Promise<number> {
    const deviceId = await this.getDeviceId();

    // SECURE: Main Process'te server-side tutulan counter kullan
    if ((window as any).electronAPI?.bruteforce) {
      const result = await (window as any).electronAPI.bruteforce.recordFailure(deviceId);
      return result.attempts;
    }

    // FALLBACK: localStorage (test ortamı, daha az güvenli)
    const current = this.getAttemptsSync() + 1;
    localStorage.setItem('aegis_failed_attempts', current.toString());

    const rules = [
      { threshold: 3, lockout: 30 * 1000 },
      { threshold: 5, lockout: 5 * 60 * 1000 },
      { threshold: 10, lockout: 30 * 60 * 1000 }
    ];
    const rule = [...rules].reverse().find(p => current >= p.threshold);
    if (rule) {
      const lockoutUntil = Date.now() + rule.lockout;
      localStorage.setItem('aegis_lockout_until', lockoutUntil.toString());
    }

    return current;
  }

  static async recordSuccess(): Promise<void> {
    const deviceId = await this.getDeviceId();

    // SECURE: Main Process'te server-side temizle
    if ((window as any).electronAPI?.bruteforce) {
      await (window as any).electronAPI.bruteforce.recordSuccess(deviceId);
    } else {
      // FALLBACK: localStorage temizle
      localStorage.removeItem('aegis_failed_attempts');
      localStorage.removeItem('aegis_lockout_until');
    }
  }

  static async checkStatus(): Promise<{ locked: boolean; attempts: number; remaining: number }> {
    const deviceId = await this.getDeviceId();

    // SECURE: Main Process'ten server-side durum al
    if ((window as any).electronAPI?.bruteforce) {
      return await (window as any).electronAPI.bruteforce.checkStatus(deviceId);
    }

    // FALLBACK: localStorage kontrolü
    const locked = this.getLockoutRemainingSync() > 0;
    return {
      locked,
      attempts: this.getAttemptsSync(),
      remaining: this.getLockoutRemainingSync()
    };
  }

  static async getAttempts(): Promise<number> {
    const status = await this.checkStatus();
    return status.attempts;
  }

  static async getLockoutRemaining(): Promise<number> {
    const status = await this.checkStatus();
    return status.remaining;
  }

  static async isLocked(): Promise<boolean> {
    const status = await this.checkStatus();
    return status.locked;
  }

  // Private helpers for fallback localStorage logic
  private static getAttemptsSync(): number {
    return parseInt(localStorage.getItem('aegis_failed_attempts') || '0');
  }

  private static getLockoutRemainingSync(): number {
    const until = parseInt(localStorage.getItem('aegis_lockout_until') || '0');
    if (!until) return 0;

    const remaining = Math.ceil((until - Date.now()) / 1000);
    if (remaining <= 0) {
      localStorage.removeItem('aegis_lockout_until');
      return 0;
    }
    return remaining;
  }
}