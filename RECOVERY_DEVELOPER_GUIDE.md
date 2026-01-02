# Recovery Words v4.0 - Developer Integration Guide

## Quick Start for Developers

### Using Recovery Words in Your Code

#### 1. Generate Recovery Words
```typescript
import { RecoveryService } from '../services/recoveryService';

const result = await RecoveryService.setupRecovery(masterKey, true); // true = PIN protection
console.log(result.words);      // ['alpha', 'bravo', ...]
console.log(result.pin);        // '123456' (if protection enabled)
console.log(result.checksum);   // 'abc123def456...'
```

#### 2. Check Recovery Status
```typescript
const status = RecoveryService.getRecoveryStatus();
if (status.isSetup) {
  console.log(`Recovery verified: ${status.metadata?.lastVerified}`);
  console.log(`Needs verification: ${status.needsVerification}`);
}
```

#### 3. Recover Vault
```typescript
try {
  const masterKey = await RecoveryService.recoverVault(
    words,        // ['alpha', 'bravo', ...]
    pin           // '123456' if PIN protected
  );
  // Use masterKey to decrypt vault
} catch (error) {
  if (error.message === 'PIN_REQUIRED') {
    // Show PIN input dialog
  } else if (error.message === 'INVALID_PIN') {
    // Show "PIN incorrect" error
  } else if (error.message === 'DEVICE_MISMATCH') {
    // Show "Recovery not supported on this device" error
  }
}
```

#### 4. Validate Words
```typescript
const validation = RecoveryService.validateRecoveryWords(userEnteredWords);
if (!validation.valid) {
  console.error('Invalid words:', validation.errors);
}
```

#### 5. Export Recovery
```typescript
const jsonBackup = RecoveryService.exportRecoveryAsJSON();
// Download as file
const blob = new Blob([jsonBackup], { type: 'application/json' });
// ... create download link
```

#### 6. Import Recovery
```typescript
const result = await RecoveryService.importRecoveryFromJSON(jsonData);
if (result.success) {
  console.log('Recovery imported successfully');
}
```

## Architecture Overview

### Component Hierarchy
```
Dashboard (main component)
├── RecoveryWordsView (modal)
│   ├── Setup Stage
│   │   ├── PIN protection toggle
│   │   └── Generate button
│   ├── Verify Stage
│   │   ├── Word grid (4x4)
│   │   ├── Copy all button
│   │   ├── Checksum display
│   │   ├── PIN display (if protected)
│   │   ├── Export button
│   │   └── Verify button
│   └── Complete Stage
│       └── Success message
└── Security Tab
    └── Recovery status indicator
```

### Service Architecture
```
RecoveryService (static class)
├── Word Generation
│   ├── generateWords()
│   ├── RECOVERY_WORDS_POOL (75 words)
│   └── calculateWordsChecksum()
├── Key Derivation
│   ├── deriveKeyFromWords() [v4.0]
│   ├── deriveKeyFromWordsLegacy() [v3.0/v2.1]
│   └── getDeviceIdFromElectron()
├── Setup & Management
│   ├── setupRecovery()
│   ├── getRecoveryMetadata()
│   ├── resetRecovery()
│   └── validateDeviceBinding()
├── PIN Protection
│   ├── generateRecoveryPIN()
│   ├── hashRecoveryPIN()
│   └── verifyRecoveryPIN()
├── Vault Recovery
│   └── recoverVault()
├── Import/Export
│   ├── exportRecoveryAsJSON()
│   └── importRecoveryFromJSON()
├── Status & Validation
│   ├── getRecoveryStatus()
│   ├── validateRecoveryWords()
│   └── verifyChecksumIntegrity()
└── Device Security
    └── validateDeviceBinding()
```

## Data Flow Diagram

### Recovery Setup Flow
```
User Clicks "Generate Recovery"
    ↓
Check Master Key exists
    ↓
[Optional] Generate PIN
    ↓
Generate 16 random words from pool
    ↓
Derive key from words + device ID
    ↓
Encrypt master key with recovery key
    ↓
Calculate checksum
    ↓
Store in localStorage:
  - aegis_recovery_blob
  - aegis_recovery_hash (PIN if protected)
  - aegis_recovery_metadata
    ↓
Return { words, pin?, checksum }
    ↓
Display in UI (never stored in localStorage)
```

### Vault Recovery Flow
```
User enters recovery words + PIN
    ↓
Validate word format
    ↓
[If PIN required] Verify PIN
    ↓
Derive key from words + device ID
    ↓
Fetch encrypted blob from localStorage
    ↓
Decrypt master key
    ↓
Return master key for vault decryption
    ↓
User can now access vault
```

