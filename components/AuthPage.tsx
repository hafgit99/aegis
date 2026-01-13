import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Cpu, CheckCircle2, Shield, Fingerprint, Info, X, Key, RotateCcw, Loader2, AlertCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { RecoveryService } from '../services/recoveryService.ts';
import { BiometricService } from '../services/biometricService.ts';
import { BruteForceService } from '../services/bruteForceService.ts';
import { useTheme } from '../contexts/ThemeContext.tsx';
import ImageBrandIcon from './ImageBrandIcon.tsx';
import EULAView from './EULAView.tsx';
import { CryptoService } from '../services/cryptoService.ts';
import { TwoFactorService } from '../services/twoFactorService.ts';
import { PasswordPolicy } from '../utils/passwordPolicy.ts';

interface AuthPageProps {
  isInitialized: boolean;
  onUnlock: (password: string) => Promise<void>;
  onSetup: (password: string) => Promise<void>;
}

type AuthState = 'idle' | 'stretching' | '2fa' | 'recovery' | 'success' | 'error';

const AuthPage: React.FC<AuthPageProps> = ({ isInitialized, onUnlock, onSetup }) => {
  const { t, lang, setLang } = useLanguage();
  const { theme } = useTheme();
  const { setKey, isVerifying2FA, setVerifying2FA, tempMasterKey, setDeriving, finalize2FA } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<AuthState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryWords, setRecoveryWords] = useState<string[]>(Array(24).fill(''));
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [showEulaModal, setShowEulaModal] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isSKAvailable, setIsSKAvailable] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isVerifyingTOTP, setIsVerifyingTOTP] = useState(false);

  // SECURITY: Password policy enforcement state
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordPolicyErrors, setPasswordPolicyErrors] = useState<string[]>([]);
  const [passwordPolicyWarnings, setPasswordPolicyWarnings] = useState<string[]>([]);

  // Match local status with context 2FA state
  useEffect(() => {
    if (isVerifying2FA) {
      setStatus('2fa');
    }
  }, [isVerifying2FA]);

  // Brute Force State
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    const initBruteForce = async () => {
      const status = await BruteForceService.checkStatus();
      setLockoutTimer(status.remaining);
      setFailedAttempts(status.attempts);
    };
    initBruteForce();

    return () => {
      setLockoutTimer(0);
      setFailedAttempts(0);
    };
  }, []);

  useEffect(() => {
    const checkBio = async () => {
      const isEnabled = BiometricService.isEnabled();
      const isSupported = await BiometricService.isSupported();
      setIsBiometricAvailable(isEnabled && isSupported);
      setIsSKAvailable(BiometricService.isSecurityKeyEnabled());
    };
    checkBio();
  }, []);

  // Brute Force Lockout Countdown
  useEffect(() => {
    if (lockoutTimer > 0) {
      const interval = setInterval(async () => {
        const status = await BruteForceService.checkStatus();
        setLockoutTimer(status.remaining);
        if (status.remaining <= 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutTimer]);

  // SECURITY: Real-time password policy validation
  useEffect(() => {
    if (!isInitialized && password.length > 0) {
      const policyResult = PasswordPolicy.validateMasterPassword(password);
      setPasswordStrength(policyResult.strength);
      setPasswordPolicyErrors(policyResult.errors);
      setPasswordPolicyWarnings(policyResult.warnings);
    } else {
      setPasswordStrength(0);
      setPasswordPolicyErrors([]);
      setPasswordPolicyWarnings([]);
    }
  }, [password, isInitialized]);

  const validatePassword = (pass: string): string | null => {
    // SECURITY: Use PasswordPolicy for comprehensive validation
    const policyResult = PasswordPolicy.validateMasterPassword(pass);

    if (!policyResult.valid) {
      // Return first error message
      return policyResult.errors[0] || (lang === 'tr'
        ? "Şifre güvenlik gereksinimlerini karşılamıyor."
        : "Password does not meet security requirements.");
    }

    return null;
  };

  const handleBiometricUnlock = async () => {
    if (lockoutTimer > 0) return;
    setStatus('stretching');
    try {
      const result = await BiometricService.unlock();
      if (result) {
        await BruteForceService.recordSuccess();
        await setKey(result.key, result.raw);
        setStatus('success');
      } else {
        await BruteForceService.recordFailure();
        const status = await BruteForceService.checkStatus();
        setFailedAttempts(status.attempts);
        setLockoutTimer(status.remaining);
        setStatus('idle');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(t('access_denied'));
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleSKUnlock = async () => {
    if (lockoutTimer > 0) return;
    setStatus('stretching');
    try {
      const result = await BiometricService.unlockWithSecurityKey();
      if (result) {
        await BruteForceService.recordSuccess();
        await setKey(result.key, result.raw);
        setStatus('success');
      } else {
        await BruteForceService.recordFailure();
        const status = await BruteForceService.checkStatus();
        setFailedAttempts(status.attempts);
        setLockoutTimer(status.remaining);
        setStatus('idle');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(t('access_denied'));
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'stretching' || lockoutTimer > 0) return;
    setErrorMessage(null);

    if (!isInitialized) {
      if (!eulaAccepted) {
        setErrorMessage(t('eula_must_accept'));
        return;
      }

      const validationError = validatePassword(password);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage(t('password_mismatch'));
        return;
      }
    }

    setStatus('stretching');
    try {
      if (isInitialized) {
        await onUnlock(password);
      } else {
        await onSetup(password);
        setStatus('success');
      }
    } catch (err: any) {
      setStatus('error');
      setFailedAttempts(BruteForceService.getAttempts());
      setLockoutTimer(BruteForceService.getLockoutRemaining());

      if (err.message === "BRUTE_FORCE_LOCKED") {
        setErrorMessage(t('brute_force_lockout').replace('{seconds}', lockoutTimer.toString()));
      } else {
        setErrorMessage(err.message || t('access_denied'));
      }

      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleRecoveryPaste = (e: React.ClipboardEvent, index: number) => {
    const text = e.clipboardData.getData('text');
    const words = text.trim().split(/[\s,]+/);
    if (words.length > 1) {
      e.preventDefault();
      const next = [...recoveryWords];
      for (let i = 0; i < words.length && (index + i) < 24; i++) {
        next[index + i] = words[i].toLowerCase().trim();
      }
      setRecoveryWords(next);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filledWordsCount = recoveryWords.filter(w => w.trim() !== '').length;

    if (filledWordsCount !== 24) {
      setErrorMessage(t('fill_all_words'));
      return;
    }

    setErrorMessage(null);
    setStatus('stretching');
    try {
      const { key, raw } = await RecoveryService.recoverVault(recoveryWords);
      await BruteForceService.recordSuccess();
      await setKey(key, raw);
      setStatus('success');
    } catch (err: any) {
      console.error("Recovery process failed:", err);
      let msg = t('recovery_failed');
      if (err.message === "NO_RECOVERY_BLOB") {
        msg = lang === 'tr' ? "Bu cihazda kurulmuş bir kurtarma kaydı bulunamadı." : "No recovery setup found on this device.";
      }
      setErrorMessage(msg);
      setStatus('recovery');
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempMasterKey || twoFactorCode.length < 6) return;

    setIsVerifyingTOTP(true);
    setErrorMessage(null);

    try {
      const configStr = localStorage.getItem('aegis_2fa_config');
      if (!configStr) throw new Error("2FA_CONFIG_MISSING");

      const configData = JSON.parse(configStr);
      const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(configData.iv));
      const ciphertext = new Uint8Array(CryptoService.base64ToArrayBuffer(configData.payload));
      const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(configData.tag || ""));

      const decryptedJson = await CryptoService.decrypt(ciphertext, tempMasterKey, iv, tag);
      const config = JSON.parse(decryptedJson);

      const isValid = await TwoFactorService.verifyToken(config.secret, twoFactorCode);

      if (isValid) {
        // SECURITY: Check for clock drift and warn user if detected
        // System clock sync is critical for TOTP to work reliably
        const clockWarning = TwoFactorService.getClockDriftWarning();
        if (clockWarning) {
          console.warn('TOTP Clock Drift Warning:', clockWarning);
          // Could show this as a toast/notification to user in production
          // For now, it's logged for developer inspection
        }

        await BruteForceService.recordSuccess();

        // Ensure 2FA config is synced to database for CLI access
        if ((window as any).electronAPI?.db) {
          try {
            const storagePayload = {
              payload: CryptoService.arrayBufferToBase64(ciphertext.buffer),
              iv: CryptoService.arrayBufferToBase64(iv.buffer),
              tag: CryptoService.arrayBufferToBase64(tag.buffer)
            };
            await (window as any).electronAPI.db.setConfig('aegis_2fa_config', JSON.stringify(storagePayload));
          } catch (e) {
            console.error("Failed to sync 2FA config to DB during login", e);
          }
        }

        await finalize2FA();
        setStatus('success');
      } else {
        setErrorMessage(t('invalid_code'));
        setTwoFactorCode('');
      }
    } catch (err: any) {
      console.error("2FA Verification Error:", err);
      setErrorMessage(t('verification_error'));
    } finally {
      setIsVerifyingTOTP(false);
    }
  };

  const cancel2FA = () => {
    setVerifying2FA(false);
    setTwoFactorCode('');
    setStatus('idle');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative bg-main overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-blue-600/10 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-emerald-600/10 blur-[160px] rounded-full pointer-events-none" />

      {/* Language Switcher */}
      <div className="absolute top-10 right-10 z-30 flex gap-1 p-1 glass backdrop-blur-xl rounded-xl border border-main">
        {(['en', 'tr'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${lang === l ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-dim hover:text-main'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <motion.div layout className="max-w-md w-full relative z-10">
        <AnimatePresence mode="wait">
          {status === 'recovery' ? (
            <motion.div key="recovery" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass p-12 rounded-[3.5rem] border border-main shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                  <RotateCcw size={32} />
                </div>
                <h2 className="text-2xl font-black text-main uppercase tracking-tighter">{t('recovery_mode')}</h2>
                <p className="text-[11px] text-dim font-bold uppercase mt-3 tracking-widest">{t('enter_recovery_words')}</p>
              </div>
              <form onSubmit={handleRecoverySubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar p-1">
                  {recoveryWords.map((w, i) => (
                    <div key={i} className="relative">
                      <input
                        value={w}
                        onPaste={(e) => handleRecoveryPaste(e, i)}
                        onChange={e => {
                          const next = [...recoveryWords];
                          next[i] = e.target.value.toLowerCase().trim();
                          setRecoveryWords(next);
                        }}
                        className="w-full bg-input-bg border border-main p-4 pl-10 rounded-xl text-xs text-main outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-800"
                        placeholder={t('field_value')}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-zinc-600 select-none">{i + 1}</span>
                    </div>
                  ))}
                </div>
                {errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 justify-center">
                    <AlertCircle size={14} />
                    <p className="text-[10px] font-black uppercase text-center tracking-widest">{errorMessage}</p>
                  </div>
                )}
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setStatus('idle')} className="flex-1 py-4 text-dim text-[10px] font-black uppercase tracking-widest hover:text-main transition-colors">{t('abort')}</button>
                  <button type="submit" className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">{t('verify')}</button>
                </div>
              </form>
            </motion.div>
          ) : status === '2fa' ? (
            <motion.div key="2fa" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass p-12 rounded-[3.5rem] border border-main shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                  <Shield size={32} />
                </div>
                <h2 className="text-2xl font-black text-main uppercase tracking-tighter">{t('verify_2fa')}</h2>
                <p className="text-[11px] text-dim font-bold uppercase mt-3 tracking-widest">{t('enter_code')}</p>
              </div>

              <form onSubmit={handle2FAVerify} className="space-y-6">
                <input
                  autoFocus
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-input-bg border border-main p-6 rounded-2xl text-center text-4xl font-mono tracking-[0.4em] text-main outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-900"
                  placeholder="000000"
                />

                {errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 justify-center">
                    <AlertCircle size={14} />
                    <p className="text-[10px] font-black uppercase text-center tracking-widest">{errorMessage}</p>
                  </div>
                )}

                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex gap-4">
                    <button type="button" onClick={cancel2FA} className="flex-1 py-4 text-dim text-[10px] font-black uppercase tracking-widest hover:text-main transition-colors">{t('abort')}</button>
                    <button
                      type="submit"
                      disabled={isVerifyingTOTP || twoFactorCode.length < 6}
                      className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
                    >
                      {isVerifyingTOTP ? <Loader2 className="animate-spin" size={18} /> : t('verify')}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setVerifying2FA(false);
                      setStatus('recovery');
                    }}
                    className="text-[9px] font-black text-dim hover:text-amber-500 uppercase tracking-[0.2em] transition-colors"
                  >
                    {lang === 'tr' ? '2FA Cihazımı Kaybettim / Kodum Çalışmıyor' : 'Lost my 2FA Device / Code Not Working'}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : status === 'stretching' ? (
            <div key="stretching" className="flex flex-col items-center py-24">
              <div className="relative mb-10">
                <Loader2 className="text-blue-500 animate-spin" size={64} />
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
              </div>
              <h2 className="text-xs font-black text-main uppercase tracking-[0.4em]">{t('decrypting')}</h2>
              <p className="text-[10px] text-dim font-bold uppercase mt-4 tracking-widest">AES-256 Engine v4.2</p>
            </div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass p-12 rounded-[3.5rem] border border-main shadow-2xl relative">
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                <ImageBrandIcon size={140} />
              </div>

              <div className="mt-16 text-center mb-10">
                <h1 className="text-3xl font-black text-main tracking-tighter mb-2 uppercase">{t('app_name')}</h1>
                <p className="text-[11px] text-dim font-bold uppercase tracking-[0.2em]">
                  {isInitialized ? t('enter_master_key') : t('vault_setup_title')}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-dim uppercase tracking-widest ml-2">
                      {t('master_password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        disabled={lockoutTimer > 0}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-6 py-5 pr-12 bg-input-bg border border-main rounded-2xl text-main outline-none focus:ring-2 focus:ring-blue-500/40 font-mono text-base transition-all placeholder:text-zinc-800 disabled:opacity-50"
                        placeholder="•••••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-main transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {!isInitialized && password.length > 0 && (
                      <>
                        {/* Password Strength Indicator */}
                        <div className="mt-2 px-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-dim">
                              {lang === 'tr' ? 'Şifre Gücü' : 'Password Strength'}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${passwordStrength >= 75 ? 'text-green-500' :
                              passwordStrength >= 50 ? 'text-yellow-500' :
                                'text-red-500'
                              }`}>
                              {passwordStrength}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${passwordStrength >= 75 ? 'bg-green-500' :
                                passwordStrength >= 50 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                              style={{ width: `${passwordStrength}%` }}
                            />
                          </div>
                        </div>

                        {/* Policy Errors */}
                        {passwordPolicyErrors.length > 0 && (
                          <div className="mt-2 px-2 space-y-1">
                            {passwordPolicyErrors.map((error, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-red-500">
                                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                <p className="text-[9px] font-bold leading-tight">{error}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Policy Warnings */}
                        {passwordPolicyWarnings.length > 0 && passwordPolicyErrors.length === 0 && (
                          <div className="mt-2 px-2 space-y-1">
                            {passwordPolicyWarnings.slice(0, 2).map((warning, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-yellow-500">
                                <Info size={12} className="mt-0.5 flex-shrink-0" />
                                <p className="text-[9px] font-bold leading-tight">{warning}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {!isInitialized && password.length === 0 && (
                      <p className="text-[10px] text-dim font-black uppercase tracking-widest pl-2 pt-1 opacity-70">
                        {lang === 'tr' ? 'Minimum 12 karakter, güçlü şifre' : 'Minimum 12 characters, strong password'}
                      </p>
                    )}
                  </div>

                  {!isInitialized && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-dim uppercase tracking-widest ml-2">
                        {t('confirm_password')}
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-6 py-5 pr-12 bg-input-bg border border-main rounded-2xl text-main outline-none focus:ring-2 focus:ring-blue-500/40 font-mono text-base transition-all placeholder:text-zinc-800"
                          placeholder="•••••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-main transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center px-1">
                  {isInitialized && (
                    <button
                      type="button"
                      onClick={() => setStatus('recovery')}
                      className="text-[10px] font-black text-dim uppercase hover:text-blue-500 transition-colors tracking-widest"
                    >
                      {t('recover_account')}?
                    </button>
                  )}

                  <div className="flex gap-4">
                    {isBiometricAvailable && (
                      <button
                        type="button"
                        disabled={lockoutTimer > 0}
                        onClick={handleBiometricUnlock}
                        className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase hover:text-blue-400 transition-colors tracking-widest disabled:opacity-50"
                      >
                        <Fingerprint size={14} /> {t('biometric_lock')}
                      </button>
                    )}

                    {isSKAvailable && (
                      <button
                        type="button"
                        disabled={lockoutTimer > 0}
                        onClick={handleSKUnlock}
                        className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase hover:text-blue-400 transition-colors tracking-widest disabled:opacity-50"
                      >
                        <Key size={14} /> {t('security_key_unlock')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Brute Force Alerts */}
                {lockoutTimer > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-3">
                    <Clock className="text-red-500 animate-pulse" size={16} />
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest text-center">
                      {t('brute_force_lockout').replace('{seconds}', lockoutTimer.toString())}
                    </p>
                  </motion.div>
                )}

                {failedAttempts >= 2 && lockoutTimer === 0 && (
                  <div className="flex items-center justify-center gap-2 text-amber-500">
                    <AlertCircle size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {t('attempts_remaining').replace('{count}', (10 - failedAttempts).toString())}
                    </span>
                  </div>
                )}

                {!isInitialized && (
                  <div className="flex items-start gap-4 p-5 bg-zinc-500/5 rounded-2xl border border-main mt-6 transition-all hover:bg-zinc-500/10">
                    <input
                      type="checkbox"
                      checked={eulaAccepted}
                      onChange={(e) => setEulaAccepted(e.target.checked)}
                      className="mt-1 cursor-pointer w-4 h-4 rounded accent-blue-600"
                      id="eula"
                    />
                    <label htmlFor="eula" className="text-[11px] text-dim font-bold uppercase leading-relaxed cursor-pointer select-none tracking-tight">
                      {lang === 'tr' ? (
                        <>
                          <button type="button" onClick={() => setShowEulaModal(true)} className="text-blue-500 hover:underline font-black">Kullanım Şartlarını</button> Okudum ve Kabul Ediyorum
                        </>
                      ) : (
                        <>
                          I have read and accept the <button type="button" onClick={() => setShowEulaModal(true)} className="text-blue-500 hover:underline font-black">Terms and Conditions</button>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                  >
                    <p className="text-[10px] font-black text-red-500 uppercase px-1 leading-relaxed text-center tracking-widest">
                      {errorMessage}
                    </p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={lockoutTimer > 0}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black rounded-2xl uppercase tracking-[0.3em] text-[11px] shadow-2xl transition-all active:scale-[0.98] mt-6 shadow-blue-600/30"
                >
                  {isInitialized ? t('authenticate') : t('create_vault')}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* EULA Modal */}
      <AnimatePresence>
        {showEulaModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl max-h-[85vh] bg-sidebar border border-main rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-10 border-b border-main flex justify-between items-center bg-zinc-500/5">
                <h3 className="text-2xl font-black text-main uppercase tracking-tighter">{t('eula_title')}</h3>
                <button onClick={() => setShowEulaModal(false)} className="p-3 text-dim hover:text-main transition-all bg-main/5 rounded-2xl">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-main">
                <EULAView />
              </div>
              <div className="p-8 border-t border-main text-center bg-zinc-500/5">
                <button
                  onClick={() => { setEulaAccepted(true); setShowEulaModal(false); }}
                  className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-blue-600/20"
                >
                  {lang === 'tr' ? 'OKUDUM VE ANLADIM' : 'I UNDERSTAND & AGREE'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthPage;