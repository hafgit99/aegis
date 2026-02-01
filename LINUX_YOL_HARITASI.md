# Aegis Vault Linux Versiyonu Yol Haritası

Bu belge, Aegis Vault uygulamasını Linux ortamı (Ubuntu, Fedora, Debian vb.) için nasıl derleyebileceğinizi adım adım açıklar.

## Özet
Windows kullanıcısı olduğunuz için, Linux çıktılarını (AppImage, .deb, .snap) en sağlıklı şekilde üretmenin yolu **GitHub Actions (CI/CD)** kullanmaktır. Bu sayede GitHub sunucularındaki sanal Linux makineleri kullanılarak uygulamanız otomatik olarak derlenir.

---

## Adım 1: package.json Konfigürasyonu
`package.json` dosyasındaki `build` ayarlarına Linux ayarlarını eklememiz gerekiyor.

**Hedef Formatlar:**
Linux ekosistemi çeşitlidir, bu yüzden genellikle şu formatlar üretilir:
1.  **AppImage:** (Önerilen) Kurulum gerektirmeden her Linux dağıtımında çalışan tek bir dosyadır. "Portable" gibidir.
2.  **deb:** Debian ve Ubuntu tabanlı sistemler için kurulum paketi.
3.  **snap:** (Opsiyonel) Canonical tarafından geliştirilen evrensel paket formatı.

**Yapılacaklar:**
1.  `build` nesnesi içine `linux` konfigürasyonu eklenecek.
2.  `build` script'lerine `build:linux` eklenecek.

## Adım 2: Native Modül Ayarları (binding.gyp)
Daha önce macOS için yaptığımız güncellemede `binding.gyp` dosyasını "Windows değilse Stub dosyasını kullan" şeklinde ayarlamıştık.
Bu ayar Linux için de **geçerlidir ve çalışacaktır**. Linux'ta da `windows.h` olmadığı için otomatik olarak `security_stub.cpp` (boş güvenlik dosyası) kullanılacak ve derleme hatası oluşmayacaktır.

## Adım 3: GitHub Actions Kurulumu
GitHub üzerinde otomatik Linux derlemesi yapacak bir iş akışı dosyası oluşturulmalıdır.

**Dosya Yolu:** `.github/workflows/build-linux.yml`

**Bu workflow ne yapacak?**
1.  Ubuntu tabanlı bir sanal makine açacak.
2.  Gerekli kütüphaneleri (libarchive-tools vb.) kuracak.
3.  Uygulamayı derleyip `AppImage` ve `deb` dosyalarını oluşturacak.
4.  Dosyaları indirilebilir hale getirecek.

---

## Uygulama Planı

Aşağıdaki adımları sizin için uygulayabilirim:

1.  `package.json` dosyasını Linux ayarlarıyla güncellemek.
2.  `.github/workflows/build-linux.yml` dosyasını oluşturmak.
3.  GitHub'a push işlemi yaparak Linux build işlemini başlatmak.
