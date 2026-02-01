# Aegis Vault macOS Versiyonu Yol Haritası

Bu belge, Aegis Vault uygulamasını Windows ortamında geliştirirken macOS için nasıl derleyebileceğinizi adım adım açıklar.

## Özet
Windows kullanıcısı olduğunuz için, macOS (.dmg / .app) çıktılarını doğrudan kendi bilgisayarınızda üretmeniz zordur (Code Signing ve Notarization gereklilikleri nedeniyle).

En verimli ve profesyonel yöntem **GitHub Actions (CI/CD)** kullanmaktır. Bu sayede GitHub sunucularındaki sanal macOS makineleri kullanılarak uygulamanız otomatik olarak derlenir.

---

## Adım 1: package.json Konfigürasyonu
`package.json` dosyasındaki `build` ayarlarına macOS ayarlarını eklememiz gerekiyor.

**Yapılacaklar:**
1.  `build` nesnesi içine `mac` konfigürasyonu eklenecek.
2.  `build` script'indeki `--win` parametresi daha esnek hale getirilecek.
3.  macOS için uygun bir ikon (.icns veya yüksek çözünürlüklü .png) tanımlanacak.

## Adım 2: İkon Hazırlığı
macOS uygulamaları 512x512 veya 1024x1024 boyutlarında yüksek kaliteli ikonlar gerektirir.
*   Mevcut projenizde `icon_large.png` (yaklaşık 666KB) bulunuyor. Bu dosya macOS için kullanılabilir.

## Adım 3: GitHub Actions Kurulumu
GitHub üzerinde otomatik derleme yapacak bir iş akışı (workflow) dosyası oluşturulmalıdır.

**Dosya Yolu:** `.github/workflows/build-mac.yml`

**Bu workflow ne yapacak?**
1.  GitHub'a her kod gönderdiğinizde (veya yeni bir "release" oluşturduğunuzda) tetiklenecek.
2.  Sanal bir macOS makinesi açacak.
3.  Projenizi indirip `npm install` komutunu çalıştıracak.
4.  Native modülleri (`better-sqlite3-multiple-ciphers` gibi) macOS mimarisi için yeniden derleyecek.
5.  Uygulamayı derleyip `.dmg` dosyasını oluşturacak.
6.  Oluşan dosyayı GitHub'dan indirilebilir hale getirecek ("Artifacts" veya "Releases" kısmında).

## Adım 4: Apple Developer Hesabı (Opsiyonel ama Önemli)
Uygulamanızın başkalarının Mac'lerinde "Güvenilmeyen Geliştirici" uyarısı vermeden açılması için uygulamanın **imzalanması (Signing)** ve **onaylanması (Notarization)** gerekir.

*   **Ücretsiz Yöntem:** İmzalamadan dağıtmak. Kullanıcılar uygulamayı açarken sağ tık -> "Aç" demeli ve güvenlik uyarısını kabul etmelidir.
*   **Profesyonel Yöntem:** Yıllık $99 Apple Developer üyeliği satın alarak sertifika edinmek ve GitHub Actions secrets kısmına bu sertifikaları eklemek.

*Bu yol haritasında öncelikle ücretsiz yöntem (imzasız build) hedeflenecektir.*

---

## Uygulama Planı

Aşağıdaki adımları sizin için uygulayabilirim:

1.  `package.json` dosyasını macOS ayarlarıyla güncellemek.
2.  `.github/workflows/build-release.yml` dosyasını oluşturmak.
3.  GitHub'a push işlemi yaparak ilk build denemesini başlatmak.

Hazırsanız bu değişiklikleri uygulamaya başlayabilirim.
