import React, { useEffect, useCallback } from 'react';
import { useVaultStore } from '../../store/vaultStore';

export const AutoLock: React.FC = () => {
    const { isLocked, lock } = useVaultStore();

    const handleAutoLock = useCallback(async () => {
        if (isLocked) return;

        const autoLockMinutes = parseInt(localStorage.getItem('autoLockTime') || '5');
        if (autoLockMinutes === 0) return; // 'Never'

        const lastActivity = parseInt(localStorage.getItem('lastActivity') || Date.now().toString());
        const now = Date.now();
        const inactiveMs = now - lastActivity;

        if (inactiveMs > autoLockMinutes * 60 * 1000) {
            console.log(`[SECURITY] Auto-locking due to ${autoLockMinutes}m inactivity`);
            await window.aegis.vault.close();
            lock();
        }
    }, [isLocked, lock]);

    const updateActivity = useCallback(() => {
        localStorage.setItem('lastActivity', Date.now().toString());
        // Report activity to Main process for background monitor
        window.aegis.system.reportActivity();
    }, []);

    useEffect(() => {
        if (isLocked) return;

        // Listen for force-lock from Main Process
        window.aegis.vault.onForceLock(() => {
            console.log('[SECURITY] Received force-lock signal from Main');
            lock();
        });

        // Update activity on various events
        const events = ['mousedown', 'keydown', 'touchstart', 'mousemove', 'scroll'];
        events.forEach(evt => window.addEventListener(evt, updateActivity));

        // Start with current time
        updateActivity();

        // Check every 30 seconds (Renderer-side fallback)
        const interval = setInterval(handleAutoLock, 30000);

        return () => {
            events.forEach(evt => window.removeEventListener(evt, updateActivity));
            clearInterval(interval);
        };
    }, [isLocked, updateActivity, handleAutoLock, lock]);

    return null;
};