### Export/Import Flow
```
Export:
  localStorage (encrypted blob + metadata)
    ↓
  JSON format
    ↓
  Download to user's device

Import:
  User selects JSON file
    ↓
  Validate structure
    ↓
  Store in localStorage
    ↓
  Update metadata
    ↓
  Audit log
```

## LocalStorage Structure

```javascript
// Recovery blob (encrypted master key + metadata)
localStorage['aegis_recovery_blob'] = {
  payload: "base64-encoded-ciphertext",
  iv: "base64-encoded-iv",
  tag: "base64-encoded-auth-tag",
  metadata: {
    version: "4.0",
    timestamp: 1705315200000,
    deviceId: "DEVICE-UUID",
    wordCount: 16,
    checksum: "abc123def456",
    createdAt: 1705315200000,
    verificationCount: 2,
    isActive: true
  }
}

// PIN hash (SHA-256 of PIN, if protection enabled)
localStorage['aegis_recovery_hash'] = "base64-encoded-sha256-hash"

// Metadata copy (for quick access)
localStorage['aegis_recovery_metadata'] = {
  version: "4.0",
  timestamp: 1705315200000,
  deviceId: "DEVICE-UUID",
  wordCount: 16,
  checksum: "abc123def456",
  createdAt: 1705315200000,
  lastVerified: 1705400000000,
  verificationCount: 2,
  isActive: true
}
```

## Error Handling

### Common Error Cases

#### "PIN_REQUIRED"
- Recovery is PIN-protected but no PIN provided
- Solution: Prompt user for PIN input

#### "INVALID_PIN"
- PIN provided doesn't match stored hash
- Solution: Show "PIN incorrect" error, allow retry

#### "INVALID_WORD_COUNT"
- User entered wrong number of words
- Solution: Show "Must enter exactly 16 words" error

#### "INVALID_RECOVERY_WORDS"
- One or more words not in recovery pool
- Solution: Show "Invalid word(s): X, Y, Z" error

#### "RECOVERY_AUTH_FAILED"
- Failed to decrypt master key with recovery key
- Solution: Show "Recovery failed, please check words" error

#### "DEVICE_MISMATCH"
- Recovery was created on different device
- Solution: Show "Recovery is device-specific" error

#### "NO_RECOVERY_BLOB"
- No recovery setup found
- Solution: Show "No recovery configured" message

### Implementing Custom Error Handlers

```typescript
try {
  const masterKey = await RecoveryService.recoverVault(words, pin);
} catch (error: any) {
  switch (error.message) {
    case 'PIN_REQUIRED':
      showPINInputModal();
      break;
    case 'INVALID_PIN':
      showError('Incorrect PIN. Please try again.');
      break;
    case 'INVALID_RECOVERY_WORDS':
      showError('Invalid recovery words. Please check and try again.');
      break;
    case 'DEVICE_MISMATCH':
      showError('Recovery was created on a different device.');
      break;
    default:
      showError('Recovery failed: ' + error.message);
  }
}
```

## Testing Recovery Functionality

### Test Case 1: Basic Recovery Setup
```typescript
test('should generate recovery words with checksum', async () => {
  const { words, checksum } = await RecoveryService.setupRecovery(masterKey);
  
  expect(words.length).toBe(16);
  expect(checksum).toBeDefined();
  expect(words.every(w => RECOVERY_WORDS_POOL.includes(w))).toBe(true);
});
```

### Test Case 2: PIN Protection
```typescript
test('should protect recovery with PIN', async () => {
  const { words, pin } = await RecoveryService.setupRecovery(masterKey, true);
  
  expect(pin).toBeDefined();
  expect(pin?.length).toBeGreaterThanOrEqual(4);
  
  // Verify PIN is required
  await expect(RecoveryService.recoverVault(words))
    .rejects.toThrow('PIN_REQUIRED');
  
  // Verify correct PIN works
  const key = await RecoveryService.recoverVault(words, pin);
  expect(key).toBeDefined();
});
```

### Test Case 3: Word Validation
```typescript
test('should validate recovery words', () => {
  const valid = RecoveryService.validateRecoveryWords(
    ['alpha', 'bravo', 'charlie', ...]  // 16 words
  );
  expect(valid.valid).toBe(true);
  
  const invalid = RecoveryService.validateRecoveryWords(
    ['invalid', 'words', ...]  // 16 invalid words
  );
  expect(invalid.valid).toBe(false);
  expect(invalid.errors.length).toBeGreaterThan(0);
});
```

