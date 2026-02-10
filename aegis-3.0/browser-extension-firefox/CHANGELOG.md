# Aegis Vault Firefox Extension - Changelog

## Version 1.0.2 (2026-02-05)

### 🐛 Bug Fixes
- **Critical Fix**: Added missing jsQR library for QR code scanning functionality
- **QR Scanner**: Improved QR code detection with dual-pass scanning (normal + inverted)
- **Error Handling**: Enhanced error logging and debugging for QR code scanning
- **User Experience**: Better error messages when QR code cannot be detected

### 📦 Files Added
- `jsQR.js` - QR code scanning library (v1.4.0)

### 🔧 Files Modified
- `popup.html` - Added jsQR library script tag
- `popup.js` - Enhanced QR scanning function with better error handling and dual-pass detection
- `manifest.json` - Version bump to 1.0.2

### 📝 Technical Details
The QR code scanning feature was not working in version 1.0.1 because the jsQR library was missing. This update:
1. Includes the jsQR library (https://github.com/cozmo/jsQR)
2. Implements two-pass QR detection (normal and color-inverted)
3. Adds comprehensive console logging for debugging
4. Improves error handling with try-catch blocks

---

## Version 1.0.1 (2026-02-04)

### ✨ Initial Release
- Native messaging integration with Aegis Vault desktop application
- Password autofill functionality
- QR code sharing support (fixed in 1.0.2)
- Secure credential management
- Firefox Manifest V2 compatibility
