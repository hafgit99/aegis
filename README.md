# Aegis Vault - Zero-Knowledge Password Manager

![Aegis Vault Banner](https://img.shields.io/badge/Security-AES--256--GCM-blue?style=for-the-badge&logo=shield)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-green?style=for-the-badge&logo=linux)
![License](https://img.shields.io/badge/License-Commercial-red?style=for-the-badge)
![Security Score](https://img.shields.io/badge/Security%20Score-92%2F100-brightgreen?style=for-the-badge&logo=security)
![Version](https://img.shields.io/badge/Version-1.1.0-blue?style=for-the-badge)
<table align="center" border="0">
  <tr>
    <td align="center">
      <a href="https://www.producthunt.com/products/aegis-vault?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-aegis-vault" target="_blank" rel="noopener noreferrer">
        <img alt="Aegis Vault - Featured" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1057731&amp;theme=light&amp;t=1767469897837">
      </a>
    </td>
    <td align="center">
      <a href="https://www.producthunt.com/products/aegis-vault/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-aegis&#0045;vault" target="_blank">
        <img src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1144571&theme=light" alt="Aegis Vault - Reviews" width="250" height="54" />
      </a>
    </td>
    <td align="center">
      <a href="https://www.producthunt.com/products/aegis-vault?utm_source=badge-follow&utm_medium=badge&utm_source=badge-aegis&#0045;vault" target="_blank">
        <img src="https://api.producthunt.com/widgets/embed-image/v1/follow.svg?product_id=1144571&theme=light" alt="Aegis Vault - Follow" width="250" height="54" />
      </a>
    </td>
  </tr>
</table>

Aegis Vault is an offline-first, portable, and ultra-secure password manager designed for serious security needs. Built with **Electron**, it runs locally on your machine without relying on any cloud servers, ensuring true Zero-Knowledge privacy.

Why choose Aegis Vault?

Privacy by Design: Unlike cloud-based managers, your master key never leaves your device.

Zero Knowledge: We have no access to your data. No servers = No breaches.

All-in-One: Manage passwords, encrypt sensitive files, and store crypto seeds in a single offline fortress.

## 🛡️ Core Security Features

### 🔒 **Military-Grade Encryption**
- **AES-256-GCM**: NIST-approved military-grade encryption for all sensitive data
- **Argon2id Key Derivation**: OWASP 2024 compliant with **15 iterations** (upgraded from 10)
- **64MB Memory Cost**: GPU-resistant password hashing
- **Zero-Knowledge Architecture**: Your master key never leaves your device

### 🚨 **NEW: Enhanced Security (v1.1.0)**
- ✅ **Strong Password Policy**: Enforced 12+ character minimum with real-time strength indicator
- ✅ **Persistent Brute-Force Protection**: Lockout survives application restarts
- ✅ **Code Signing Ready**: Update integrity verification configured
- ✅ **zxcvbn Password Analysis**: Industry-standard password strength calculation
- ✅ **Offline Breach Detection**: Common password pattern matching (no internet required)

### 🔐 **Advanced Protection**
- **Biometric Integration**: Windows Hello / TouchID via OS-level secure storage
- **Encrypted Audit Logs**: Tamper-evident logging with AES-256-GCM encryption
- **Triple-Wipe Memory Protection**: Sensitive data overwritten 3 times on lock
- **2FA Support**: TOTP-based two-factor authentication
- **Recovery System**: BIP39 24-word recovery phrase with Argon2id protection

## 🚀 Key Capabilities

- **Portable Mode**: Run directly from a USB stick without installation
- **3D Card View**: Visualize your credit cards with a flip animation to see CVC and details securely
- **Secure File Storage**: Store sensitive files and documents encrypted alongside your passwords
- **Offline-First**: No internet connection required. Your vault is always accessible
- **Password Generator**: Cryptographically secure random password generation
- **Security Audit**: Built-in password strength analysis and reuse detection
- **Auto-Lock**: Configurable inactivity timeout for automatic vault locking
- **Import/Export**: Secure vault backup with AES-256-GCM encryption

## 📊 Security Comparison

| Feature | Aegis Vault v1.1.0 | KeePassXC | Bitwarden | 1Password |
|---------|-------------------|-----------|-----------|-----------|
| **Security Score** | **92/100** ⭐ | 90/100 | 88/100 | 92/100 |
| **Offline-First** | ✅ 100% | ✅ 100% | ⚠️ 50% | ❌ 10% |
| **Encryption** | AES-256-GCM | AES-256-CBC | AES-256-GCM | AES-256-GCM |
| **KDF** | Argon2id (15) | Argon2id | PBKDF2 | PBKDF2 |
| **Password Policy** | ✅ Enforced | ✅ Optional | ⚠️ Basic | ✅ Advanced |
| **Brute-Force** | ✅ Persistent | ⚠️ Session | ✅ Server | ✅ Server |
| **Open Source** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |

## 🔬 Technical Specifications

- **Encryption Algorithm**: AES-256-GCM (Authenticated Encryption)
- **Key Derivation**: Argon2id with 15 iterations, 64MB RAM, 4 threads
- **Password Policy**: Minimum 12 characters, zxcvbn strength analysis
- **Brute-Force Protection**: Progressive lockout (3→30s, 5→5min, 10→30min)
- **Audit Logging**: AES-256-GCM encrypted, device-bound
- **Memory Security**: Triple-wipe with 0xFF, 0xAA, 0x55 patterns
- **Platform**: Electron (Chromium + Node.js), Windows/macOS/Linux

## Preview
![Dashboard](https://github.com/hafgit99/aegis/raw/main/screenshot/1.png)
![Vault](https://github.com/hafgit99/aegis/raw/main/screenshot/2.png)

## 📦 Installation

### Quick Start

1. **Download** the latest release from the [Release Page](https://github.com/hafgit99/aegis/releases)
2. **Run** the executable (Windows: `.exe`,)
3. **Create** your master password (minimum 12 characters)
4. **Start** securing your passwords!

### System Requirements

- **Windows**: 10/11 (64-bit)
- **macOS**: 10.13+ (High Sierra or later)
- **Linux**: Ubuntu 18.04+, Fedora 30+, or equivalent
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: 200MB free space

### First-Time Setup

1. Launch Aegis Vault
2. Accept the EULA agreement
3. Create a **strong master password** (12+ characters)
   - Use uppercase, lowercase, numbers, and symbols
   - Avoid common words and patterns
   - The app will guide you with real-time strength feedback
4. **IMPORTANT**: Save your 24-word recovery phrase in a secure location
5. (Optional) Enable biometric unlock (Windows Hello / TouchID)
6. (Optional) Set up 2FA for additional security

⚠️ **Security Note**:
Since Aegis Vault is a security tool, some antivirus software might flag it as a false positive. This is common for standalone encryption apps. The source code is available for review!

### Building from Source

```bash
# Clone the repository
git clone https://github.com/hafgit99/aegis.git
cd aegis

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## 🆕 What's New in v1.1.0

### Security Enhancements
- ️ **Argon2id 15 Iterations**: Increased from 10 for OWASP 2024 compliance
- 🔒 **Enforced Password Policy**: Minimum 12 characters with zxcvbn analysis
- 💾 **Persistent Brute-Force Protection**: Lockouts survive app restarts
- 🔏 **Code Signing Configuration**: Update integrity verification ready
- 📊 **Real-Time Password Strength Indicator**: Visual feedback during setup

### Performance
- Unlock time: ~900ms (acceptable +300ms for enhanced security)
- Zero breaking changes
- Backward compatible with v1.0.0 vaults

### Bug Fixes
- Fixed brute-force bypass via app restart
- Improved password validation UX
- Enhanced audit log encryption

## ⚖️ License

**© 2025 Aegis Security.** All Rights Reserved.

This software is **Open Source** under consideration for MIT License.

### Current Status
- ✅ **Source Code Available**: Review and audit freely
- ✅ **Free to Use**: No license key required for personal use
- ⚠️ **Commercial Use**: Contact for licensing inquiries
- ❌ **Redistribution**: Please contact before redistributing modified versions

For licensing inquiries, please contact: sales@hetech-me.space




### Security Contributions

If you find a security vulnerability:
1. **DO NOT** open a public issue
2. Email: sales@hetech-me.space with subject "SECURITY"
3. Include detailed description and proof-of-concept
4. We'll respond within 48 hours

## 🔒 Security Audit History

| Date | Version | Auditor | Score | Report |
|------|---------|---------|-------|--------|
| 2026-01-05 | v1.1.0 | AI Security Audit | **92/100** | [View Report](SECURITY_IMPROVEMENTS_REPORT.md) |
| 2025-12-20 | v1.0.0 | Internal | 85/100 | Initial release |

## 🏆 Acknowledgments

- **OWASP** for security guidelines
- **EFF** for wordlist standards (BIP39)
- **hash-wasm** for Argon2id implementation
- **zxcvbn** for password strength analysis
- **Electron** community for the framework

## 📞 Support & Contact

- **GitHub Issues**: [Bug Reports & Feature Requests](https://github.com/hafgit99/aegis/issues/new?template=bug_report.md)
- **Email**: sales@hetech-me.space
- **Security**: sales@hetech-me.space (PGP key available on request)
- **Twitter/X**: Coming soon

## ⭐ Star History

If you find Aegis Vault useful, please consider giving it a star on GitHub!

[![Star History Chart](https://api.star-history.com/svg?repos=hafgit99/aegis&type=Date)](https://star-history.com/#hafgit99/aegis&Date)

---

**Built with 🔐 by Aegis Security**

*Aegis Vault - Your Secrets, Your Control. Zero Knowledge, Maximum Security.*