### Test Case 4: Export/Import
```typescript
test('should export and import recovery', async () => {
  const { words, pin, checksum } = await RecoveryService.setupRecovery(masterKey, true);
  
  const jsonBackup = RecoveryService.exportRecoveryAsJSON();
  expect(jsonBackup).toContain('version');
  expect(jsonBackup).not.toContain(words[0]); // Words not in export
  
  RecoveryService.resetRecovery();
  
  const result = await RecoveryService.importRecoveryFromJSON(jsonBackup);
  expect(result.success).toBe(true);
});
```

## Integration with Dashboard

### Adding Recovery Button to Security Tab
```tsx
<div className="security-section">
  <button
    onClick={() => setShowRecoveryWords(true)}
    className="recovery-button"
  >
    <Key size={20} />
    {t('recovery_words')}
  </button>
  
  {showRecoveryWords && (
    <AnimatePresence>
      <RecoveryWordsView onClose={() => setShowRecoveryWords(false)} />
    </AnimatePresence>
  )}
</div>
```

### Displaying Recovery Status
```tsx
const status = RecoveryService.getRecoveryStatus();

<div className="recovery-status">
  {status.isSetup ? (
    <>
      <span className="status-badge active">
        {status.needsVerification 
          ? t('recovery_status_needs_verification')
          : t('recovery_status_active')}
      </span>
      {status.metadata && (
        <p className="metadata">
          {t('recovery_metadata_verified', {
            date: new Date(status.metadata.lastVerified).toLocaleDateString()
          })}
        </p>
      )}
    </>
  ) : (
    <span className="status-badge inactive">{t('recovery_no_setup_found')}</span>
  )}
</div>
```

## Audit Logging

Recovery events are automatically logged to Electron's audit system:

```typescript
// setupRecovery() logs:
{
  event: 'RECOVERY_WORDS_GENERATED',
  timestamp: Date.now(),
  version: '4.0',
  checksum: 'abc123...',
  pinProtected: true
}

// verifyRecoveryPIN() updates metadata:
{
  lastVerified: Date.now(),
  verificationCount: (previous + 1)
}

// resetRecovery() logs:
{
  event: 'RECOVERY_WORDS_RESET',
  timestamp: Date.now()
}

// importRecoveryFromJSON() logs:
{
  event: 'RECOVERY_WORDS_IMPORTED',
  timestamp: Date.now(),
  version: '4.0'
}
```

## Performance Considerations

### Key Derivation Time
- Argon2id with device ID salt: ~100-200ms
- PBKDF2 fallback: ~50ms
- Async to avoid UI blocking

### Storage Size
- Recovery blob: ~2-3KB (encrypted)
- Metadata: ~500 bytes
- Total localStorage: < 5KB (minimal impact)

### Export/Import
- JSON generation: < 10ms
- JSON parsing: < 5ms
- Non-blocking operations

## Security Best Practices

### For Users
1. ✅ Write recovery words on paper
2. ✅ Store in secure location (safe/vault)
3. ✅ Enable PIN protection for extra security
4. ✅ Export JSON backup periodically
5. ✅ Test recovery process quarterly
6. ✅ Never share recovery words with anyone

### For Developers
1. ✅ Never log recovery words to console
2. ✅ Never store words in localStorage
3. ✅ Always use encrypted storage for backups
4. ✅ Validate user input before processing
5. ✅ Clear sensitive data from memory
6. ✅ Audit log all recovery operations
7. ✅ Use device binding for security

## Troubleshooting Checklist

- [ ] Recovery words pool contains 75 curated words
- [ ] Checksum calculation is consistent
- [ ] Device ID is retrieved correctly from Electron
- [ ] localStorage is available and not full
- [ ] Argon2id is loaded correctly (hash-wasm)
- [ ] AES-256-GCM encryption/decryption works
- [ ] PIN hashing produces consistent results
- [ ] Metadata is updated on successful recovery
- [ ] Audit logging is functional
- [ ] All error cases are handled gracefully

## References

- [Recovery Words Enhancement Documentation](./RECOVERY_WORDS_ENHANCEMENTS.md)
- [Implementation Summary](./RECOVERY_IMPLEMENTATION_SUMMARY.md)
- [Password Strength Analysis](./PASSWORD_GENERATOR_ANALYSIS.md)
- [Aegis Vault README](./README.md)

---

**Last Updated:** January 2025
**Version:** 4.0 Developer Guide
**Status:** Ready for Integration ✅
