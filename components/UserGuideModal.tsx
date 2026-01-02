import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, BookOpen, Shield, Lock, Key, Folder, Tag, Search, Download, Upload, Eye, Smartphone, AlertTriangle, Settings, HelpCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.tsx';

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

6. Panic Mode
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

6. Panik Modu
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
              {sections.map((section) => (
                <motion.div
                  key={section.id}
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
