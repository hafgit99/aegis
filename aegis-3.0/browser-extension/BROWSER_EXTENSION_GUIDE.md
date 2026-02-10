# Aegis Vault: Browser Extension Guide / Tarayıcı Eklentisi Kılavuzu

[English](#english-guide) | [Türkçe](#türkçe-kılavuz)

---

## English Guide

### 🚀 Overview
The Aegis Vault Browser Extension provides a secure bridge between your web browser and the Aegis Vault desktop application. It enables **Automated Autofill**, **Passkey Signing**, and **Secure Credential Management** directly within your browser (Chrome, Edge, Brave, etc.).

### 🔒 Security Architecture
- **Native Messaging Bridge:** Uses Chrome's most secure communication protocol.
- **Fixed Extension ID:** `pjjmjgibliobepbjbghmipfpiljgogii` (Pre-verified for security).
- **Session Handshake:** Protected by a unique session token generated every time the desktop app starts.
- **Zero-Knowledge:** No credentials are ever stored in the browser; they remain in your encrypted desktop vault.

### 🛠️ Installation Steps

1. **Prerequisite:** Ensure the Aegis Vault Desktop App is running.
2. **Open Extensions Page:** In your browser, navigate to `chrome://extensions/`.
3. **Enable Developer Mode:** Toggle the **Developer mode** switch in the top-right corner.
4. **Load Extension:** 
   - Click the **"Load unpacked"** (Paketlenmemiş öğe yükle) button.
   - Navigate to your Aegis Vault installation folder.
   - Select the `browser-extension` folder.
5. **Verify ID:** Ensure the ID is `pjjmjgibliobepbjbghmipfpiljgogii`.
6. **Pin to Toolbar:** For easy access, pin the Aegis Vault icon to your browser's toolbar.

#### 🦊 Firefox Installation
1. **Open Debugging Page:** In Firefox, navigate to `about:debugging`.
2. **This Firefox:** Click on **"This Firefox"** in the left sidebar.
3. **Load Manifest:**
   - Click **"Load Temporary Add-on..."**.
   - Select the `manifest.json` file inside the `browser-extension-firefox` folder.
4. **Verify ID:** Ensure the ID is `sales@hetech-me.space` (in about:debugging).
5. **Note:** Temporary add-ons are removed when Firefox restarts. For permanent use, the extension must be signed by Mozilla.

#### 📄 Mozilla Add-ons (AMO) Submission Metadata
When submitting to AMO, use the following information:
- **Version Notes:** 
  - "Initial release for Aegis Vault browser integration."
  - "Added support for Firefox Manifest V3."
- **Notes to Reviewer:**
  - "This extension is a secure bridge for the Aegis Vault desktop application. It requires the desktop app to be running and unlocked to function. It uses Native Messaging to communicate with the host application."

### 💡 How to Use
- **Autofill:** When on a login page, click the Aegis icon in the input field or open the extension popup to search and fill credentials.
- **Passkeys:** If a website requests a Passkey sign-in, Aegis Vault will automatically handle the secure signature request.
- **Auto-Sync:** Changes in your desktop vault are reflected in the extension instantly.

---

## Türkçe Kılavuz

### 🚀 Genel Bakış
Aegis Vault Tarayıcı Eklentisi, web tarayıcınız ile Aegis Vault masaüstü uygulaması arasında güvenli bir köprü kurar. Bu eklenti sayesinde **Otomatik Doldurma (Autofill)**, **Passkey İmzalama** ve **Güvenli Parola Yönetimi** özelliklerini doğrudan tarayıcınızda (Chrome, Edge, Brave vb.) kullanabilirsiniz.

### 🔒 Güvenlik Mimarisi
- **Native Messaging Bridge:** Chrome'un sunduğu en güvenli iletişim protokolünü kullanır.
- **Sabit Eklenti Kimliği:** `pjjmjgibliobepbjbghmipfpiljgogii` (Güvenlik için önceden doğrulanmış).
- **Oturum El Sıkışması:** Masaüstü uygulaması her açıldığında üretilen benzersiz bir "Session Token" ile korunur.
- **Sıfır Bilgi (Zero-Knowledge):** Bilgileriniz asla tarayıcıda saklanmaz; her zaman şifreli masaüstü kasanızda kalır.

### 🛠️ Kurulum Adımları

1. **Ön Koşul:** Aegis Vault Masaüstü Uygulamasının açık olduğundan emin olun.
2. **Eklentiler Sayfasını Açın:** Tarayıcınızda `chrome://extensions/` adresine gidin.
3. **Geliştirici Modunu Açın:** Sağ üst köşedeki **"Geliştirici modu"** anahtarını aktif hale getirin.
4. **Eklentiyi Yükleyin:** 
   - **"Paketlenmemiş öğe yükle"** butonuna tıklayın.
   - Aegis Vault programının yüklü olduğu klasöre gidin.
   - `browser-extension` klasörünü seçin ve onaylayın.
5. **ID Doğrulama:** Eklenti kimliğinin `pjjmjgibliobepbjbghmipfpiljgogii` olduğunu kontrol edin.
6. **Araç Çubuğuna Sabitle:** Kolay erişim için Aegis Vault ikonunu tarayıcı araç çubuğuna sabitleyin.

#### 🦊 Mozilla Firefox Kurulumu
1. **Hata Ayıklama Sayfasını Açın:** Firefox'ta `about:debugging` adresine gidin.
2. **Bu Firefox:** Sol menüden **"Bu Firefox"** (This Firefox) seçeneğine tıklayın.
3. **Eklentiyi Yükleyin:**
   - **"Geçici Eklentiyi Yükle..."** (Load Temporary Add-on...) butonuna tıklayın.
   - `browser-extension-firefox` klasörü içindeki `manifest.json` dosyasını seçin.
4. **Kimlik Doğrulama:** Eklenti kimliğinin `sales@hetech-me.space` olduğunu kontrol edin (about:debugging sayfasında).
5. **Not:** Geçici eklentiler Firefox kapatıldığında silinir. Kalıcı kullanım için eklentinin Mozilla tarafından imzalanması gerekmektedir.

#### 📄 Mozilla Add-ons (AMO) Gönderim Bilgileri
AMO'ya gönderim yaparken aşağıdaki bilgileri kullanın:
- **Sürüm Notları (Version Notes):**
  - "Initial release for Aegis Vault browser integration."
  - "Added support for Firefox Manifest V3."
- **İnceleyene Notlar (Notes to Reviewer):**
  - "This extension is a secure bridge for the Aegis Vault desktop application. It requires the desktop app to be running and unlocked to function. It uses Native Messaging to communicate with the host application."

### 💡 Nasıl Kullanılır?
- **Otomatik Doldurma:** Bir giriş sayfasındayken, giriş alanındaki Aegis simgesine tıklayın veya eklenti açılır penceresinden arama yaparak bilgilerini doldurun.
- **Passkeys:** Bir web sitesi Passkey ile giriş istediğinde, Aegis Vault güvenli imzalama isteğini otomatik olarak yakalayıp işleyecektir.
- **Anlık Senkronizasyon:** Masaüstü kasanızda yaptığınız değişiklikler anında eklentiye yansır.

---

### ⚠️ Troubleshooting / Sorun Giderme
- **"No connection to host":** Make sure the desktop app is open and unlocked. / Masaüstü uygulamasının açık ve kilitli olmadığından emin olun.
- **Update Issues:** Re-load the extension if you update the desktop application version. / Uygulama sürümünü güncellerseniz eklentiyi yeniden yüklemeniz gerekebilir.
