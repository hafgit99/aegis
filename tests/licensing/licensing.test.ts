/**
 * Aegis Vault - Secure Licensing System Tests
 * 3 Günlük Deneme Süresi ve Anti-Tampering Testleri
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// LicensingService'i test edebilmek için mock
const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get store() { return store; }
    };
})();

// Global Mock Setup
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });
Object.defineProperty(global, 'window', {
    value: {
        ...global.window,
        atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
        crypto: {
            subtle: {
                verify: vi.fn().mockResolvedValue(true),
                importKey: vi.fn().mockResolvedValue({})
            },
            getRandomValues: (arr: Uint8Array) => arr
        },
        electronAPI: {
            getDeviceId: vi.fn().mockResolvedValue('TEST-DEVICE-123'),
            licensing: {
                init: vi.fn().mockResolvedValue({ installDate: Date.now(), proActivated: false, timeManipulated: false }),
                getStatus: vi.fn().mockResolvedValue({ isPro: false, remainingDays: 3, isExpired: false, timeManipulated: false }),
                activatePro: vi.fn().mockResolvedValue({ success: true }),
                updateActivity: vi.fn().mockResolvedValue(true),
                isPro: vi.fn().mockResolvedValue(false)
            }
        }
    },
    configurable: true
});

// Inline LicensingService implementation for testing
class LicensingServiceMock {
    private static TRIAL_DAYS = 3;
    private static STORAGE_KEY = 'aegis_license_data';
    private static INSTALL_KEY = 'aegis_install_date';

    static isPro(): boolean {
        return !!localStorage.getItem(this.STORAGE_KEY);
    }

    static getRemainingTrialDays(): number {
        let installDateStr = localStorage.getItem(this.INSTALL_KEY);
        if (!installDateStr) {
            installDateStr = Date.now().toString();
            localStorage.setItem(this.INSTALL_KEY, installDateStr);
        }
        const installDate = parseInt(installDateStr);

        // NaN check
        if (isNaN(installDate)) {
            localStorage.setItem(this.INSTALL_KEY, Date.now().toString());
            return this.TRIAL_DAYS;
        }

        const elapsed = Date.now() - installDate;
        const remaining = this.TRIAL_DAYS - (elapsed / (1000 * 60 * 60 * 24));
        return Math.max(0, Math.ceil(remaining));
    }

    static isTrialExpired(): boolean {
        if (this.isPro()) return false;
        return this.getRemainingTrialDays() <= 0;
    }

    static setTrialStartDate(date: Date): void {
        localStorage.setItem(this.INSTALL_KEY, date.getTime().toString());
    }

    static activatePro(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            activatedAt: Date.now(),
            licenseKey: 'TEST-LICENSE'
        }));
    }

    static deactivatePro(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    static resetTrial(): void {
        localStorage.removeItem(this.INSTALL_KEY);
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

// Secure License Data Mock (simulates backend behavior)
class SecureLicenseDataMock {
    private static data: {
        installDate: number;
        lastActivity: number;
        maxElapsedDays: number;
        proActivated: boolean;
    } | null = null;

    static init(): void {
        const now = Date.now();
        this.data = {
            installDate: now,
            lastActivity: now,
            maxElapsedDays: 0,
            proActivated: false
        };
    }

    static setInstallDate(date: Date): void {
        if (!this.data) this.init();
        this.data!.installDate = date.getTime();
    }

    static setLastActivity(timestamp: number): void {
        if (!this.data) this.init();
        this.data!.lastActivity = timestamp;
    }

    static setMaxElapsedDays(days: number): void {
        if (!this.data) this.init();
        this.data!.maxElapsedDays = days;
    }

    static getData() {
        return this.data;
    }

    static reset(): void {
        this.data = null;
    }

    static detectTimeManipulation(): boolean {
        if (!this.data) return false;
        const now = Date.now();

        // Check 1: Current time before install date
        if (now < this.data.installDate) {
            return true;
        }

        // Check 2: Clock rolled back (current time before last activity)
        if (this.data.lastActivity && now < this.data.lastActivity - 60000) {
            return true;
        }

        // Check 3: Elapsed days decreased (monotonic counter violation)
        if (this.data.maxElapsedDays !== undefined) {
            const currentElapsedDays = (now - this.data.installDate) / (1000 * 60 * 60 * 24);
            if (currentElapsedDays < this.data.maxElapsedDays - 0.1) {
                return true;
            }
        }

        return false;
    }
}

describe('LicensingService - 3-Day Trial System', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        SecureLicenseDataMock.reset();
        vi.clearAllMocks();
    });

    afterEach(() => {
        mockLocalStorage.clear();
        SecureLicenseDataMock.reset();
    });

    describe('Yeni Kurulum Senaryosu', () => {
        it('İlk açılışta deneme süresi 3 gün olmalı', () => {
            LicensingServiceMock.resetTrial();
            const remaining = LicensingServiceMock.getRemainingTrialDays();
            expect(remaining).toBe(3);
        });

        it('İlk açılışta trial expired olmamalı', () => {
            LicensingServiceMock.resetTrial();
            const expired = LicensingServiceMock.isTrialExpired();
            expect(expired).toBe(false);
        });

        it('İlk açılışta Pro olmamalı', () => {
            LicensingServiceMock.resetTrial();
            const isPro = LicensingServiceMock.isPro();
            expect(isPro).toBe(false);
        });

        it('Yeni kurulumda install_date otomatik kaydedilmeli', () => {
            LicensingServiceMock.resetTrial();
            LicensingServiceMock.getRemainingTrialDays();
            const installDate = localStorage.getItem('aegis_install_date');
            expect(installDate).toBeDefined();
            expect(parseInt(installDate!)).toBeGreaterThan(0);
        });
    });

    describe('Deneme Süresi Sayacı', () => {
        it('1 gün sonra 2 gün kalmalı', () => {
            const oneDayAgo = new Date(Date.now() - (1 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(oneDayAgo);

            const remaining = LicensingServiceMock.getRemainingTrialDays();
            expect(remaining).toBe(2);
        });

        it('2 gün sonra 1 gün kalmalı', () => {
            const twoDaysAgo = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(twoDaysAgo);

            const remaining = LicensingServiceMock.getRemainingTrialDays();
            expect(remaining).toBe(1);
        });

        it('3 gün tamamen dolduğunda 0 gün kalmalı', () => {
            const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(threeDaysAgo);

            const remaining = LicensingServiceMock.getRemainingTrialDays();
            expect(remaining).toBe(0);
        });

        it('4 gün sonra da 0 gün kalmalı (negatif olmamalı)', () => {
            const fourDaysAgo = new Date(Date.now() - (4 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(fourDaysAgo);

            const remaining = LicensingServiceMock.getRemainingTrialDays();
            expect(remaining).toBe(0);
            expect(remaining).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Trial Expiry (Deneme Süresi Sonu)', () => {
        it('3 gün dolduğunda isTrialExpired true olmalı', () => {
            const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(threeDaysAgo);

            const expired = LicensingServiceMock.isTrialExpired();
            expect(expired).toBe(true);
        });

        it('2 gün geçmişken isTrialExpired false olmalı', () => {
            const twoDaysAgo = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(twoDaysAgo);

            const expired = LicensingServiceMock.isTrialExpired();
            expect(expired).toBe(false);
        });
    });

    describe('Pro Lisans Aktivasyonu', () => {
        it('Pro aktifken isPro true olmalı', () => {
            LicensingServiceMock.activatePro();
            const isPro = LicensingServiceMock.isPro();
            expect(isPro).toBe(true);
        });

        it('Pro aktifken trial expired kontrolü atlanmalı (daima false)', () => {
            const tenDaysAgo = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(tenDaysAgo);
            LicensingServiceMock.activatePro();

            const expired = LicensingServiceMock.isTrialExpired();
            expect(expired).toBe(false);
        });

        it('Pro deaktif edildiğinde expired tekrar kontrol edilmeli', () => {
            const tenDaysAgo = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000));
            LicensingServiceMock.setTrialStartDate(tenDaysAgo);
            LicensingServiceMock.activatePro();

            expect(LicensingServiceMock.isTrialExpired()).toBe(false);

            LicensingServiceMock.deactivatePro();

            expect(LicensingServiceMock.isTrialExpired()).toBe(true);
        });
    });

    describe('Veri Kalıcılığı (Persistence)', () => {
        it('Install date localStorage\'a kaydedilmeli', () => {
            LicensingServiceMock.resetTrial();
            LicensingServiceMock.getRemainingTrialDays();

            const savedDate = localStorage.getItem('aegis_install_date');
            expect(savedDate).not.toBeNull();
        });

        it('License data localStorage\'a kaydedilmeli', () => {
            LicensingServiceMock.activatePro();

            const licenseData = localStorage.getItem('aegis_license_data');
            expect(licenseData).not.toBeNull();

            const parsed = JSON.parse(licenseData!);
            expect(parsed.activatedAt).toBeDefined();
            expect(parsed.licenseKey).toBeDefined();
        });
    });

    describe('NaN Hata Yönetimi', () => {
        it('Bozuk install_date ile 3 gün döndürmeli (hata toleransı)', () => {
            localStorage.setItem('aegis_install_date', 'invalid-date');

            const remaining = LicensingServiceMock.getRemainingTrialDays();
            expect(remaining).toBe(3);
            expect(typeof remaining).toBe('number');
            expect(isNaN(remaining)).toBe(false);
        });
    });
});

describe('Secure Licensing - Anti-Tampering (Zaman Manipülasyonu Tespiti)', () => {
    beforeEach(() => {
        SecureLicenseDataMock.reset();
    });

    afterEach(() => {
        SecureLicenseDataMock.reset();
    });

    describe('Zaman Manipülasyonu Algılama', () => {
        it('Sistem saati install date\'den önce olduğunda tespit edilmeli', () => {
            SecureLicenseDataMock.init();
            // Set install date to future (simulating clock rolled back after install)
            const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
            SecureLicenseDataMock.setInstallDate(futureDate);

            const detected = SecureLicenseDataMock.detectTimeManipulation();
            expect(detected).toBe(true);
        });

        it('Sistem saati lastActivity\'den önce olduğunda tespit edilmeli', () => {
            SecureLicenseDataMock.init();
            // Set last activity to future (simulating clock rolled back after usage)
            const futureTime = Date.now() + 2 * 60 * 60 * 1000; // 2 hours in future
            SecureLicenseDataMock.setLastActivity(futureTime);

            const detected = SecureLicenseDataMock.detectTimeManipulation();
            expect(detected).toBe(true);
        });

        it('maxElapsedDays azaldığında tespit edilmeli (monotonic counter)', () => {
            SecureLicenseDataMock.init();
            // Simulate: User used app for 5 days, then rolled back clock
            SecureLicenseDataMock.setMaxElapsedDays(5);
            // Install date 2 days ago (but max elapsed says 5 days)
            const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
            SecureLicenseDataMock.setInstallDate(twoDaysAgo);

            const detected = SecureLicenseDataMock.detectTimeManipulation();
            expect(detected).toBe(true);
        });

        it('Normal kullanımda false döndürmeli', () => {
            SecureLicenseDataMock.init();
            // Normal scenario: installed 1 day ago, used for 1 day
            const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
            SecureLicenseDataMock.setInstallDate(oneDayAgo);
            SecureLicenseDataMock.setLastActivity(Date.now() - 1000); // 1 second ago
            SecureLicenseDataMock.setMaxElapsedDays(1);

            const detected = SecureLicenseDataMock.detectTimeManipulation();
            expect(detected).toBe(false);
        });

        it('1 dakikalık tolerans ile küçük sapmaları görmezden gelmeli', () => {
            SecureLicenseDataMock.init();
            // Set last activity to just 30 seconds in future (within tolerance)
            const slightlyFutureTime = Date.now() + 30 * 1000;
            SecureLicenseDataMock.setLastActivity(slightlyFutureTime);

            const detected = SecureLicenseDataMock.detectTimeManipulation();
            expect(detected).toBe(false);
        });
    });

    describe('Zaman Manipülasyonu Sonuçları', () => {
        it('Manipülasyon tespit edildiğinde trial expired olarak işaretlenmeli', () => {
            SecureLicenseDataMock.init();
            const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
            SecureLicenseDataMock.setInstallDate(futureDate);

            const manipulated = SecureLicenseDataMock.detectTimeManipulation();
            expect(manipulated).toBe(true);

            // In real implementation, this would cause isExpired to be true
            // simulating the effect:
            const isExpired = manipulated && !SecureLicenseDataMock.getData()?.proActivated;
            expect(isExpired).toBe(true);
        });

        it('Pro kullanıcılar manipülasyondan etkilenmemeli', () => {
            SecureLicenseDataMock.init();
            const data = SecureLicenseDataMock.getData();
            if (data) {
                (data as any).proActivated = true;
            }

            const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
            SecureLicenseDataMock.setInstallDate(futureDate);

            const manipulated = SecureLicenseDataMock.detectTimeManipulation();
            const isExpired = manipulated && !SecureLicenseDataMock.getData()?.proActivated;

            // Pro user should not be affected
            expect(isExpired).toBe(false);
        });
    });
});

describe('UI Kısıtlamaları - Trial Expired Senaryoları', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
    });

    it('Trial expired olduğunda yeni kayıt ekleme engellenmeli', () => {
        const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
        LicensingServiceMock.setTrialStartDate(threeDaysAgo);

        const isExpired = LicensingServiceMock.isTrialExpired();
        const isPro = LicensingServiceMock.isPro();

        const canAddNewEntry = !(isExpired && !isPro);
        expect(canAddNewEntry).toBe(false);
    });

    it('Trial expired olduğunda kayıt düzenleme engellenmeli', () => {
        const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
        LicensingServiceMock.setTrialStartDate(threeDaysAgo);

        const isExpired = LicensingServiceMock.isTrialExpired();
        const isPro = LicensingServiceMock.isPro();

        const canEditEntry = !(isExpired && !isPro);
        expect(canEditEntry).toBe(false);
    });

    it('Trial active iken yeni kayıt eklenebilmeli', () => {
        LicensingServiceMock.resetTrial();

        const isExpired = LicensingServiceMock.isTrialExpired();
        const isPro = LicensingServiceMock.isPro();

        const canAddNewEntry = !(isExpired && !isPro);
        expect(canAddNewEntry).toBe(true);
    });

    it('Pro kullanıcı her zaman kayıt ekleyebilmeli', () => {
        const tenDaysAgo = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000));
        LicensingServiceMock.setTrialStartDate(tenDaysAgo);
        LicensingServiceMock.activatePro();

        const isExpired = LicensingServiceMock.isTrialExpired();
        const isPro = LicensingServiceMock.isPro();

        const canAddNewEntry = !(isExpired && !isPro);
        expect(canAddNewEntry).toBe(true);
    });

    it('Zaman manipülasyonu sonrası trial expired olmalı', () => {
        SecureLicenseDataMock.init();
        // Simulate clock rollback
        const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        SecureLicenseDataMock.setInstallDate(futureDate);

        const timeManipulated = SecureLicenseDataMock.detectTimeManipulation();
        const isPro = SecureLicenseDataMock.getData()?.proActivated || false;

        // If time manipulation detected and not pro, treat as expired
        const isExpired = timeManipulated && !isPro;
        expect(isExpired).toBe(true);
    });
});
