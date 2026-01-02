# Aegis Vault: Güvenlik ve Mimari Teknik İncelemesi (Whitepaper)

## 1. Giriş
Aegis Vault, dijital varlıkların ve kimlik bilgilerinin korunması için tasarlanmış, "Sıfır Bilgi" (Zero-Knowledge) ve "Önce Yerel" (Offline-First) felsefesini benimseyen premium bir güvenlik çözümüdür. Modern siber tehditlerin arttığı bir dünyada Aegis, verilerin bulutta değil, tamamen kullanıcının kontrolündeki cihazda şifrelenmiş olarak kalmasını sağlar.

## 2. Temel Mimari Prensipleri

### 2.1 Sıfır Bilgi Mimarisi (Zero-Knowledge)
Aegis Vault, kullanıcının Ana Şifresine (Master Password) asla erişemez. Tüm şifreleme ve şifre çözme işlemleri uç noktada (cihaz üzerinde) gerçekleşir. Aegis sunucularına veya üçüncü taraflara hiçbir zaman ham veri veya şifreleme anahtarı iletilmez.

### 2.2 Önce Yerel Yaklaşımı (Offline-First)
Uygulama, internet bağlantısı gerektirmeksizin %100 işlevseldir. Veritabanı (IndexedDB üzerine kurulu şifreli katman), kullanıcının yerel depolama alanında saklanır. Bu, hem hız hem de ağ tabanlı saldırılara karşı mutlak koruma sağlar.

## 3. Güvenlik ve Şifreleme Teknolojileri

### 3.1 Veri Şifreleme (AES-256-GCM)
Tüm hassas veriler (parolalar, notlar, kredi kartları, kripto cüzdan anahtarları), endüstri standardı olan **AES-256-GCM** algoritması ile şifrelenir.
- **GCM (Galois/Counter Mode):** Sadece gizlilik sağlamakla kalmaz, aynı zamanda verinin değiştirilip değiştirilmediğini doğrulayan bütünlük kontrolü (Authentication Tag) sunar.

### 3.2 Anahtar Türetme (Key Derivation)
Kullanıcının ana şifresi, doğrudan kriptografik anahtar olarak kullanılmaz. Bunun yerine, kaba kuvvet (brute-force) saldırılarına karşı dirençli **PBKDF2** algoritması kullanılarak türetilir. Her kasa için benzersiz bir "Salt" değeri kullanılır.

### 3.3 Donanım Kimliği ve Cihaz Bağımlılığı
Aegis, kasanın sadece yetkili cihazda açılmasını zorunlu kılmak için işlemci ve anakart seri numaralarından türetilen bir cihaz kimliği kullanır. Bu özellik, kasanın başka bir bilgisayara kopyalanması durumunda ana şifre bilinse bile açılmasını zorlaştırır.

## 4. Gelişmiş Özellikler

### 4.1 Kripto Cüzdan Kasası
Kripto varlık sahipleri için özel olarak tasarlanmış bu bölüm; 12/24 kelimelik Tohum İfadeleri (Seed Phrases) ve Özel Anahtarları (Private Keys) maskelenmiş ve yüksek güvenlikli katmanda saklar. Kullanıcı deneyimi, DeFi ve Web3 ekosistemine tam uyumlu olacak şekilde optimize edilmiştir.

### 4.2 Biyometrik ve Donanım Kilidi
Windows Hello entegrasyonu sayesinde, ana şifreyi her seferinde girmek yerine parmak izi veya yüz tanıma ile güvenli ve hızlı erişim sağlanır.

### 4.3 Denetim Kayıtları (Audit Logs)
Güvenlik açısından kritik tüm işlemler (kasa açma, anahtar değişimi, veri dışa aktarma), cihaz üzerinde şifreli bir günlük dosyasında (Audit Log) tutulur. Bu günlükler sadece ana şifre ile okunabilir.

### 4.4 Panik Modu (Panic Mode)
Acil durumlarda tanımlanmış bir kısayol (Hotkey) ile kasa anında kilitlenir ve uygulama penceresi gizlenir.

## 5. Gizlilik Politikası Taahhüdü
- **Telemetri Yok:** Kullanım alışkanlıklarınız takip edilmez.
- **Bulut Senkronizasyonu Yok:** Verileriniz izniniz dışında hiçbir buluta yüklenmez.
- **Tam Şeffaflık:** Şifreleme yöntemleri ve veri yapısı açıktır; "Güvenlik yoluyla gizlilik" (Security by obscurity) yerine matematiksel kanıtlara dayanır.

## 6. Sonuç
Aegis Vault, bir şifre yöneticisinden daha fazlasıdır; dijital egemenliğinizi geri kazanmanızı sağlayan bir güvenlik kalesidir. Verilerinizin tek sahibi sizsiniz ve anahtar sadece sizin elinizdedir.

---
*© 2026 Aegis Security Lab - Güvenliğiniz Bizim Mimari Temelimizdir.*
