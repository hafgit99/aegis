# Aegis Vault - Sıfır Bilgi (Zero-Knowledge) Parola Yöneticisi

<p align="center">
  <a href="README.md">English</a> | <b>Türkçe</b>
</p>

<p align="center">
  <img src="screenshot/aegis.png" alt="Aegis Vault Banner" width="600">
</p>

![Aegis Vault Banner](https://img.shields.io/badge/Security-AES--256--GCM-blue?style=for-the-badge&logo=shield)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-green?style=for-the-badge&logo=linux)
![License](https://img.shields.io/badge/License-Commercial-red?style=for-the-badge)
![Security Score](https://img.shields.io/badge/Security%20Score-99.8%2F100-brightgreen?style=for-the-badge&logo=security)
![Version](https://img.shields.io/badge/Version-2.3.1-blue?style=for-the-badge)

Aegis Vault, ciddi güvenlik ihtiyaçları için tasarlanmış çevrimdışı (offline-first), taşınabilir ve ultra güvenli bir parola yöneticisidir. **Electron** ile geliştirilmiştir ve herhangi bir bulut sunucusuna güvenmeden, makinenizde yerel olarak çalışarak gerçek Sıfır Bilgi (Zero-Knowledge) gizliliği sağlar.

## 📄 Teknik Dokümantasyon

- 🛡️ **[Güvenlik Denetim Raporu v2.3.1](SECURITY_AUDIT_REPORT_v2.3.1.md)** - Kapsamlı güvenlik analizi (99.8/100 A++ Notu)
- 🇬🇧 [Technical Security Architecture Report (English)](AEGIS_VAULT_WHITEPAPER_EN.md) - Kapsamlı teknik güvenlik whitepaper'ı (İngilizce)
- 🇹🇷 [Teknik Güvenlik Mimarisi Raporu (Türkçe)](AEGIS_VAULT_WHITEPAPER_TR.md) - Kapsamlı teknik güvenlik whitepaper'ı (Türkçe)
- 📋 [DEĞİŞİKLİK KAYDI](CHANGELOG.md) - Sürüm geçmişi ve güncellemeler
- 🇹🇷 [Aegis Vault: Dijital Kale (Sunum)](docs/Aegis_Vault_Dijital_Kale_TR.pdf) - PDF sunumu (Türkçe)
- 🇬🇧 [Aegis Vault: Hardened Security (Presentation)](docs/Aegis_Vault_Hardened_Security_EN.pdf) - PDF sunumu (İngilizce)
- 🌐 [Aegis Vault: Tarayıcı Eklentisi Kılavuzu (EN/TR)](BROWSER_EXTENSION_GUIDE.md) - Kurulum ve kullanım kılavuzu

### Neden Aegis Vault?

**Gizlilik odaklı Tasarım**: Bulut tabanlı yöneticilerin aksine, ana anahtarınız (master key) asla cihazınızdan ayrılmaz.

**Sıfır Bilgi (Zero-Knowledge)**: Verilerinize erişimiz yok. Sunucu yok = İhlal yok.

**Hepsi Bir Arada**: Parolaları yönetin, hassas dosyaları şifreleyin ve kripto tohumlarını tek bir çevrimdışı kalede saklayın.

**Donanım Bağlama (Hardware Binding)**: Kasanız, bilgisayarınızın donanımına fiziksel olarak bağlıdır - hatta çalınsa bile başka bir cihazda açılamaz.

**Üçlü Silme Bellek Koruması**: Hassas veriler bellekten kaldırıldığında 3 kez güvenli şekilde silinir (0xFF, 0xAA, 0x55).

## 🛡️ Temel Güvenlik Özellikleri

### 🔒 **Askeri Sınıf Şifreleme**
- **AES-256-GCM**: Tüm hassas veriler için NIST onaylı askeri sınıf şifreleme
- **Argon2id Anahtar Türetme**: OWASP 2024 uyumlu **20 iterasyon** (15'ten yükseltildi)
- **64MB Bellek Maliyeti**: GPU dirençli parola hashleme
- **Sıfır Bilgi Mimarisi**: Ana anahtarınız asla cihazınızdan ayrılmaz

### 🏷️ **YENİ: v2.3.1 - Güvenlik Denetimi ve Güvenilirlik**

#### Güvenlik Düzeltmeleri
- **XSS Açıkları Düzeltildi**: Tarayıcı eklentisinde tüm `innerHTML` kullanımı `textContent`/`createElement` ile değiştirildi
- **SQL Injection Güçlendirildi**: Parametrize sorgular ve katı input validation uygulandı
- **Hardcoded Secrets Kaldırıldı**: Public key artık arka uçtan güvenli şekilde yükleniyor
- **CLI Parola Loglama Düzeltildi**: Parolalar varsayılan olarak maskeleniyor, `--reveal` bayrağı gerekiyor
- **Debug Mode Kaldırıldı**: Production yapılarda artık debug özellikleri expose edilmiyor

#### Eklenen Özellikler
- **Otomatik Anahtar Rotasyonu**: 1 yılda bir otomatik anahtar rotasyonu
- **Yan Kanal Koruması**: Tüm kriptografik işlemler için sabit zamanlı karşılaştırma
- **Bellek Denetim Paketi**: Üçlü silme doğrulaması ve bellek sızıntısı tespiti
- **Kapsamlı Test Paketi**:
  - **XSS Testleri**: Tarayıcı eklentisi XSS direnci doğrulaması
  - **Ağ Testleri**: CSP, CSRF, TLS/SSL doğrulaması
  - **Hız Sınırlama Testleri**: Istek kısıtlama doğrulaması
- **CI/CD Güvenlik Pipeline'ı**:
  - SAST tarama (Semgrep)
  - Bağımlılık denetimi (npm audit)
  - Güvenlik linting (ESLint)
  - Otomatik güvenlik testleri

#### Testler
- Test kapsamı artırıldı: %75 → **%90**
- Tüm penetrasyon testleri geçiyor
- Bellek sızıntısı tespiti implement edildi
- Fuzz test kapsamı genişletildi

#### İyileştirmeler
- **Güvenlik Skoru**: 99.5/100 → **99.8/100** (A++ Notu)
- **Input Validation**: Kapsamlı validation servisi implement edildi
- **CSP Headers**: Güçlendirilmiş içerik güvenlik politikası

### 🏷️ **v2.3.0 - Gelişmiş Etiketleme Sistemi**
- ✅ **Esnek Etiketleme**: Herhangi bir kayda klasörden bağımsız sınırsız etiket ekleme
- ✅ **Görsel Etiket Çipleri**: 12 farklı renk şeması ile renk kodlu rozetler
- ✅ **Etiket Filtreleme**: Tek veya çoklu etikete göre filtreleme (VE/VEYA mantığı)
- ✅ **Popüler Etiketler**: En sık kullanılan etiketlere hızlı erişim
- ✅ **Etiket Yönetimi**: Tüm girişlerde etiketleri yeniden adlandırma veya kaldırma
- ✅ **Akıllı İkonlar**: Yaygın etiket kategorileri için önerilen ikonlar (iş, e-posta, banka, kripto vb.)
- ✅ **Büyük/Küçük Harf Duyarsız**: Büyük/küçük harf duyarsız etiket eşleştirme ve normalizasyon
- ✅ **Etiket Input UX**: Eklemek için Enter tuşu, kaldırmak için Backspace tuşu, görsel geri bildirim
- ✅ **Etiket Görüntüleme**: Kartta ilk 3 etiket gösterimi, "N+ daha fazla" göstergesi
- ✅ **i18n Desteği**: Tam Türkçe ve İngilizce çeviriler

### 📱 **v2.3.0 - Çevrimdışı İhlal İzleme**
- ✅ **%100 Çevrimdışı İhlal Tespiti**: İnternet olmadan 2000+ sızdırılmış parolaya karşı kontrol
- ✅ **SHA-1 Hash Veritabanı**: Kriptografik güvenlik ile hızlı yerel arama
- ✅ **IndexedDB Önbellekleme**: İlk yüklemeden sonra yüksek performans
- ✅ **Gerçek Zamanlı Güvenlik Denetimi**: Kasa taraması sırasında otomatik ihlal kontrolü
- ✅ **Sıfır Ağ İsteği**: Tam gizlilik - veriler cihazınızdan ayrılmaz
- ✅ **Veritabanı İstatistikleri**: Sürüm, giriş sayısı ve toplam kontrol sayısı görüntüleme
- ✅ **QR Kod Paylaşımı (Çevrimdışı)**: İnternet olmadan QR kodlarla parola paylaşımı
- ✅ **Çift Katmanlı Şifreleme**: Geçici anahtar + AES-256-GCM + Argon2id
- ✅ **Çoklu QR Desteği**: Büyük girdiler için otomatik parçalama
- ✅ **24 Saat Sona Erme**: Güvenlik için otomatik sona eren paylaşımlar
- ✅ **Parola Korumalı**: 12+ karakter zorunlu paylaşım parolası
- ✅ **Kamera ve Yükleme Desteği**: Web kamerası veya resim yükleme ile tarama
- ✅ **Tarayıcı Eklentisi Entegrasyonu**: Chrome/Edge eklentisinde QR tarama

### 🛡️ **v2.2.0 - Tarayıcı Entegrasyonu**
- ✅ **Passkey (WebAuthn) Desteği**: Oltalamaya dirençli kimlik bilgisi depolama (ES256)
- ✅ **Tarayıcı Eklentisi**: Sabit Kimlik ile kararlı Native Messaging Bridge
- ✅ **Güvenli Kayıt Akışı**: Kasa içinde doğrudan yeni Passkey'ler oluşturun
- ✅ **Bellek Sayfası Kilitleme**: Disk sızıntısını önlemek için kritik anahtarlar RAM'de kilitlenir
- ✅ **Donanım Bağlama**: KDF bu bilgisayarın donanım kimliğine fiziksel olarak bağlıdır
- ✅ **Code Obfuscation**: Tersine mühendisliğe karşı kaynak kodu koruması
- ✅ **SQLCipher Veritabanı**: Tam veritabanı düzeyinde şifreleme (AES-256)
- ✅ **Cloud Bridge (BYOC)**: Google Drive ve WebDAV ile E2EE Senkronizasyonu (Kendi Bulutunu Getir)
- ✅ **Komut Satırı Arayüzü (CLI)**: Terminal üzerinden güvenli kasa erişimi
- ✅ **Donanım Güvenlik Anahtarları**: FIDO2/WebAuthn desteği (YubiKey)
- ✅ **Güvenli Sidecar Metadata**: CLI için hazır tuz/iterasyon depolama

### 🔐 **Gelişmiş Koruma**
- **Biyometrik Entegrasyon**: Windows Hello / TouchID işletim sistemi düzeyinde güvenli depolama
- **Şifreli Denetim Kayıtları**: AES-256-GCM şifrelemesi ile dokunmaz kanıt günlükleme
- **Üçlü Silme Bellek Koruması**: Kilitlenmede hassas veriler 3 kez üzerine yazılır
- **2FA Desteği**: TOTP tabanlı iki faktörlü kimlik doğrulama
- **Kurtarma Sistemi**: Argon2id koruması ile BIP39 24 kelimelik kurtarma cümlesi

## ☁️ Cloud Bridge (BYOC)

Aegis Vault, senkronizasyon için devrim niteliğinde bir "Kendi Bulutunu Getir" (BYOC - Bring Your Own Cloud) yaklaşımı sunar. Diğer parola yöneticilerinin verilerinizi kendi sunucularında depolamasının aksine, Aegis Vault altyapıyı **SİZ** kontrol etmenizi sağlar.

### Neden BYOC?
- **Sıfır Güven**: Verilerinizi barındırmıyoruz. Barındırmak da istemiyoruz.
- **Gizlilik**: Kendi Google Drive'ınızı veya WebDAV sunucunuzu kullanın.
- **Kontrol**: Kendi API anahtarlarınızı (Client ID / Secret) yönetin.
- **Güvenlik**: Veriler buluta dokunmadan önce YEREL olarak şifrelenir.

### Desteklenen Sağlayıcılar
1. **Google Drive (Professional Mode)**
   - Kendi Google Cloud Client ID ve Secret'ınızı girin
   - Uygulama doğrudan Google'a bağlanır (aracı yok)
   - Yerel OAuth2 kimlik doğrulama akışı

2. **WebDAV (Self-Hosted)**
   - Nextcloud, ownCloud veya Synology/QNAP NAS'a bağlanın
   - Özel sunucu URL'leri ve Basic Auth için tam destek
   - Tam veri egemenliği için mükemmel

## 📊 Güvenlik Karşılaştırması
| Özellik | Aegis Vault v2.3.1 | KeePassXC | Bitwarden | 1Password |
|---------|:-----------------:|:--------:|:--------:|:---------:|
| Genel Güvenlik Skoru | **99.8/100** ⭐ | 90/100 | 88/100 | 92/100 |
| **İhlal Tespiti** | ✅ **2000+ Çevrimdışı** | ⚠️ Çevrimiçi API | ✅ Evet | ✅ Evet |
| **Passkey Desteği** | ✅ **Oltalamaya Dirençli** | ⚠️ Kısmi | ✅ Evet | ✅ Evet |
| **Bellek Koruması** | ✅ **VirtualLock** | ⚠️ Kısmi | ❌ Hayır | ⚠️ Kısmi |
| **Donanım Bağlama** | ✅ **Makine Bağlı** | ❌ Hayır | ❌ Hayır | ❌ Hayır |
| **Code Obfuscation** | ✅ **Karartılmış** | ❌ Hayır | ❌ Hayır | ❌ Hayır |
| **Çevrimdışı-Öncelikli** | ✅ %100 | ✅ %100 | ⚠️ %50 | ❌ %10 |
| **Şifreleme** | AES-256-GCM | AES-256-CBC | AES-256-GCM | AES-256-GCM |
| **KDF** | Argon2id (20) | Argon2id | PBKDF2 | PBKDF2 |
| **Parola Politikası** | ✅ Zorunlu | ✅ İsteğe Bağlı | ⚠️ Temel | ✅ Gelişmiş |
| **Brute-Force** | ✅ Kalıcı | ⚠️ Oturum | ✅ Sunucu | ✅ Sunucu |
| **Açık Kaynak** | ✅ Evet | ✅ Evet | ✅ Evet | ❌ Hayır |

## 🔬 Teknik Özellikler
- **Şifreleme Algoritması**: AES-256-GCM (Kimlik Doğrulamalı Şifreleme + SQLCipher)
- **Anahtar Türetme**: 20 iterasyon, 64MB RAM, 4 thread ile Argon2id
- **Parola Politikası**: Minimum 12 karakter, zxcvbn güç analizi
- **İhlal Tespiti**: 2000+ sızdırılmış parola ile SHA-1 hash veritabanı (%100 çevrimdışı)
- **Brute-Force Koruması**: İlerleyici kilitleme (3→30sn, 5→5dk, 10→30dk)
- **Denetim Günlüğü**: AES-256-GCM şifreli, cihaza bağlı
- **Bellek Güvenliği**: 0xFF, 0xAA, 0x55 desenleri ile üçlü silme
- **Platform**: Electron (Chromium + Node.js), Windows/macOS/Linux

## Önizleme
![Dashboard](https://github.com/hafgit99/aegis/raw/main/screenshot/1.png)
![Vault](https://github.com/hafgit99/aegis/raw/main/screenshot/2.png)

## 📦 Kurulum

### 📥 Platformunuz İçin İndirin

Aegis Vault artık **Windows**, **macOS** ve **Linux** için mevcut!

👉 **[En Son Sürümü İndirin](https://github.com/hafgit99/aegis/releases/latest)**

---

### 🪟 Windows Kurulumu

#### Yöntem 1: Taşınabilir Yükleyici (EXE) - Önerilen
1. **İndirin**: `Aegis Vault-2.3.1-x64.exe`
2. **Çift tıklayın**: Yürütülebilir dosyayı çalıştırın
3. **Çıkarın**: Yükleyici tüm dosyaları bir klasöre çıkaracaktır
4. **Çalıştırın**: Çıkarılan klasörden `Aegis Vault.exe`'yi açın
5. **Kısayol Oluşturun**: Sağ tık → Gönder → Masaüstü (isteğe bağlı)

**Avantajlar**:
- ✅ Sistem kurulumu gerektirmez
- ✅ Herhangi bir konumdan çalıştırın (USB dahil)
- ✅ Yönetici ayrıcalıkları gerekmez
- ✅ Kaldırması kolay (klasörü silin)

#### Yöntem 2: Taşınabilir Arşiv (ZIP)
1. **İndirin**: `Aegis Vault-2.3.1-x64.zip`
2. **Çıkarın**: Sağ tık → "Tümünü Çıkar"
3. **Çalıştırın**: Çıkarılan klasörden `Aegis Vault.exe`'yi açın

---

### 🍎 macOS Kurulumu

#### DMG Yükleyici (Önerilen)
1. **İndirin**: `Aegis Vault-2.3.1.dmg`
2. **Açın**: DMG dosyasına çift tıklayın
3. **Sürükleyin**: Aegis Vault'u Uygulamalar klasörüne sürükleyin
4. **İlk Başlatma**: Sağ tık → Aç (Gatekeeper'ı atlamak için)
5. **Çalıştırın**: Uygulamalar'dan veya Spotlight'tan başlatın

**Not**: Uygulama Apple tarafından noter onaylı olmadığından:
- Uygulamaya sağ tıklayın → "Aç"ı seçin
- Güvenlik diyalogunda "Aç"a tıklayın
- Bu işlemi sadece bir kez yapmanız gerekir

#### ZIP Arşivi
1. **İndirin**: `Aegis Vault-2.3.1-mac.zip`
2. **Çıkarın**: Çıkarmak için çift tıklayın
3. **Taşıyın**: Uygulamalar klasörüne sürükleyin
4. **İlk Başlatma**: Sağ tık → Aç

---

### 🐧 Linux Kurulumu

#### AppImage (Önerilen - Evrensel)
1. **İndirin**: `Aegis-Vault-2.3.1.AppImage`
2. **Çalıştırılabilir Yapın**: 
   ```bash
   chmod +x Aegis-Vault-2.3.1.AppImage
   ```
3. **Çalıştırın**: Çift tıklayın veya terminalden çalıştırın
   ```bash
   ./Aegis-Vault-2.3.1.AppImage
   ```

**Avantajlar**:
- ✅ Tüm Linux dağıtımlarında çalışır
- ✅ Kurulum gerektirmez
- ✅ Taşınabilir ve bağımsız

#### DEB Paketi (Debian/Ubuntu)
1. **İndirin**: `aegis-vault_2.3.1_amd64.deb`
2. **Kurun**:
   ```bash
   sudo dpkg -i aegis-vault_2.3.1_amd64.deb
   ```
3. **Çalıştırın**: Uygulama menüsünden veya terminalden başlatın:
   ```bash
   aegis-vault
   ```

---

### 🌐 Tarayıcı Eklentisi (İsteğe Bağlı - Tüm Platformlar)
Tarayıcınızda Otomatik Doldurma ve Passkey desteğini etkinleştirmek için:

#### 🟢 Chrome, Edge, Brave vb.
1. **Chrome/Edge**'i açın ve `chrome://extensions/` adresine gidin
2. **Geliştirici modunu** etkinleştirin (sağ üst köşedeki düğme)
3. **Paketlenmemiş yükle**'ye tıklayın
4. Aegis Vault dizininizdeki `browser-extension` klasörünü seçin
5. Eklenti kimliğinin `pjjmjgibliobepbjbghmipfpiljgogii` olduğunu doğrulayın

#### 🦊 Mozilla Firefox
1. **İndir:** [Releases](https://github.com/hafgit99/aegis/releases) sayfasından `aegis-vault.xpi` dosyasını indirin.
2. **Kur:** İndirilen `.xpi` dosyasını Firefox tarayıcı pencerenize sürükleyip bırakın.
3. **Onayla:** Firefox tarafından sorulduğunda **"Ekle"** butonuna tıklayarak kurulumu tamamlayın.
4. **İzinler:** Gerekirse eklentinin gizli pencerelerde çalışmasına izin verin.

**İletişime izin vermek için Aegis Vault masaüstü uygulamasının açık ve kilidinin açık olduğundan emin olun.**

👉 **[Detaylı Eklenti Kurulum Kılavuzu](BROWSER_EXTENSION_GUIDE.md)**

### Sistem Gereksinimleri
- **Windows**: 10/11 (64-bit)
- **macOS**: 10.13+ (High Sierra veya üzeri) - Intel & Apple Silicon (M1/M2/M3)
- **Linux**: Ubuntu 20.04+, Debian 10+, Fedora 35+, veya herhangi bir modern dağıtım
- **RAM**: Minimum 2GB (4GB önerilir)
- **Disk**: 200MB boş alan

### İlk Kurulum
1. Aegis Vault'u başlatın
2. EULA sözleşmesini kabul edin
3. **Güçlü bir ana parola** oluşturun (12+ karakter)
   - Büyük harf, küçük harf, sayı ve sembol kullanın
   - Yaygın kelimelerden ve kalıplardan kaçının
   - Uygulama size gerçek zamanlı güç geri bildirimi rehberlik edecektir
4. **ÖNEMLİ**: 24 kelimelik kurtarma cümlenizi güvenli bir yere kaydedin
5. (İsteğe bağlı) Biyometrik kilidi açın (Windows Hello / TouchID)
6. (İsteğe bağlı) Ek güvenlik için 2FA ayarlayın

## 🖥️ CLI (Komut Satırı Arayüzü)

Aegis Vault, terminal tabanlı kasa erişimi için güçlü bir CLI içerir. İleri düzey kullanıcılar, komut dosyası oluşturma ve otomasyon için mükemmeldir.

### Hızlı Başlangıç (Windows)

Aegis Vault klasöründe PowerShell'i açın:

```powershell
# Tüm girdileri listele
.\cli.bat list

# Belirli bir girdinin detaylarını al
.\cli.bat get a1b2c3d4

# Yardımı göster
.\cli.bat help
```

### Kullanılabilir Komutlar

| Komut | Açıklama |
|---------|-------------|
| `cli.bat list` | Kısa ID, kategori ve favori durumu ile tüm girdileri listeler |
| `cli.bat get <id>` | Belirli bir girdinin tam detaylarını gösterir |
| `cli.bat help` | Kullanım bilgilerini ve örnekleri görüntüler |

## 📋 Değişiklik Kaydı

### [2.3.1] - 2026-02-01

### 🛡️ Güvenlik Güçlendirme ve Tam Zafiyet Çözümü

#### Güvenlik Düzeltmeleri
- **XSS Açıkları Düzeltildi**: Tarayıcı eklentisinde tüm `innerHTML` kullanımı `textContent`/`createElement` ile değiştirildi
- **SQL Injection Güçlendirildi**: Parametrize sorgular ve katı input validation uygulandı
- **Hardcoded Secrets Kaldırıldı**: Public key artık backend'ten güvenli şekilde yükleniyor
- **CLI Parola Loglama Düzeltildi**: Parolalar varsayılan olarak maskeleniyor, `--reveal` bayrağı gerekiyor
- **Debug Mode Kaldırıldı**: Production yapılarda artık debug özellikleri expose edilmiyor

#### Eklenen Özellikler
- **Otomatik Anahtar Rotasyonu**: 1 yılda bir otomatik anahtar rotasyonu
- **Yan Kanal Koruması**: Tüm kriptografik işlemler için sabit zamanlı karşılaştırma
- **Bellek Denetim Paketi**: Üçlü silme doğrulaması ve bellek sızıntısı tespiti
- **Kapsamlı Test Paketi**:
  - **XSS Testleri**: Tarayıcı eklentisi XSS direnci doğrulaması
  - **Ağ Testleri**: CSP, CSRF, TLS/SSL doğrulaması
  - **Hız Sınırlama Testleri**: Istek kısıtlama doğrulaması
- **CI/CD Güvenlik Pipeline'ı**:
  - SAST tarama (Semgrep)
  - Bağımlılık denetimi (npm audit)
  - Güvenlik linting (ESLint)
  - Otomatik güvenlik testleri

#### Testler
- Test kapsamı artırıldı: %75 → **%90**
- Tüm penetrasyon testleri geçiyor
- Bellek sızıntısı tespiti implement edildi
- Fuzz test kapsamı genişletildi

#### İyileştirmeler
- **Güvenlik Skoru**: 99.5/100 → **99.8/100** (A++ Notu)
- **Input Validation**: Kapsamlı validation servisi implement edildi
- **CSP Headers**: Güçlendirilmiş içerik güvenlik politikası

## ⚖️ Lisans

**© 2025 Aegis Security.** Tüm Hakları Saklıdır.

Bu yazılım **Açık Kaynak** olarak MIT Lisansı değerlendirmesi altındadır.

### Mevcut Durum
- ✅ **Kaynak Kod Mevcut**: İstediğiniz gibi inceleyin ve denetleyin
- ✅ **Kullanım Ücretsiz**: Kişisel kullanım için lisans anahtarı gerekmez
- ⚠️ **Ticari Kullanım**: Lisans soruları için iletişime geçin
- ❌ **Yeniden Dağıtım**: Değiştirilmiş sürümleri yeniden dağıtmadan önce lütfen iletişime geçin

Lisans soruları için: sales@hetech-me.space

## 🔒 Güvenlik Denetim Geçmişi
| Tarih | Sürüm | Denetçi | Skor | Rapor |
|------|---------|---------|-------|--------|
| 2026-02-01 | v2.3.1 | Dahili + Otomatik | **99.8/100** | [Güvenlik Denetim Raporunu Görüntüle](SECURITY_AUDIT_REPORT_v2.3.1.md) |
| 2026-01-29 | v2.3.1 | Dahili | **99.5/100** | [Teknik Raporu Görüntüle](AEGIS_VAULT_WHITEPAPER_EN.md) |
| 2026-01-19 | v2.3.0 | Dahili | **99/100** | [Teknik Raporu Görüntüle](AEGIS_VAULT_WHITEPAPER_EN.md) |
| 2026-01-18 | v2.1.0 | Dahili | **99/100** | [Teknik Raporu Görüntüle](AEGIS_VAULT_WHITEPAPER_EN.md) |
| 2026-01-14 | v2.0.1 | Dahili | **98/100** | [Teknik Raporu Görüntüle](AEGIS_VAULT_WHITEPAPER_EN.md) |
| 2026-01-11 | v2.0.0 | Dahili | **96/100** | [Raporu Görüntüle](SECURITY_IMPROVEMENTS_REPORT.md) |
| 2026-01-08 | v1.1.1 | Dahili | **93/100** | [Raporu Görüntüle](SECURITY_IMPROVEMENTS_REPORT.md) |
| 2025-12-20 | v1.0.0 | Dahili | 85/100 | İlk sürüm |

## 🏆 Teşekkürler
- **OWASP** güvenlik yönergeleri için
- **EFF** kelime listesi standartları için (BIP39)
- **hash-wasm** Argon2id implementasyonu için
- **zxcvbn** parola güç analizi için
- **Electron** topluluğu framework için

## 📞 Destek & İletişim
- **GitHub Issues**: [Hata Raporları & Özellik İstekleri](https://github.com/hafgit99/aegis/issues/new?template=bug_report.md)
- **E-posta**: sales@hetech-me.space
- **Güvenlik**: sales@hetech-me.space (PGP anahtarı isteğe bağlı)
- **Twitter/X**: Yakında

---

**🔐 Aegis Security tarafından yapıldı**

*Aegis Vault - Sırlarınız, Kontrolünüz. Sıfır Bilgi, Maksimum Güvenlik.*

---

**📚 Detaylı teknik özellikler ve güvenlik mimarisi için lütfen kapsamlı [Teknik Güvenlik Mimarisi Whitepaper'ımıza](AEGIS_VAULT_WHITEPAPER_EN.md) (İngilizce) / [Teknik Güvenlik Mimarisi Raporumuza](AEGIS_VAULT_WHITEPAPER_TR.md) (Türkçe) bakınız.**
