# 🔐 Aegis Vault Pro Lisans Üretme Kılavuzu

Bu kılavuz, kullanıcılarınıza özel Pro lisans anahtarlarını nasıl oluşturacağınızı adım adım açıklar.

## 🛠️ Hazırlık
Sistemde lisans üretmek için gerekli olan `private_key.pem` dosyası ana dizinde zaten oluşturulmuştur. Bu dosya sizin **gizli imzanızdır**, asla başkasıyla paylaşmayın.

---

## 🚀 Lisans Üretme Adımları

### 1. Kullanıcıdan Device ID Alın
Kullanıcı, programdaki **Ayarlar / Pro Yükseltme** (veya ilgili lisans ekranı) bölümüne girdiğinde kendisine özel bir **Device ID** görecektir. 
Örnek: `4D56-A1B2-C3D4...`

### 2. Terminali Açın
Proje ana dizinindeyken (PowerShell veya CMD) şu komutu çalıştırın:

```powershell
node scripts/license-tool.mjs gen [KULLANICI_DEVICE_ID]
```

**Gerçek Örnek:**
```powershell
node scripts/license-tool.mjs gen 9823-AF21-0012
```

### 3. Lisans Anahtarını Kopyalayın
Komutu çalıştırdıktan sonra terminalde şöyle bir çıktı göreceksiniz:
`eyJkZXZpY2VJZCI6Ijk4MjMtQUYyMS0wMDEyIiwidHlwZSI6InByZW1pdW0iLCJpc3N1ZWRBdCI6MTczNTI5NjQ4ODMxMH0uSDRzSUFBQUFBQUFBQUFaO...`

Bu uzun Base64 kodunun tamamını kopyalayın.

### 4. Kullanıcıya Gönderin
Kopyaladığınız bu kodu kullanıcıya iletin. Kullanıcı bu kodu programdaki lisans giriş alanına yapıştırdığında sistemi **Pro** olacaktır.

---

## ⚠️ Önemli Notlar
- **Tek Bilgisayar:** Üretilen lisans sadece o Device ID'ye (işlemci + anakart) özeldir. Başka bir bilgisayarda çalışmaz.
- **Güvenlik:** Eğer bilgisayarınızdaki `private_key.pem` dosyasını silerseniz, yeni bir anahtar üretmeniz gerekir (`node scripts/license-tool.mjs init`). **Ancak dikkat:** Yeni anahtar üretirseniz, eski kullanıcılara verdiğiniz lisanslar geçersiz kalır. Bu yüzden bu dosyayı mutlaka yedekleyin.
- **Offline Çalışma:** Bu sistem tamamen offline çalışır, lisans kontrolü için internet gerekmez.
