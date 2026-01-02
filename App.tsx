
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useVault } from './hooks/useVault.ts';
import { useAutoLock } from './hooks/useAutoLock.ts';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { VaultProvider } from './contexts/VaultContext.tsx';
import AuthPage from './components/AuthPage.tsx';
import Dashboard from './components/Dashboard.tsx';
import TitleBar from './components/TitleBar.tsx';

const AppContent: React.FC = () => {
  const {
    unlock,
    lock,
    setup,
    isInitialized
  } = useVault();

  const { isAuthenticated } = useAuth();

  // Listen for OS-level lock triggers (sleep/lock screen)
  React.useEffect(() => {
    if ((window as any).electronAPI?.onLockTrigger) {
      const cleanup = (window as any).electronAPI.onLockTrigger(() => {
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

  return (
    <div className="h-screen w-screen bg-[#050505] text-zinc-50 select-none overflow-hidden flex flex-col">
      {/* TitleBar is fixed positioned */}
      <TitleBar />

      {/* Main content with padding for title bar */}
      <div className="flex-1 overflow-hidden flex flex-col pt-8">
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                scale: 1.1,
                filter: "blur(40px)",
              }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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
              initial={{ opacity: 0, scale: 0.95, filter: "blur(20px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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
