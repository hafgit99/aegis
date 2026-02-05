
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVault } from './hooks/useVault';
import { useAutoLock } from './hooks/useAutoLock';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VaultProvider } from './contexts/VaultContext';
import AuthPage from './i18n/components/AuthPage';
import Dashboard from './i18n/components/Dashboard';
import TitleBar from './i18n/components/TitleBar';
import { VaultService } from './services/vaultService';
import { PasskeyService } from './services/passkeyService';
import { CryptoService } from './services/cryptoService';
import { BiometricService } from './services/biometricService';
import { ShareService, ChunkedPayload } from './services/shareService';

const AppContent: React.FC = () => {
  const {
    unlock,
    lock,
    loadEntries,
    setup,
    isInitialized,
    entries
  } = useVault();

  const { isAuthenticated, masterKey, setKey } = useAuth();

  // Storage for multi-part QR codes coming from the extension
  const qrChunks = React.useRef<Map<string, ChunkedPayload[]>>(new Map());

  // Listen for OS-level lock triggers (sleep/lock screen)
  React.useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onLockTrigger) {
      const cleanup = electronAPI.onLockTrigger(() => {
        if (isAuthenticated) {
          console.log("OS-level lock triggered");
          lock();
        }
      });
      return cleanup;
    }
  }, [isAuthenticated, lock]);

  // High-security idle timer (15 minutes) with countdown tracking
  const lockStatus = useAutoLock(lock, isAuthenticated);

  // Browser Extension Integration
  React.useEffect(() => {
    const electronAPI = (window as any).electronAPI;

    // Only proceed if API is available
    if (electronAPI?.extension) {
      const extension = electronAPI.extension;

      const removeSearch = extension.onSearch(async (event: any, { query, requestId }: any) => {
        if (!entries || !masterKey) {
          extension.sendResult(`search-result-${requestId}`, { error: "VAULT_LOCKED" });
          return;
        }

        let results = [];
        const searchTerm = query ? query.toLowerCase().trim() : "";

        // Boş arama ise son 10 kaydı dön (Kullanıcıya kolaylık)
        if (!searchTerm) {
          results = entries.slice(0, 10);
        } else {
          // Domain parse etme (google.com -> google)
          let domainKeyword = searchTerm;
          try {
            // Basit domain extraction
            const parts = searchTerm.split('.');
            if (parts.length >= 2) {
              domainKeyword = parts[parts.length - 2]; // amazon.com -> amazon
            }
          } catch (e) { }

          // 1. Metadata (Title/Username) üzerinde ara
          results = entries.filter(item => {
            const title = item.title?.toLowerCase() || "";
            const username = item.username?.toLowerCase() || "";

            // Tam eşleşme veya keyword eşleşmesi
            if (title.includes(searchTerm) || username.includes(searchTerm)) return true;
            if (domainKeyword && domainKeyword.length > 3) {
              if (title.includes(domainKeyword)) return true;
            }
            return false;
          });

          // 2. Eğer metadata ile çok az sonuç bulduysak veya hiç bulamadıysak, 
          // ve arama bir domain ise, URL kontrolü yap (Maliyetli ama gerekli)
          // (Şimdilik performans için sadece ilk 50 kaydı tarıyoruz)
          if (results.length === 0 && searchTerm.includes('.')) {
            for (const entry of entries.slice(0, 50)) {
              // Zaten bulduklarımızı atla
              if (results.find(r => r.id === entry.id)) continue;

              try {
                const sensitive = await VaultService.decryptEntry(entry, masterKey);
                if (sensitive.url && sensitive.url.toLowerCase().includes(domainKeyword)) {
                  results.push(entry);
                }
              } catch (e) { }
              if (results.length >= 5) break;
            }
          }
        }

        const mapped = results.map(item => ({
          id: item.id,
          title: item.title || "Unnamed Entry",
          username: item.username || ""
        }));

        console.log(`[Extension] Search for "${query}" found ${mapped.length} results`);
        extension.sendResult(`search-result-${requestId}`, mapped);
      });

      const removeGetCreds = extension.onGetCreds(async (event: any, { entryId, requestId }: any) => {
        if (!masterKey) return;
        const entry = entries.find(i => i.id === entryId);
        if (entry) {
          try {
            const sensitive = await VaultService.decryptEntry(entry, masterKey);
            extension.sendResult(`cred-result-${requestId}`, {
              username: entry.username,
              password: sensitive.password
            });
          } catch (e) {
            extension.sendResult(`cred-result-${requestId}`, { error: "DECRYPT_FAILED" });
          }
        }
      });

      const removePasskey = extension.onPasskeySign(async (event: any, { entryId, challenge, requestId }: any) => {
        if (!masterKey) return;
        const entry = entries.find(i => i.id === entryId);
        if (entry) {
          try {
            // Require biometric approval for Passkey signing (High-Security)
            const isVerified = await BiometricService.verifyUser();
            if (!isVerified) {
              console.log("[Extension] Passkey signing rejected: Biometric verification failed");
              extension.sendResult(`passkey-result-${requestId}`, { error: "USER_REJECTED_BIOMETRIC" });
              return;
            }

            const sensitive = await VaultService.decryptEntry(entry, masterKey);
            if (sensitive.passkeyDetails) {
              // Convert challenge from base64 string to ArrayBuffer if necessary
              const challengeBuffer = typeof challenge === 'string'
                ? CryptoService.base64ToArrayBuffer(challenge)
                : challenge;

              const assertion = await PasskeyService.signChallenge(sensitive.passkeyDetails, challengeBuffer, masterKey);

              // REPLAY PROTECTION: Persist the new counter BEFORE responding
              await VaultService.updatePasskeyCounter(entry.id, assertion.newCounter, masterKey);
              await loadEntries(true);

              extension.sendResult(`passkey-result-${requestId}`, assertion);
            } else {
              extension.sendResult(`passkey-result-${requestId}`, { error: "NOT_A_PASSKEY" });
            }
          } catch (e) {
            console.error("[Extension] Passkey signing error:", e);
            extension.sendResult(`passkey-result-${requestId}`, { error: "SIGN_FAILED" });
          }
        }
      });

      const removeQRScanned = extension.onQRScanned(async (event: any, { qrData }: any) => {
        try {
          // Process the QR data (handles single or multi-chunk QR codes)
          const result = await ShareService.processQRData(qrData, qrChunks.current);

          if (result.isComplete && result.payload) {
            console.log("[Extension] QR Share fully received!", result.payload);
            // Open import modal or show notification in Dashboard
            // For now, we'll store it in a way the app can use
            (window as any).pendingQRShare = result.payload;

            // Trigger a custom event to notify components (like Dashboard)
            window.dispatchEvent(new CustomEvent('aegis:qr-received', { detail: result.payload }));
          } else if (result.chunksNeeded) {
            console.log(`[Extension] QR Chunk received. Still need ${result.chunksNeeded} more.`);
          }
        } catch (e) {
          console.error("[Extension] Failed to process QR data:", e);
        }
      });

      // CLEANUP FUNCTION to remove listeners when dependencies change
      return () => {
        if (removeSearch && typeof removeSearch === 'function') removeSearch();
        if (removeGetCreds && typeof removeGetCreds === 'function') removeGetCreds();
        if (removePasskey && typeof removePasskey === 'function') removePasskey();
        if (removeQRScanned && typeof removeQRScanned === 'function') removeQRScanned();
      };
    }
  }, [entries, masterKey]);

  return (
    <div className="h-screen w-screen bg-[#050505] text-zinc-50 overflow-hidden flex flex-col">
      {/* TitleBar is now part of flex flow */}
      <TitleBar />

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col relative bg-[#050505]">
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="app-auth-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <AuthPage
                isInitialized={isInitialized}
                onUnlock={unlock}
                onSetup={async (password) => {
                  await setup(password);
                  // setup internally calls setKey through VaultContext, but let's ensure Auth state is updated
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="app-dashboard-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <Dashboard
                onLogout={lock}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <VaultProvider>
      <AppContent />
    </VaultProvider>
  </AuthProvider>
);

export default App;
