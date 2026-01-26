import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, BookOpen, Shield, Lock, Key, Folder, Tag, Search, Download, Upload, Eye, Smartphone, AlertTriangle, Settings, HelpCircle, ShieldCheck, Fingerprint, QrCode } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface GuideSection {
  id: string;
  title: string;
  titleTr: string;
  description: string;
  descriptionTr: string;
  icon: React.ReactNode;
  details: string;
  detailsTr: string;
}

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const { lang } = useLanguage();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      titleTr: 'Başlarken',
      description: 'Learn the basics of Aegis Vault',
      descriptionTr: 'Aegis Vault\'ın temellerini öğrenin',
      icon: <BookOpen size={24} className="text-blue-500" />,
      details: `1. Create Your Vault
Create a strong Master Password that will be the only key to decrypt your data. Make it memorable and secure.

2. Set Up Recovery Words
Immediately generate and safely store your 16 Recovery Words. These are your backup if you forget your Master Password. Store them in a secure physical location.

3. Understand the Structure
- Vault: Your main password storage
- Folders: Organize items into categories
- Tags: Add custom labels for quick filtering
- Categories: System categories (Login, Card, Note, Identity, Server, File)`,
      detailsTr: `1. Kasanızı Oluşturun
Verilerinizin şifresini çözmek için tek anahtar olacak güçlü bir Ana Şifre oluşturun. Hatırlanabilir ve güvenli olmalıdır.

2. Kurtarma Sözcüklerini Ayarlayın
Hemen 16 Kurtarma Sözcüğü oluşturun ve güvenle saklayın. Ana Şifrenizi unutmanız durumunda kasanızı kurtarmanın tek yöntemidir. Bunları güvenli bir fiziksel yerde güvenle saklayın.

3. Yapıyı Anlayın
- Kasa: Ana parola depolama alanı
- Klasörler: Öğeleri kategorilere göre düzenleyin
- Etiketler: Hızlı filtreleme için özel etiketler ekleyin
- Kategoriler: Sistem kategorileri (Giriş, Kart, Not, Kimlik, Sunucu, Dosya)`
    },
    {
      id: 'storing-secrets',
      title: 'Storing Your Secrets',
      titleTr: 'Sırlarınızı Depolama',
      description: 'How to securely store different types of data',
      descriptionTr: 'Farklı veri türlerini güvenle depolamak',
      icon: <Lock size={24} className="text-green-500" />,
      details: `Add Different Types of Secrets:

1. Login Credentials
- Username/Email: Your login identifier
- Password: Use the Password Generator for strong passwords
- Website URL: Direct link to the service
- Notes: Additional information

2. Credit Cards
- Card Number: Full card number (encrypted locally)
- Expiry Date: MM/YY format
- CVV: Security code
- Cardholder Name: Name on card

3. Secure Notes
- Free-form text storage
- Perfect for sensitive information
- Fully encrypted like other items

4. Identity Information
- Names, addresses, phone numbers
- Personal identification details
- All encrypted locally

5. Server Credentials
- Hostnames and IPs
- SSH keys and tokens
- Database credentials

6. Secure Files
- Encrypt up to 5MB files
- PDFs, documents, images
- Stored as encrypted attachments

7. Crypto Wallets
- Wallet Name: Identify your different wallets
- Network: Ethereum, Bitcoin, Solana, etc.
- Public Address: Your shareable wallet address
- Seed Phrase: Your 12 or 24 recovery words (masked)
- Private Key: Direct access key (AES-256 encrypted)`,
      detailsTr: `Farklı Sır Türleri Ekleyin:

1. Giriş Kimlik Bilgileri
- Kullanıcı Adı/E-posta: Giriş kimliğiniz
- Parola: Güçlü parolalar için Parola Üreteci kullanın
- Web Sitesi URL'si: Hizmete doğrudan bağlantı
- Notlar: Ek bilgiler

2. Kredi Kartları
- Kart Numarası: Tam kart numarası (yerel şifreli)
- Son Kullanma Tarihi: AA/YY biçimi
- CVV: Güvenlik kodu
- Kart Sahibinin Adı: Kart üzerindeki ad

3. Güvenli Notlar
- Serbest metin depolama
- Hassas bilgiler için ideal
- Diğer öğeler gibi tamamen şifreli

4. Kimlik Bilgileri
- Adlar, adresler, telefon numaraları
- Kişisel kimlik bilgileri
- Tümü yerel olarak şifreli

5. Sunucu Kimlik Bilgileri
- Sunucu adları ve IP'ler
- SSH anahtarları ve jetonları
- Veritabanı kimlik bilgileri

6. Güvenli Dosyalar
- 5MB'ye kadar dosyaları şifreleyin
- PDF'ler, belgeler, resimler
- Şifreli ekler olarak depolanır

7. Kripto Cüzdanları
- Cüzdan Adı: Farklı cüzdanlarınızı tanımlayın
- Ağ: Ethereum, Bitcoin, Solana vb.
- Açık Adres: Paylaşılabilir cüzdan adresiniz
- Tohum İfadeler: 12 veya 24 kelimelik kurtarma kelimeleri
- Özel Anahtar: Doğrudan erişim anahtarı (AES-256 şifreli)`
    },
    {
      id: 'organization',
      title: 'Organization & Management',
      titleTr: 'Düzenleme ve Yönetim',
      description: 'Keep your vault organized and accessible',
      descriptionTr: 'Kasanızı organize ve erişilebilir tutun',
      icon: <Folder size={24} className="text-purple-500" />,
      details: `Organize Your Data Effectively:

1. Using Folders
- Create custom folders for different areas (Work, Personal, Finance)
- Move items between folders easily
- View all items in a folder at once

2. Using Tags
- Add multiple tags to items
- Tags are searchable and filterable
- Examples: Important, Work, Banking, Social

3. Search & Filter
- Search by name, tags, or fields
- Use filters to narrow results
- Favorites for quick access to frequently used items

4. Favorites System
- Star items for quick access
- Separate favorites view available
- Ideal for daily-use credentials

5. Sorting Options
- Sort by title (A-Z or Z-A)
- Sort by recent modifications
- Organize by importance

6. Custom Fields
- Add extra information to any item
- Examples: Security questions, backup codes, recovery contacts
- Fully encrypted like all other data`,
      detailsTr: `Verilerinizi Etkili Bir Şekilde Düzenleyin:

1. Klasörleri Kullanma
- Farklı alanlar için özel klasörler oluşturun (İş, Kişisel, Finans)
- Öğeleri klasörler arasında kolayca taşıyın
- Bir klasördeki tüm öğeleri aynı anda görüntüleyin

2. Etiketleri Kullanma
- Öğelere birden çok etiket ekleyin
- Etiketler aranabilir ve filtrelenebilir
- Örnekler: Önemli, İş, Bankacılık, Sosyal

3. Arama ve Filtreleme
- Ad, etiket veya alanlara göre arama yapın
- Sonuçları daraltmak için filtreleri kullanın
- Sık kullanılan öğelere hızlı erişim için Favoriler

4. Favoriler Sistemi
- Hızlı erişim için öğeleri yıldızlayın
- Ayrı favoriler görünümü mevcuttur
- Günlük kullanılan kimlik bilgileri için ideal

5. Sıralama Seçenekleri
- Başlığa göre sırala (A-Z veya Z-A)
- Son değişikliklere göre sırala
- Önem düzeyine göre düzenle

6. Özel Alanlar
- Herhangi bir öğeye ekstra bilgi ekleyin
- Örnekler: Güvenlik soruları, yedekleme kodları, kurtarma kişileri
- Diğer tüm veriler gibi tamamen şifreli`
    },
    {
      id: 'security-features',
      title: 'Security Features',
      titleTr: 'Güvenlik Özellikleri',
      description: 'Protect your vault with advanced security',
      descriptionTr: 'Gelişmiş güvenlik ile kasanızı koruyun',
      icon: <Shield size={24} className="text-red-500" />,
      details: `Advanced Security Options:

1. Master Password
- The only key to unlock your entire vault
- Never transmitted or stored anywhere
- If forgotten, only Recovery Words can help
- Change it anytime from Security settings

2. Two-Factor Authentication (2FA)
- Add an extra security layer
- Use any TOTP-compatible authenticator app
- Required along with Master Password
- Keep recovery codes safe if you lose access

3. Biometric Lock
- Use fingerprint or face recognition
- Quick unlock while maintaining security
- Falls back to Master Password
- Device-managed, not stored by Aegis

4. Security Audit
- Scan for weak passwords
- Identify reused passwords
- Find compromised passwords (using Have I Been Pwned data)
- Get recommendations for improvement

5. Auto-Lock Feature
- Automatically lock after inactivity
- Customizable timeout duration
- Prevents unauthorized access

6. Security Key (YubiKey/WebAuthn)
- Use hardware security keys like YubiKey via USB or NFC
- Cross-platform protection (FIDO2/WebAuthn)
- Strongest prevention against unauthorized physical access
- Can be enabled alongside biometric unlock

7. Panic Mode
- Emergency lock hotkey (F12 or Ctrl+Shift+X)
- Immediately locks vault and hides window
- Perfect for unexpected situations`,
      detailsTr: `Gelişmiş Güvenlik Seçenekleri:

1. Ana Şifre
- Tüm kasanızın kilidini açmanın tek anahtarı
- Asla iletilmez veya saklanmaz
- Unutulursa, yalnızca Kurtarma Sözcükleri yardımcı olabilir
- Güvenlik ayarlarından istediğiniz zaman değiştirin

2. İki Faktörlü Doğrulama (2FA)
- Ekstra bir güvenlik katmanı ekleyin
- Herhangi bir TOTP uyumlu doğrulayıcı uygulaması kullanın
- Ana Şifre ile birlikte gereklidir
- Erişimi kaybederseniz kurtarma kodlarını güvende tutun

3. Biyometrik Kilit
- Parmak izini veya yüz tanımayı kullanın
- Güvenliği korurken hızlı kilit açma
- Ana Şifre'ye geri döner
- Cihaz tarafından yönetilir, Aegis tarafından saklanmaz

4. Güvenlik Denetimi
- Zayıf parolaları tarayın
- Yeniden kullanılan parolaları tanımlayın
- Sızıntıya uğramış parolaları bulun (Have I Been Pwned verilerini kullanarak)
- İyileştirme için öneriler alın

5. Otomatik Kilit Özelliği
- Hareketsizlik sonrası otomatik kilit
- Özelleştirilebilir zaman aşımı süresi
- Yetkisiz erişimi engeller

6. Güvenlik Anahtarı (YubiKey/WebAuthn)
- USB veya NFC üzerinden YubiKey gibi fiziksel anahtarlar kullanın
- Çapraz platform koruması (FIDO2/WebAuthn)
- Yetkisiz fiziksel erişime karşı en güçlü önlem
- Biyometrik kilit ile birlikte veya alternatif olarak kullanılabilir

7. Panik Modu
- Acil durum kilit hotkey'i (F12 veya Ctrl+Shift+X)
- Kasayı hemen kilitler ve pencereyi gizler
- Beklenmeyen durumlar için mükemmel`
    },
    {
      id: 'password-generator',
      title: 'Password Generator',
      titleTr: 'Parola Üreteci',
      description: 'Generate strong, secure passwords',
      descriptionTr: 'Güçlü, güvenli parolalar oluşturun',
      icon: <Key size={24} className="text-yellow-500" />,
      details: `Create Secure Passwords:

1. Generator Modes
- Random Mode: Cryptographically secure random passwords
- Readable Mode: Pronounceable yet secure passwords
- Choose what works for you

2. Customization Options
- Length: 4-128 characters
- Uppercase letters (A-Z)
- Lowercase letters (a-z)
- Numbers (0-9)
- Symbols (!@#$%^&*)

3. Entropy Score
- Shows password strength in bits
- Higher = more secure
- Visual indication of security level

4. Quick Copy
- Generate and copy with one click
- Ready to use immediately
- Word count available for passphrase mode

5. Best Practices
- Minimum 12 characters recommended
- Mix character types for better security
- Use unique password per account
- Let the generator create them for you`,
      detailsTr: `Güvenli Parolalar Oluşturun:

1. Üreteci Modları
- Rastgele Mod: Şifreli olarak güvenli rastgele parolalar
- Okunabilir Mod: Söylenebilir ancak güvenli parolalar
- Sizin için en uygun olanı seçin

2. Özelleştirme Seçenekleri
- Uzunluk: 4-128 karakter
- Büyük harfler (A-Z)
- Küçük harfler (a-z)
- Sayılar (0-9)
- Semboller (!@#$%^&*)

3. Entropi Puanı
- Parola gücünü bit cinsinden gösterir
- Yüksek = daha güvenli
- Güvenlik seviyesinin görsel göstergesi

4. Hızlı Kopyala
- Tek tıkla oluştur ve kopyala
- Hemen kullanıma hazır
- Parola ifadesi modu için sözcük sayısı mevcuttur

5. En İyi Uygulamalar
- Minimum 12 karakter önerilir
- Daha iyi güvenlik için karakter türlerini karıştırın
- Her hesap için benzersiz parola kullanın
- Üreticinin bunları oluşturmasına izin verin`
    },
    {
      id: 'data-backup',
      title: 'Data Backup & Export',
      titleTr: 'Veri Yedekleme ve Dışa Aktarma',
      description: 'Backup and manage your vault data',
      descriptionTr: 'Kasa verilerinizi yedekleyin ve yönetin',
      icon: <Download size={24} className="text-cyan-500" />,
      details: `Protect Your Data:

1. Encrypted Export
- Export entire vault in encrypted format
- Password-protected with your Master Password
- Safe for cloud storage or external drives
- Import later to restore data

2. Plain Text Export
- CSV format for data portability
- Use to migrate to other password managers
- Not encrypted - keep in secure location
- For migration purposes only

3. Backup Strategy
- Regular exports recommended
- Multiple backup copies
- Store backups securely
- One on external drive
- One in secure cloud storage
- Keep original on device

4. Recovery Words Backup
- Export recovery words as JSON
- Contains recovery information
- Highly sensitive - store securely
- Needed if Master Password is forgotten

5. File Organization
- Backups labeled with date
- Easy to identify versions
- Organize backups by date

6. Restore Process
- Import exported encrypted vault
- Enter Master Password to decrypt
- All data restored to original state
- Merge or replace existing vault`,
      detailsTr: `Verilerinizi Koruyun:

1. Şifreli Dışa Aktarma
- Tüm kasayı şifreli biçimde dışa aktarın
- Ana Şifre ile parola korumalı
- Bulut depolama veya dış sürücüler için güvenli
- Verileri geri yüklemek için daha sonra içe aktarın

2. Düz Metin Dışa Aktarma
- Veri taşınabilirliği için CSV biçimi
- Diğer parola yöneticilerine geçiş için kullanın
- Şifrelenmemiş - güvenli yerde tutun
- Yalnızca geçiş amaçları için

3. Yedekleme Stratejisi
- Düzenli dışa aktarmalar önerilir
- Birden çok yedekleme kopyası
- Yedeklemeleri güvenle saklayın
- Biri dış sürücüde
- Biri güvenli bulut depolama alanında
- Özgün'ü cihazda tutun

4. Kurtarma Sözcükleri Yedeklemesi
- Kurtarma sözcüklerini JSON olarak dışa aktarın
- Kurtarma bilgilerini içerir
- Çok hassas - güvenle saklayın
- Ana Şifre unutulduğunda gereklidir

5. Dosya Düzenleme
- Yedeklemeler tarihe göre etiketlendi
- Sürümleri tanımlamak kolay
- Yedeklemeleri tarihe göre düzenleyin

6. Geri Yükleme Süreci
- Dışa aktarılan şifreli kasayı içe aktarın
- Şifresini çözmek için Ana Şifre'yi girin
- Tüm veriler orijinal duruma geri yüklenir
- Mevcut kasayı birleştirin veya değiştirin`
    },
    {
      id: 'privacy',
      title: 'Privacy & Offline',
      titleTr: 'Gizlilik ve Çevrimdışı',
      description: 'Your data never leaves your device',
      descriptionTr: 'Verileriniz asla cihazınızdan ayrılmaz',
      icon: <Eye size={24} className="text-indigo-500" />,
      details: `Complete Privacy Guarantee:

1. Offline-First Design
- Aegis Vault works 100% offline
- No internet connection required
- All processing happens locally on device
- No data ever transmitted

2. Zero Data Collection
- No analytics or telemetry
- No usage tracking
- No personal information collected
- No third-party integrations

3. Local Encryption
- All encryption happens on your device
- Your Master Password never leaves your device
- AES-256-GCM encryption standard
- Military-grade security

4. What Stays Private
- All passwords and credentials
- Personal and financial information
- Custom fields and notes
- File contents

5. What's Not Collected
- Your search history
- Your viewing habits
- Your passwords or vault contents
- Your location or device info
- Your IP address or usage patterns

6. Open Source Approach
- Code available for audit
- No hidden backdoors
- Community can verify security
- Transparent about security implementation`,
      detailsTr: `Tam Gizlilik Garantisi:

1. Çevrimdışı-İlk Tasarım
- Aegis Vault %100 çevrimdışı çalışır
- İnternet bağlantısı gerekli değil
- Tüm işleme cihazınızda yerel olarak gerçekleşir
- Hiçbir veri iletilmez

2. Sıfır Veri Toplama
- Analitik veya telemetri yok
- Kullanım takibi yok
- Kişisel bilgi toplanmaz
- Üçüncü taraf entegrasyonu yok

3. Yerel Şifreleme
- Tüm şifreleme cihazınızda gerçekleşir
- Ana Şifreniz asla cihazınızdan ayrılmaz
- AES-256-GCM şifreleme standardı
- Askeri sınıf güvenlik

4. Gizli Kalan
- Tüm parolalar ve kimlik bilgileri
- Kişisel ve finansal bilgiler
- Özel alanlar ve notlar
- Dosya içerikleri

5. Toplanmayan Veriler
- Arama geçmişiniz
- Görüntüleme alışkanlıklarınız
- Parolalarınız veya kasa içeriğiniz
- Konum veya cihaz bilgileriniz
- IP adresiniz veya kullanım desenleri

6. Açık Kaynak Yaklaşımı
- Denetim için mevcut kod
- Gizli arka kapı yok
- Topluluk güvenliği doğrulayabilir
- Güvenlik uygulaması hakkında şeffaf`
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting & Help',
      titleTr: 'Sorun Giderme ve Yardım',
      description: 'Solutions for common issues',
      descriptionTr: 'Yaygın sorunlar için çözümler',
      icon: <HelpCircle size={24} className="text-orange-500" />,
      details: `Common Issues & Solutions:

1. Forgot Master Password?
- You can recover using Recovery Words
- Go to login screen
- Use "Recovery Words" option
- Enter your 16 recovery words
- Set a new Master Password

2. Lost Recovery Words?
- Generate new ones immediately
- Store them in multiple safe locations
- If forgotten, Master Password becomes critical

3. Locked Out of 2FA?
- Use recovery codes from setup
- If you don't have them, contact support
- Keep recovery codes in secure location

4. Can't Remember 2FA Code?
- Check your authenticator app
- Time-based codes refresh every 30 seconds
- Try entering next code if timeout occurs

5. App Won't Decrypt Data?
- Ensure you entered Master Password correctly
- Check for typos carefully
- Master Password is case-sensitive

6. Performance Issues?
- Large vaults may need optimization
- Archive old unused items
- Keep backups organized
- Restart application if needed

7. File Upload Not Working?
- Check file size (max 5MB)
- Try different file format
- Ensure proper permissions

8. Export/Import Issues?
- Verify file is valid export
- Ensure Master Password is correct
- Check available disk space`,
      detailsTr: `Yaygın Sorunlar ve Çözümler:

1. Ana Şifresini Unuttunuz mu?
- Kurtarma Sözcüklerini kullanarak kurtarabilirsiniz
- Giriş ekranına gidin
- "Kurtarma Sözcükleri" seçeneğini kullanın
- 16 kurtarma sözcüğünüzü girin
- Yeni bir Ana Şifre ayarlayın

2. Kurtarma Sözcüklerini Kaybettiniz mi?
- Hemen yenilerini oluşturun
- Bunları birden çok güvenli yerde depolayın
- Unutulursa, Ana Şifre kritik hale gelir

3. 2FA'dan Kilitli mi?
- Kurulum sırasında kurtarma kodlarını kullanın
- Bunlara sahip değilseniz, destek ekibine başvurun
- Kurtarma kodlarını güvenli yerde saklayın

4. 2FA Kodunu Hatırlamıyor musunuz?
- Doğrulayıcı uygulamanızı kontrol edin
- Zaman tabanlı kodlar her 30 saniyede yenilenir
- Zaman aşımı oluşursa sonraki kodu girmeyi deneyin

5. Uygulama Verilerin Şifresini Çözmüyor?
- Ana Şifre'yi doğru girdiğinizden emin olun
- Yazım hataları için dikkatle kontrol edin
- Ana Şifre büyük/küçük harfe duyarlı

6. Performans Sorunları?
- Büyük kasaların optimizasyona ihtiyacı olabilir
- Eski kullanılmayan öğeleri arşivleyin
- Yedeklemeleri organize tutun
- Gerekirse uygulamayı yeniden başlatın

7. Dosya Yükleme Çalışmıyor?
- Dosya boyutunu kontrol edin (maksimum 5MB)
- Farklı dosya biçimini deneyin
- Uygun izinler olduğundan emin olun

8. Dışa Aktarma/İçe Aktarma Sorunları?
- Dosyanın geçerli bir dışa aktarma olduğunu doğrulayın
- Ana Şifre'nin doğru olduğundan emin olun
- Mevcut disk alanını kontrol edin`
    },
    {
      id: 'hardened-security',
      title: 'Advanced Hardened Security',
      titleTr: 'İleri Seviye Güvenlik Sertleştirme',
      description: 'Physical and code-level protection mechanisms',
      descriptionTr: 'Fiziksel ve kod düzeyinde koruma mekanizmaları',
      icon: <ShieldCheck size={24} className="text-indigo-500" />,
      details: `Professional Grade Security Hardening (v2.0.1+):

1. Memory Page Locking (VirtualLock)
- Physically locks sensitive data (keys, raw passwords) into RAM.
- Prevents the OS from swapping sensitive memory to the disk (Pagefile/Swap).
- Mitigates forensic analysis and cold-boot attack vectors.

2. Hardware Binding (Machine Bound)
- Your vault is tied to this specific computer's hardware.
- Uses Windows DPAPI (Data Protection API) to create a machine-unique secret.
- Even if someone steals your 'vault.db' file, they cannot open it on another machine.

3. Code Obfuscation
- The application's source code is transformed into an unreadable format.
- Protects against reverse engineering and tampering.
- Ensures the integrity of existing security logic.

4. Native Core (Node Addon)
- Critical security functions run in high-performance C++ code.
- Direct interaction with Windows kernel for memory and protection APIs.`,
      detailsTr: `Profesyonel Düzey Güvenlik Sertleştirme (v2.0.1+):

1. Bellek Sayfası Kilitleme (VirtualLock)
- Hassas verileri (anahtarlar, ham şifreler) fiziksel olarak RAM'e kilitler.
- İşletim sisteminin bu verileri diske (Sanal Bellek/Swap) yazmasını engeller.
- Adli bilişim analizleri ve 'cold-boot' saldırı risklerini azaltır.

2. Donanım Bağlama (Machine Bound)
- Kasanız bu bilgisayarın donanımına fiziksel olarak bağlanır.
- Bilgisayara özel gizli bir anahtar oluşturmak için Windows DPAPI kullanır.
- Birisi 'vault.db' dosyanızı çalsa bile, başka bir bilgisayarda açamaz.

3. Kod Karartma (Obfuscation)
- Uygulama kaynak kodu okunamaz ve karmaşık bir formata dönüştürülür.
- Tersine mühendislik ve kod manipülasyonuna karşı koruma sağlar.
- Mevcut güvenlik mantığının bütünlüğünü garanti altına alır.

4. Native Çekirdek (C++ Addon)
- Kritik güvenlik fonksiyonları yüksek performanslı C++ kodunda çalışır.
- Bellek ve koruma API'leri için Windows çekirdeği ile doğrudan etkileşim kurar.`
    },
    {
      id: 'passkey-support',
      title: 'Passkey (WebAuthn) Support',
      titleTr: 'Passkey (WebAuthn) Desteği',
      description: 'Modern Phishing-Resistant Authentication',
      descriptionTr: 'Modern Oltalama Korumalı Kimlik Doğrulama',
      icon: <Fingerprint size={24} className="text-indigo-400" />,
      details: `Passkey & WebAuthn Integration (v2.1.0+):
 
 1. What is a Passkey?
 - A more secure alternative to traditional passwords.
 - Uses public-key cryptography (ES256) instead of shared secrets.
 - Mathematically bound to the specific website (phishing resistant).
 
 2. Registering a Passkey
 - Select "Passkey" category in the Entry Form.
 - Enter the Domain (RPID) and your Display Name.
 - Click "REGISTER PASSKEY" to generate a cryptographically secure key pair.
 - Aegis Vault will store the public/private key pair under Zero-Knowledge encryption.
 
 3. Using Passkeys
 - When a website asks for a Passkey, Aegis Vault can sign the challenge.
 - This requires interaction with the Browser Extension (v2+).
 - **High security: Every signing operation requires a Biometric Confirmation (Windows Hello / Touch ID).**
 - Your actual private key never touches the browser.
 
 4. Why use Passkeys?
 - No more passwords to remember or type.
 - Immune to phishing; hackers cannot steal what isn't shared.
 - Aegis manages everything offline - maximum privacy.`,
      detailsTr: `Passkey ve WebAuthn Entegrasyonu (v2.1.0+):
 
 1. Passkey Nedir?
 - Geleneksel parolalara karşı geliştirilmiş, daha güvenli bir alternatif.
 - Paylaşılan sırlar yerine açık anahtarlı şifreleme (ES256) kullanır.
 - Belirli bir web sitesine matematiksel olarak bağlıdır (oltalama korumalı).
 
 2. Passkey Kaydetme
 - Kayıt formunda "Passkey" kategorisini seçin.
 - Alan Adı (RPID) ve Görünen Adınızı girin.
 - Kriptografik olarak güvenli bir anahtar çifti oluşturmak için "ANAHTAR OLUŞTUR" butonuna basın.
 - Aegis Vault, bu anahtar çiftini Sıfır-Bilgi şifrelemesi ile kasanıza kaydeder.
 
 3. Passkey Kullanımı
 - Bir web sitesi Passkey istediğinde, Aegis Vault gelen isteği imzalar.
 - Bu işlem için Tarayıcı Eklentisi (v2+) ile iletişim kurulur.
 - **Yüksek Güvenlik: Her imzalama işlemi Biyometrik Onay (Windows Hello / Touch ID) gerektirir.**
 - Özel anahtarınız (private key) asla tarayıcıya iletilmez.
 
 4. Neden Passkey Kullanmalıyım?
 - Hatırlanacak veya yazılacak bir parola yoktur.
 - Kimlik avına karşı tam koruma sağlar; siber saldırganlar kasada olmayan şeyi çalamazlar.
 - Aegis her şeyi çevrimdışı yönetir - maksimum gizlilik.`
    },
    {
      id: 'database-engine',
      title: 'Database Engine',
      titleTr: 'Veritabanı Motoru',
      description: 'SQLCipher - Professional Grade Storage',
      descriptionTr: 'SQLCipher - Profesyonel Sınıf Depolama',
      icon: <Settings size={24} className="text-zinc-400" />,
      details: `Modern Architecture Security (v1.1.0+):

1. SQLCipher Technology
- Full database encryption (AES-256)
- Not just data, but schemas and metadata are encrypted
- Military-grade SQLite extension for professionals

2. Performance
- Instant search even with thousands of entries
- Optimized memory usage for large file attachments
- Faster unlock times with Argon2id iteration tuning

3. Data Persistence
- Secure storage in %APPDATA%/Aegis Vault (Windows)
- Automatic migration from legacy IndexedDB storage
- Single file (vault.db) structure for easy backups`,
      detailsTr: `Modern Mimari Güvenliği (v1.1.0+):

1. SQLCipher Teknolojisi
- TAM veritabanı şifrelemesi (AES-256)
- Sadece veriler değil, tablo yapıları ve metadata da şifrelidir
- Profesyoneller için askeri sınıf SQLite uzantısı

2. Performans
- Binlerce giriş olsa bile anlık arama
- Büyük dosya ekleri için optimize edilmiş bellek kullanımı
- Argon2id anahtar türetme ile optimize edilmiş açılış süreleri

3. Veri Kalıcılığı
- %APPDATA%/Aegis Vault altında güvenli saklama (Windows)
- Eski IndexedDB tarayıcı depolamasından otomatik göç (migration)
- Kolay yedekleme için tek dosya (vault.db) yapısı`
    },
    {
      id: 'cli-access',
      title: 'CLI Access (Command Line Interface)',
      titleTr: 'CLI (Komut Satırı Arayüzü) Erişimi',
      description: 'Access your vault securely via Terminal',
      descriptionTr: 'Kasanıza Terminal üzerinden güvenli erişim',
      icon: <Smartphone size={24} className="text-emerald-500" />,
      details: `Command Line Interface - Terminal Access:

1. Getting Started
- Open PowerShell or Command Prompt in the Aegis Vault folder
- Use 'cli.bat' (Windows) for easy access
- Built application uses the packaged Electron runtime

2. Available Commands

   cli.bat list
   ─────────────────────────────────
   Lists all entries in your vault
   Shows: Short ID (8 chars) | Category | Favorite status
   Example output:
   a1b2c3d4 | Login    | ⭐
   e5f6g7h8 | Card     |

   cli.bat get <id>
   ─────────────────────────────────
   Shows full details of a specific entry
   Use the short ID from 'list' command
   Example: cli.bat get a1b2c3d4
   Output: Title, Username, Password, URL

   cli.bat help
   ─────────────────────────────────
   Shows all available commands and usage examples

3. Authentication Flow
- Enter your Master Password when prompted
- If 2FA is enabled, enter your 6-digit code
- All authentication uses secure GUI input (Windows)

4. Security Features
- Uses same Argon2id key derivation as desktop app
- Reads salt from encrypted vault metadata
- No passwords stored in command history
- Safe for automation and scripting

5. Example Session
   > .\\cli.bat list
   🔑 Master Password: [GUI Prompt]
   🔓 Vault unlocking...
   ✅ Success! 433 entries found.

   > .\\cli.bat get a1b2c3d4
   📄 Entry Details:
   Title:    Google Account
   Username: user@gmail.com
   Password: ********`,
      detailsTr: `Komut Satırı Arayüzü - Terminal Erişimi:

1. Başlarken
- Aegis Vault klasöründe PowerShell veya Komut İstemi açın
- Kolay erişim için 'cli.bat' (Windows) kullanın
- Derlenmiş uygulama paketlenmiş Electron çalışma zamanını kullanır

2. Kullanılabilir Komutlar

   cli.bat list
   ─────────────────────────────────
   Kasanızdaki tüm kayıtları listeler
   Gösterir: Kısa ID (8 karakter) | Kategori | Favori durumu
   Örnek çıktı:
   a1b2c3d4 | Login    | ⭐
   e5f6g7h8 | Card     |

   cli.bat get <id>
   ─────────────────────────────────
   Belirli bir kaydın tüm ayrıntılarını gösterir
   'list' komutundan aldığınız kısa ID'yi kullanın
   Örnek: cli.bat get a1b2c3d4
   Çıktı: Başlık, Kullanıcı Adı, Şifre, URL

   cli.bat help
   ─────────────────────────────────
   Tüm kullanılabilir komutları ve kullanım örneklerini gösterir

3. Kimlik Doğrulama Akışı
- İstendiğinde Ana Şifrenizi girin
- 2FA etkinse 6 haneli kodunuzu girin
- Tüm kimlik doğrulama güvenli GUI girişi kullanır (Windows)

4. Güvenlik Özellikleri
- Masaüstü uygulamasıyla aynı Argon2id anahtar türetimini kullanır
- Şifreli kasa meta verilerinden tuzu okur
- Komut geçmişinde şifre saklanmaz
- Otomasyon ve betikleme için güvenlidir

5. Örnek Oturum
   > .\\cli.bat list
   🔑 Ana Şifre: [GUI Penceresi]
   🔓 Kasa açılıyor...
   ✅ Başarılı! 433 kayıt bulundu.

   > .\\cli.bat get a1b2c3d4
   📄 Kayıt Detayları:
   Başlık:    Google Hesabı
   Kullanıcı: kullanici@gmail.com
   Şifre:     ********`
    },
    {
      id: 'cloud-bridge',
      title: 'Cloud Bridge (BYOC)',
      titleTr: 'Bulut Köprüsü (BYOC)',
      description: 'End-to-End Encrypted Cloud Sync (Google Drive & WebDAV)',
      descriptionTr: 'Uçtan Uca Şifreli Bulut Eşitleme (Google Drive & WebDAV)',
      icon: <Upload size={24} className="text-sky-500" />,
      details: `Setup Your Private Cloud Sync:

1. Bring Your Own Cloud (BYOC) Philosophy
- Aegis Vault connects directly to YOUR cloud storage.
- We have no servers, no middleman, and no access to your data.
- You maintain total control over your cloud infrastructure.

2. Google Drive Setup (Professional)
- Go to Google Cloud Console (console.cloud.google.com).
- Create a new project or select an existing one.
- Enable "Google Drive API".
- Create OAuth 2.0 Credentials (Desktop App).
- Copy "Client ID" and "Client Secret".
- Paste them into Aegis Vault > Settings > Data > Cloud Bridge.
- Click "Authenticate" to securely link your drive.

3. WebDAV Setup (Self-Hosted)
- Perfect for Nextcloud, ownCloud, or NAS (Synology/QNAP).
- Enter your WebDAV URL (e.g., https://cloud.myserver.com/remote.php/webdav).
- Enter your Username and Password.
- Aegis connects directly to your server.

4. End-to-End Encryption (E2EE)
- Your data is encrypted LOCALLY before leaving your device.
- The cloud provider (Google or your server) receives only encrypted blobs.
- They CANNOT read your passwords even if they wanted to.
- Encryption key never leaves your device.

5. Sync Operations
- Sync Now (Push): Uploads encrypted vault to cloud.
- Pull from Cloud: Downloads and merges cloud data to local vault.
- Manual control ensures you know exactly when data moves.`,
      detailsTr: `Özel Bulut Eşitlemenizi Kurun:

1. Kendi Bulutunu Getir (BYOC) Felsefesi
- Aegis Vault doğrudan SİZİN bulut depolama alanınıza bağlanır.
- Sunucumuz, aracımız veya verilerinize erişimimiz yoktur.
- Bulu altyapınız üzerinde tam kontrole sahipsiniz.

2. Google Drive Kurulumu (Profesyonel)
- Google Cloud Console'a gidin (console.cloud.google.com).
- Yeni bir proje oluşturun veya mevcut olanı seçin.
- "Google Drive API"yi etkinleştirin.
- OAuth 2.0 Kimlik Bilgileri oluşturun (Masaüstü Uygulaması).
- "Client ID" ve "Client Secret" bilgilerini kopyalayın.
- Aegis Vault > Ayarlar > Veri > Bulut Köprüsü'ne yapıştırın.
- Sürücünüzü güvenli bir şekilde bağlamak için "Kimlik Doğrulama"ya tıklayın.

3. WebDAV Kurulumu (Kendi Sunucunuz)
- Nextcloud, ownCloud veya NAS (Synology/QNAP) için mükemmeldir.
- WebDAV URL'nizi girin (örn. https://cloud.sunucum.com/remote.php/webdav).
- Kullanıcı Adınızı ve Parolanızı girin.
- Aegis doğrudan sunucunuza bağlanır.

4. Uçtan Uca Şifreleme (E2EE)
- Verileriniz cihazdan ayrılmadan önce YEREL olarak şifrelenir.
- Bulut sağlayıcısı (Google veya sunucunuz) yalnızca şifreli veri blokları alır.
- İstemeleri durumunda bile parolalarınızı OKUYAMAZLAR.
- Şifreleme anahtarı asla cihazınızdan ayrılmaz.

5. Eşitleme İşlemleri
- Eşitle (Yükle): Şifreli kasayı buluta yükler.
- Buluttan Çek: Bulut verilerini indirir ve yerel kasa ile birleştirir.
- Manuel kontrol, verilerin ne zaman taşındığını tam olarak bilmenizi sağlar.`
    },
    {
      id: 'qr-sharing',
      title: 'QR Code Sharing',
      titleTr: 'QR Kod ile Paylaşım',
      description: 'Share passwords securely via QR codes (100% Offline)',
      descriptionTr: 'QR kodlar ile güvenli şifre paylaşımı (%100 Çevrimdışı)',
      icon: <QrCode size={24} className="text-emerald-500" />,
      details: `Offline Password Sharing via QR Codes:

1. What is QR Sharing?
- Share passwords with anyone without internet
- 100% offline - no servers or cloud required
- Military-grade encryption (AES-256-GCM)
- Password protected (minimum 12 characters)
- Auto-expires after 24 hours

2. How to Share a Password
- Open any password card in your vault
- Click the "Share" button (between Eye and Copy icons)
- Enter a sharing password (min 12 characters)
  - Click "GEN" to auto-generate a strong password
  - Or create your own secure password
- Confirm the password
- QR code(s) will be generated
  - Small entries: Single QR code
  - Large entries: Multiple QR codes (chunking)
- Download or screenshot the QR code(s)
- Share the QR code AND the sharing password with the recipient

3. How to Receive a Password
- Click the "QR Scan" button (green icon) in Dashboard header
- Choose scanning method:
  - Camera: Scan QR code with your webcam
  - Upload: Select QR code image file
- Enter the sharing password from the sender
- Preview the received password details
- Confirm to import into your vault
- The password is encrypted with YOUR master key

4. Security Features
- Dual-layer encryption:
  1. Entry data encrypted with ephemeral key
  2. Ephemeral key encrypted with sharing password
- Argon2id key derivation (20 iterations)
- SHA-256 checksum verification
- 24-hour auto-expiration
- Forward secrecy (ephemeral keys destroyed after use)

5. Browser Extension Support
- QR scan button also available in browser extension
- Upload QR code images to scan
- Automatically send to desktop app for processing

6. Best Practices
- Always share the password securely (separate channel)
- Never share the QR code publicly
- QR codes expire after 24 hours
- Each QR code can only be decrypted with the correct password
- Verify the password before importing
- The sender cannot access your vault after sharing`,
      detailsTr: `QR Kodlar ile Çevrimdışı Şifre Paylaşımı:

1. QR Paylaşımı Nedir?
- İnternet olmadan herhangi biriyle şifre paylaşın
- %100 çevrimdışı - sunucu veya bulut gerektirmez
- Askeri sınıf şifreleme (AES-256-GCM)
- Şifre korumalı (minimum 12 karakter)
- 24 saat sonra otomatik sona erer

2. Şifre Nasıl Paylaşılır?
- Kasanızdaki herhangi bir şifre kartını açın
- "Paylaş" butonuna tıklayın (Göz ve Kopyala ikonları arasında)
- Paylaşım şifresi girin (min 12 karakter)
  - Güçlü bir parola otomatik üretmek için "ÜRET"e tıklayın
  - Veya kendi güvenli şifrenizi oluşturun
- Şifreyi doğrulayın
- QR kod(lar) oluşturulur:
  - Küçük girdiler: Tek QR kod
  - Büyük girdiler: Çoklu QR kod (bölme)
- QR kod(lar)ı indirin veya ekran görüntüsü alın
- QR kodu VE paylaşım şifresini alıcıyla paylaşın

3. Şifre Nasıl Alınır?
- Dashboard başlığındaki "QR Tara" butonuna (yeşil ikon) tıklayın
- Tarama yöntemini seçin:
  - Kamera: Web kamerası ile QR kodu tarayın
  - Yükle: QR kod görsel dosyasını seçin
- Gönderenden gelen paylaşım şifresini girin
- Alınan şifre detaylarını önizleyin
- Kasanıza eklemek için onaylayın
- Şifre SİZİN Ana Anahtarınız ile şifrelenir

4. Güvenlik Özellikleri
- Çift katmanlı şifreleme:
  1. Girdi verisi ephemeral key ile şifrelenir
  2. Ephemeral key paylaşım şifresiyle şifrelenir
- Argon2id anahtar türetme (20 iterasyon)
- SHA-256 checksum doğrulaması
- 24 saatlik otomatik sona erme
- İleri gizlilik (ephemeral key'ler kullanımdan sonra silinir)

5. Browser Uzantısı Desteği
- Tarayıcı uzantısında da QR tara butonu mevcuttur
- Taramak için QR kod görsellerini yükleyin
- İşlemek için masaüstü uygulamaya otomatik gönderir

6. En İyi Uygulamalar
- Paylaşım şifresini her zaman güvenli kanaldan paylaşın
- QR kodu asla herkese açık paylaşmayın
- QR kodlar 24 saat sonra sona erer
- Her QR kod yalnızca doğru şifreyle çözülebilir
- İçe aktarmadan önce şifreyi doğrulayın
- Paylaştıktan sonra gönderici kasanıza erişemez`
    }
  ];

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-blue-500/20 shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-blue-500/10 px-8 py-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/20 rounded-xl">
                  <BookOpen size={28} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                    {lang === 'en' ? 'User Guide' : 'Kullanıcı Kılavuzu'}
                  </h2>
                  <p className="text-xs text-zinc-400 uppercase tracking-widest mt-1">
                    {lang === 'en' ? 'Complete Documentation' : 'Tam Belgelendirme'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={24} className="text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-4">
              {sections.map((section, idx) => (
                <motion.div
                  key={`guide-section-${section.id}-${idx}`}
                  className="glass border border-blue-500/10 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full px-8 py-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-6 text-left flex-1">
                      <div className="p-3 bg-blue-600/10 rounded-lg">
                        {section.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                          {lang === 'en' ? section.title : section.titleTr}
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">
                          {lang === 'en' ? section.description : section.descriptionTr}
                        </p>
                      </div>
                    </div>
                    {expandedSection === section.id ? (
                      <ChevronUp size={24} className="text-blue-500 flex-shrink-0 ml-4" />
                    ) : (
                      <ChevronDown size={24} className="text-zinc-500 flex-shrink-0 ml-4" />
                    )}
                  </button>

                  <AnimatePresence>
                    {expandedSection === section.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-blue-500/10 bg-white/[0.01] px-8 py-6"
                      >
                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
                          {lang === 'en' ? section.details : section.detailsTr}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur border-t border-blue-500/10 px-8 py-6 flex items-center justify-between">
              <div className="text-xs text-zinc-500 uppercase tracking-widest">
                {lang === 'en' ? '© Aegis Vault - Secure Local Storage' : '© Aegis Vault - Güvenli Yerel Depolama'}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                {lang === 'en' ? 'Close' : 'Kapat'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserGuideModal;
