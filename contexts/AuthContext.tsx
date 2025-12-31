
import React, { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextType {
  masterKey: CryptoKey | null;
  setKey: (key: CryptoKey | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
  deriving: boolean;
  setDeriving: (val: boolean) => void;
  isVerifying2FA: boolean;
  setVerifying2FA: (val: boolean) => void;
  tempMasterKey: CryptoKey | null;
  setTempMasterKey: (key: CryptoKey | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [tempMasterKey, setTempMasterKey] = useState<CryptoKey | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [isVerifying2FA, setVerifying2FA] = useState(false);

  const setKey = async (key: CryptoKey | null) => {
    setMasterKey(key);

    // Memory Shield: Push key to Main Process (Privileged RAM)
    if (key && (window as any).electronAPI?.vault) {
      try {
        const rawKey = await window.crypto.subtle.exportKey('raw', key);
        await (window as any).electronAPI.vault.setKey(rawKey);
        // Optional: Could clear rawKey here if needed
      } catch (e) {
        console.error("Secure Key Push Failed", e);
      }
    }
  };

  const logout = useCallback(async () => {
    setMasterKey(null);
    setTempMasterKey(null);
    setDeriving(false);
    setVerifying2FA(false);

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
      setTempMasterKey
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
