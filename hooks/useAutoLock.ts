import { useEffect, useRef, useCallback, useState } from 'react';

export interface AutoLockStatus {
  remainingMs: number; // Remaining time in milliseconds
  remainingSeconds: number; // Remaining time in seconds
  isWarning: boolean; // True if within 1 minute of lock
  percentRemaining: number; // 0-100 percentage of time remaining
  isLocked: boolean; // True if locked
}

export const useAutoLock = (onLock: () => void, isAuthenticated: boolean) => {
  const timeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const lockTimeRef = useRef<number | null>(null);
  const [lockStatus, setLockStatus] = useState<AutoLockStatus>({
    remainingMs: 0,
    remainingSeconds: 0,
    isWarning: false,
    percentRemaining: 100,
    isLocked: !isAuthenticated,
  });

  const getAutoLockDuration = useCallback(() => {
    const saved = localStorage.getItem('aegis_autolock_ms');
    // Default 15 minutes if not set. -1 means "Never"
    return saved ? parseInt(saved) : 15 * 60 * 1000;
  }, []);

  // Update countdown display every second
  const updateCountdown = useCallback(() => {
    if (!lockTimeRef.current) return;

    const now = Date.now();
    const remainingMs = Math.max(0, lockTimeRef.current - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const duration = getAutoLockDuration();
    const percentRemaining = duration > 0 ? Math.ceil((remainingMs / duration) * 100) : 100;

    setLockStatus(prev => ({
      ...prev,
      remainingMs,
      remainingSeconds,
      isWarning: remainingSeconds > 0 && remainingSeconds <= 60,
      percentRemaining,
      isLocked: false,
    }));

    // Auto-lock when time expires
    if (remainingMs <= 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      onLock();
    }
  }, [getAutoLockDuration, onLock]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    if (isAuthenticated) {
      const duration = getAutoLockDuration();
      
      // If duration is -1, we never lock based on time
      if (duration === -1) {
        setLockStatus(prev => ({
          ...prev,
          remainingMs: -1,
          remainingSeconds: -1,
          isWarning: false,
          percentRemaining: 100,
          isLocked: false,
        }));
        return;
      }

      // Set lock time
      lockTimeRef.current = Date.now() + duration;

      // Start countdown interval (update every second)
      countdownIntervalRef.current = window.setInterval(updateCountdown, 1000);

      // Initial update
      updateCountdown();

      // Set timeout for lock
      timeoutRef.current = window.setTimeout(() => {
        onLock();
      }, duration);
    }
  }, [isAuthenticated, onLock, getAutoLockDuration, updateCountdown]);

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
    } else {
      setLockStatus(prev => ({ ...prev, isLocked: true }));
    }

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isAuthenticated, resetTimer, onLock]);

  return lockStatus;
};