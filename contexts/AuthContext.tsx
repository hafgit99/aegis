
import React, { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextType {
  masterKey: CryptoKey | null;
  setKey: (key: CryptoKey | null, rawKey?: Uint8Array) => void;
  isAuthenticated: boolean;
  logout: () => void;
  deriving: boolean;
  setDeriving: (val: boolean) => void;
  isVerifying2FA: boolean;
  setVerifying2FA: (val: boolean) => void;
  tempMasterKey: CryptoKey | null;
  setTempMasterKey: (key: CryptoKey | null, rawKey?: Uint8Array) => void;
  withMasterKeyRaw: <T>(callback: (raw: Uint8Array) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [tempMasterKey, setTempMasterKeyState] = useState<CryptoKey | null>(null);
  const [tempRawKey, setTempRawKey] = useState<Uint8Array | undefined>(undefined);
  const [deriving, setDeriving] = useState(false);
  const [isVerifying2FA, setVerifying2FA] = useState(false);

  // SECURITY: Raw key is kept in closure, not state, to prevent React DevTools exposure
  // This is the only way to support "Non-Extractable Master Key" policy
  const rawMasterKeyRef = React.useRef<Uint8Array | null>(null);

  const setTempMasterKey = (key: CryptoKey | null, rawKey?: Uint8Array) => {
    setTempMasterKeyState(key);
    if (key) {
      if (rawKey) setTempRawKey(rawKey);
    } else {
      setTempRawKey(undefined);
    }
  };

  const setKey = async (key: CryptoKey | null, rawKey?: Uint8Array) => {
    setMasterKey(key);

    if (key && rawKey) {
      // Store in ref (heap) but protected by closure access
      rawMasterKeyRef.current = rawKey;

      // Memory Shield: Push key to Main Process (Privileged RAM)
      if ((window as any).electronAPI?.vault) {
        try {
          await (window as any).electronAPI.vault.setKey(rawKey);
          // Note: We keep rawMasterKeyRef for recovery setup operations that need it
          // SecureMemory.wipe(rawKey); // Do not wipe yet if we want to allow recovery setup without re-auth
        } catch (e) {
          console.error("Secure Key Push Failed", e);
        }
      }
    } else if (!key) {
      // Clear
      if (rawMasterKeyRef.current) {
        rawMasterKeyRef.current.fill(0);
        rawMasterKeyRef.current = null;
      }
    }
  };

  // SECURITY: Accessor for raw key operations (like Recovery Setup)
  const withMasterKeyRaw = async <T,>(callback: (raw: Uint8Array) => Promise<T>): Promise<T> => {
    if (!rawMasterKeyRef.current) {
      throw new Error("MASTER_KEY_NOT_AVAILABLE");
    }
    return callback(rawMasterKeyRef.current);
  };

  const logout = useCallback(async () => {
    setMasterKey(null);
    setTempMasterKey(null);
    setTempRawKey(undefined);
    setDeriving(false);
    setVerifying2FA(false);

    // Secure wipe
    if (rawMasterKeyRef.current) {
      rawMasterKeyRef.current.fill(0);
      rawMasterKeyRef.current = null;
    }

    // Memory Shield: Wipe key from Main Process RAM
    if ((window as any).electronAPI?.vault) {
      await (window as any).electronAPI.vault.clearKey();
    }
  }, []);

  const isAuthenticated = !!masterKey;

  return (
    <AuthContext.Provider value={{
      masterKey,
      setKey,
      isAuthenticated,
      logout,
      deriving,
      setDeriving,
      isVerifying2FA,
      setVerifying2FA,
      tempMasterKey,
      setTempMasterKey,
      withMasterKeyRaw
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
