
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
    if (electronAPI?.extension) {
      const extension = electronAPI.extension;

      extension.onSearch(async (event: any, { query, requestId }: any) => {
        if (!entries || !masterKey) {
          console.log("[Extension] Search ignored: Vault locked or entries empty");
          return;
        }

        const searchTerm = query.toLowerCase();
        const filtered = entries
          .filter(item => {
            const titleMatch = item.title?.toLowerCase().includes(searchTerm);
            const userMatch = item.username?.toLowerCase().includes(searchTerm);
            return titleMatch || userMatch;
          })
          .slice(0, 10) // Support up to 10 results
          .map(item => ({
            id: item.id,
            title: item.title || "Unnamed Entry",
            username: item.username || ""
          }));

        console.log(`[Extension] Search for "${query}" found ${filtered.length} results`);
        extension.sendResult(`search-result-${requestId}`, filtered);
      });

      extension.onGetCreds(async (event: any, { entryId, requestId }: any) => {
        if (!masterKey) return;
        const entry = entries.find(i => i.id === entryId);
        if (entry) {
          const sensitive = await VaultService.decryptEntry(entry, masterKey);
          extension.sendResult(`cred-result-${requestId}`, {
            username: entry.username,
            password: sensitive.password
          });
        }
      });
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
