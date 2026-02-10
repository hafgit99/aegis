import React, { useEffect, useState } from 'react';
import BentoGrid from './components/dashboard/BentoGrid';
import './styles/globals.css';
import { useVaultStore } from './store/vaultStore';
import LockScreen from './components/auth/LockScreen';
import VaultBrowserModal from './components/dashboard/VaultBrowserModal';
import { UpdateNotification } from './components/updater/UpdateNotification';
import { BreachNotification } from './components/security/BreachNotification';

import { AutoLock } from './components/security/AutoLock';
import WatchtowerModal from './components/dashboard/WatchtowerModal';
import AddEntryModal from './components/dashboard/AddEntryModal';

const App: React.FC = () => {
    const { isLocked, scanAllBreaches, addEntryModalOpen, setAddEntryModalOpen, editingEntry, setEditingEntry } = useVaultStore();
    const [view, setView] = useState('dashboard');

    useEffect(() => {
        // Force dark mode
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.style.background = '';
        document.body.classList.remove('light-mode');

        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        if (viewParam) setView(viewParam);

        const checkStatus = async () => {
            try {
                // We intentionally do NOT automatically unlock here even if the DB is open.
                // This ensures the user must always pass through the LockScreen (and 2FA) on reload.
                // If needed, we could fetch status but keep isLocked = true.
                const isOpen = await window.aegis.database.isOpen();
                if (isOpen) {
                    console.log('[APP] Vault is already open. Closing it to force re-authentication.');
                    await window.aegis.vault.close();
                }
            } catch (error) {
                console.error('Failed to check vault status:', error);
            }
        };
        checkStatus();
    }, []);

    // Trigger breach scan once when unlocked
    useEffect(() => {
        if (!isLocked) {
            console.log('[APP] Vault unlocked, starting automatic breach scan...');
            // Wait a bit for entries to load
            setTimeout(() => {
                scanAllBreaches();
            }, 2000);
        }
    }, [isLocked, scanAllBreaches]);

    if (view === 'vault-explorer') {
        return (
            <div className="min-h-screen bg-[#0a0e1a] mesh-gradient overflow-hidden relative flex flex-col items-center justify-center p-4">
                <AutoLock />
                <div className="orb orb-primary" />
                <div className="orb orb-secondary" />
                <div className="orb orb-accent" />
                <div className="relative z-10 w-full max-w-[1400px] h-[95vh] rounded-3xl overflow-hidden glass-panel border border-white/5 shadow-2xl">
                    <VaultBrowserModal isOpen={true} onClose={() => window.close()} standalone={true} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen mesh-gradient overflow-hidden relative">
            <AutoLock />
            {/* Background Orbs */}
            <div className="orb orb-primary" />
            <div className="orb orb-secondary" />
            <div className="orb orb-accent" />

            {isLocked && <LockScreen />}

            <main className="container mx-auto px-4 py-8 relative z-10">
                <BentoGrid />
            </main>

            <UpdateNotification />
            <BreachNotification />
            <WatchtowerModal />
            <AddEntryModal
                isOpen={addEntryModalOpen || editingEntry !== null}
                onClose={() => {
                    setAddEntryModalOpen(false);
                    setEditingEntry(null);
                }}
            />
        </div>
    );
};

export default App;

