
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVault } from './hooks/useVault.ts';
import { useAutoLock } from './hooks/useAutoLock.ts';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { VaultProvider } from './contexts/VaultContext.tsx';
import AuthPage from './components/AuthPage.tsx';
import Dashboard from './components/Dashboard.tsx';
import TitleBar from './components/TitleBar.tsx';
import { VaultService } from './services/vaultService.ts';
import { PasskeyService } from './services/passkeyService.ts';
import { CryptoService } from './services/cryptoService.ts';
import { BiometricService } from './services/biometricService.ts';

const AppContent: React.FC = () => {
  const {
    unlock,
    lock,
    setup,
    isInitialized
  } = useVault();

  const { isAuthenticated, masterKey } = useAuth();
  const { entries } = useVault();

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

              const assertion = await PasskeyService.signChallenge(sensitive.passkeyDetails, challengeBuffer);
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

      // CLEANUP FUNCTION to remove listeners when dependencies change
      return () => {
        if (removeSearch && typeof removeSearch === 'function') removeSearch();
        if (removeGetCreds && typeof removeGetCreds === 'function') removeGetCreds();
        if (removePasskey && typeof removePasskey === 'function') removePasskey();
      };
    }
  }, [entries, masterKey]);

  return (
    <div className="h-full w-full bg-[#050505] text-zinc-50 overflow-hidden flex flex-col">
      {/* TitleBar is now part of flex flow */}
      <TitleBar />

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col relative bg-[#050505]">
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <AuthPage
                isInitialized={isInitialized}
                onUnlock={unlock}
                onSetup={setup}
              />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              <Dashboard
                onLogout={lock}
                lockStatus={lockStatus}
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
