import { useEffect, useRef, useCallback } from 'react';

export const useAutoLock = (onLock: () => void, isAuthenticated: boolean) => {
  const timeoutRef = useRef<number | null>(null);

  const getAutoLockDuration = useCallback(() => {
    const saved = localStorage.getItem('aegis_autolock_ms');
    // Default 15 minutes if not set. -1 means "Never"
    return saved ? parseInt(saved) : 15 * 60 * 1000;
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    
    if (isAuthenticated) {
      const duration = getAutoLockDuration();
      
      // If duration is -1, we never lock based on time
      if (duration === -1) return;

      timeoutRef.current = window.setTimeout(() => {
        onLock();
      }, duration);
    }
  }, [isAuthenticated, onLock, getAutoLockDuration]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => resetTimer();

    const handleVisibilityChange = () => {
      const lockOnBg = localStorage.getItem('aegis_lock_on_bg') === 'true';
      if (document.visibilityState === 'hidden' && isAuthenticated && lockOnBg) {
        onLock();
      }
    };

    if (isAuthenticated) {
      events.forEach(event => window.addEventListener(event, handleActivity));
      document.addEventListener('visibilitychange', handleVisibilityChange);
      resetTimer();
    }

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [isAuthenticated, resetTimer, onLock]);
};