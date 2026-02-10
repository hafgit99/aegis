import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck, KeyRound, Eye, EyeOff, AlertCircle, ChevronRight, Usb } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import { LanguageSelector } from '../ui/LanguageSwitcher';
import Modal from '../ui/Modal';
import iconLarge from '../../assets/icon_large.png';

const LockScreen: React.FC = () => {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isFirstTime, setIsFirstTime] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [strengthLabel, setStrengthLabel] = useState('');
    const { unlock, completeLogin, isLoading, error } = useVaultStore();
    const inputRef = useRef<HTMLInputElement>(null);

    // Mnemonic State
    const [step, setStep] = useState<'auth' | 'mnemonic-display' | 'recovery-entry' | 'hardware-handshake' | '2fa-handshake'>('auth');
    const [mnemonic, setMnemonic] = useState('');
    const [mnemonicWords, setMnemonicWords] = useState<string[]>(Array(24).fill(''));
    const [hasSavedMnemonic, setHasSavedMnemonic] = useState(false);
    const [twofaInput, setTwofaInput] = useState('');
    const [twofaSecret, setTwofaSecret] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showDoc, setShowDoc] = useState<'policy' | 'terms' | null>(null);
    const [deviceId, setDeviceId] = useState<string>('');

    // Focus input on mount and when step changes to 'auth'
    useEffect(() => {
        if (step === 'auth' && !isFirstTime) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [step, isFirstTime]);

    // Clear password on mount
    useEffect(() => {
        setPassword('');
        useVaultStore.setState({ error: null, isLoading: false });
    }, []);

    useEffect(() => {
        const checkVault = async () => {
            try {
                const exists = await window.aegis.vault.exists();
                setIsFirstTime(!exists);
            } catch (err) {
                console.error('Error checking vault:', err);
                setIsFirstTime(false);
            }
        };
        checkVault();

        // Fetch Device ID
        const fetchDeviceId = async () => {
            try {
                const id = await window.aegis.system.getDeviceId();
                setDeviceId(id);
            } catch (err) {
                console.error('Error fetching device ID:', err);
            }
        };
        fetchDeviceId();
    }, []);

    useEffect(() => {
        if (isFirstTime && password) {
            calculatePasswordStrength(password);
        }
    }, [password, isFirstTime]);

    const calculatePasswordStrength = (pwd: string) => {
        let strength = 0;
        if (pwd.length >= 8) strength += 25;
        if (pwd.length >= 12) strength += 15;
        if (pwd.length >= 16) strength += 10;
        if (/[a-z]/.test(pwd)) strength += 10;
        if (/[A-Z]/.test(pwd)) strength += 10;
        if (/[0-9]/.test(pwd)) strength += 15;
        if (/[^a-zA-Z0-9]/.test(pwd)) strength += 15;

        setPasswordStrength(strength);

        if (strength < 40) setStrengthLabel(t('generator.strength.weak'));
        else if (strength < 70) setStrengthLabel(t('generator.strength.medium'));
        else setStrengthLabel(t('generator.strength.strong'));
    };

    const getStrengthColor = () => {
        if (passwordStrength < 40) return 'bg-rose-500';
        if (passwordStrength < 70) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isFirstTime) {
            if (password.length < 8) {
                useVaultStore.setState({ error: t('auth.weakPassword') });
                return;
            }
            if (password !== confirmPassword) {
                useVaultStore.setState({ error: t('auth.passwordMismatch') });
                return;
            }
            if (!acceptedTerms) {
                useVaultStore.setState({ error: t('auth.privacy.acceptTerms') });
                return;
            }

            // Generate mnemonic first
            const generated = await window.aegis.mnemonic.generate();
            setMnemonic(generated);
            setStep('mnemonic-display');
        } else if (step === 'auth') {
            if (password.length > 0) {
                const result = await unlock(password);
                if (result) {
                    try {
                        // 1. Check Hardware Key
                        const keyId = await window.aegis.database.getMetadata('fido2_key_id');
                        if (keyId) {
                            setStep('hardware-handshake');
                            const success = await window.aegis.fido2.authenticate(keyId);
                            if (!success) {
                                await window.aegis.vault.close();
                                useVaultStore.setState({ isLocked: true, error: t('errors.authFailed') });
                                setStep('auth');
                                return;
                            }
                        }

                        // 2. Check TOTP
                        const is2faEnabled = await window.aegis.database.getMetadata('2fa_enabled');
                        if (is2faEnabled === 'true') {
                            const secret = await window.aegis.database.getMetadata('2fa_secret');
                            setTwofaSecret(secret || '');
                            setStep('2fa-handshake');
                            // Sync time silently
                            try { window.aegis.totp.syncTime(); } catch (e) { }
                            return;
                        }

                        // If no multi-factor required, complete login
                        completeLogin();

                    } catch (err) {
                        console.error('Auth post-check failed:', err);
                        useVaultStore.setState({ error: 'Security check failed' });
                    }
                }
            }
        } else if (step === 'recovery-entry') {
            // Recovery Login
            if (password !== confirmPassword) {
                useVaultStore.setState({ error: t('auth.passwordMismatch') });
                return;
            }
            try {
                const phrase = mnemonicWords.join(' ').trim();
                const success = await window.aegis.vault.recover(phrase, password);
                if (success) {
                    await unlock(password);
                    completeLogin();
                }
            } catch (err: any) {
                useVaultStore.setState({ error: err.message });
            }
        }
    };

    const finalizeVaultCreation = async () => {
        try {
            const entropyHex = await window.aegis.mnemonic.getEntropy(mnemonic);
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(entropyHex));
            const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            const success = await window.aegis.vault.create(password, hashHex);
            if (success) {
                await window.aegis.database.setMetadata('recovery_mnemonic', mnemonic);
                // Vault is already opened by createVault, just fetch entries and unlock store
                await useVaultStore.getState().fetchEntries();
                useVaultStore.setState({ isLocked: false, isLoading: false });
            } else {
                throw new Error(t('errors.vaultCreateFailed') || 'Vault creation failed. Please try again.');
            }
        } catch (err: any) {
            useVaultStore.setState({ error: err.message });
        }
    };

    const handleTwoFAVerify = async () => {
        if (twofaInput.length === 6) {
            const isValid = await window.aegis.totp.verify(twofaInput, twofaSecret);
            if (isValid) {
                completeLogin();
                setTwofaInput('');
                setStep('auth');
            } else {
                useVaultStore.setState({ error: t('errors.verifyError') });
            }
        }
    };

    const cancelMfa = async () => {
        await window.aegis.vault.close();
        useVaultStore.setState({ isLocked: true, error: null });
        setStep('auth');
        setTwofaInput('');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070a] overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/20 blur-[120px] rounded-full animate-pulse capitalize" style={{ animationDelay: '2s' }} />
                <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-lg mx-4"
            >
                <div className="glass-panel p-10 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-[40px] relative overflow-hidden">
                    {/* Decorative Top Glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

                    <AnimatePresence mode="wait">
                        {step === 'auth' && (
                            <motion.div
                                key="entry"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            >
                                <div className="text-center mb-10">
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="mb-6 relative inline-block"
                                    >
                                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                                        <img src={iconLarge} alt="Aegis" className="w-24 h-24 mx-auto relative drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                                        <div className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 rounded-xl border-2 border-navy-950 shadow-lg">
                                            <Lock className="w-4 h-4 text-white" />
                                        </div>
                                    </motion.div>
                                    <h1 className="text-4xl font-black text-white tracking-tight mb-2 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                                        {isFirstTime ? t('auth.welcome') : t('auth.welcomeBack')}
                                    </h1>
                                    <p className="text-white/40 text-sm font-medium">
                                        {isFirstTime ? t('auth.createVaultDesc') : t('auth.unlockVaultDesc')}
                                    </p>
                                    {isFirstTime && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-6 inline-block"
                                        >
                                            <LanguageSelector />
                                        </motion.div>
                                    )}
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[11px] text-white/40 font-bold uppercase tracking-[0.2em]">
                                                {isFirstTime ? t('auth.createMasterPassword') : t('auth.masterPassword')}
                                            </label>
                                        </div>
                                        <div className="relative group">
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 transition-colors group-focus-within:text-indigo-400" />
                                            <input
                                                ref={inputRef}
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={t('auth.enterMasterPassword')}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/10"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors p-1"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {isFirstTime && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="space-y-2"
                                        >
                                            <label className="text-[11px] text-white/40 font-bold uppercase tracking-[0.2em] px-1">{t('auth.confirmPassword')}</label>
                                            <div className="relative group">
                                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-indigo-400" />
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder={t('auth.confirmPasswordPlaceholder')}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors p-1"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {isFirstTime && password && (
                                        <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                                                <span className="text-white/40">{t('auth.passwordStrength')}</span>
                                                <span className={passwordStrength < 40 ? 'text-rose-400' : passwordStrength < 70 ? 'text-amber-400' : 'text-emerald-400'}>
                                                    {strengthLabel}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${passwordStrength}%` }}
                                                    className={`h-full transition-colors duration-500 ${getStrengthColor()}`}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-medium"
                                        >
                                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                            <span>{error}</span>
                                        </motion.div>
                                    )}

                                    {isFirstTime && (
                                        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 group cursor-pointer transition-colors hover:bg-white/[0.08]" onClick={() => setAcceptedTerms(!acceptedTerms)}>
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={acceptedTerms}
                                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                                    className="w-5 h-5 rounded-lg bg-white/10 accent-indigo-500 cursor-pointer"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="text-sm text-white/60 leading-relaxed select-none">
                                                <span className="cursor-pointer">{t('auth.privacy.acceptTerms').split(',')[0]}</span>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setShowDoc('terms'); }} className="text-indigo-400 hover:text-indigo-300 font-bold mx-1 underline decoration-indigo-500/30 underline-offset-4">
                                                    {t('auth.privacy.termsTitle')}
                                                </button>
                                                <span> {t('common.and') || '&'} </span>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setShowDoc('policy'); }} className="text-indigo-400 hover:text-indigo-300 font-bold mx-1 underline decoration-indigo-500/30 underline-offset-4">
                                                    {t('auth.privacy.policyTitle')}
                                                </button>
                                                <span>{t('auth.privacy.acceptTerms').split('Policy')[1] || t('auth.privacy.acceptTerms').split('Politikasını')[1] || ''}</span>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                                    >
                                        {isLoading ? (
                                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                                <Lock className="w-5 h-5" />
                                            </motion.div>
                                        ) : (
                                            <ShieldCheck className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                        )}
                                        <span className="text-lg">{isFirstTime ? t('auth.createVault') : t('auth.unlockVault')}</span>
                                    </button>

                                    {!isFirstTime && (
                                        <button
                                            type="button"
                                            onClick={() => setStep('recovery-entry')}
                                            className="w-full text-center text-xs text-white/30 hover:text-white transition-colors py-2 font-medium"
                                        >
                                            {t('auth.recovery.forgotPassword')}
                                        </button>
                                    )}
                                </form>
                            </motion.div>
                        )}

                        {step === 'mnemonic-display' && (
                            <motion.div
                                key="mnemonic"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
                                        <ShieldCheck className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <h2 className="text-3xl font-black text-white">{t('auth.recovery.title')}</h2>
                                    <p className="text-white/40 text-sm mt-3 leading-relaxed">{t('auth.recovery.mnemonicDesc')}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-2.5 p-6 bg-black/40 rounded-[2rem] border border-white/5 relative group">
                                    {mnemonic.split(' ').map((word, i) => (
                                        <div key={i} className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.05] flex items-center gap-3">
                                            <span className="text-[9px] text-white/20 font-black w-4">{String(i + 1).padStart(2, '0')}</span>
                                            <span className="text-xs text-indigo-300 font-bold">{word}</span>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(mnemonic);
                                        }}
                                        className="absolute inset-2 bg-indigo-600/90 rounded-[1.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm transform translate-y-2 group-hover:translate-y-0"
                                    >
                                        <span className="font-bold flex items-center gap-3 text-white text-lg">
                                            <KeyRound className="w-6 h-6" />
                                            {t('auth.recovery.copyMnemonic')}
                                        </span>
                                    </button>
                                </div>

                                <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex gap-4 text-rose-400">
                                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                                    <span className="text-xs font-medium leading-relaxed uppercase tracking-wider">{t('auth.recovery.saveWarning')}</span>
                                </div>

                                <label className="flex items-center gap-4 cursor-pointer group p-4 hover:bg-white/5 rounded-2xl transition-colors">
                                    <div className="relative w-6 h-6 flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={hasSavedMnemonic}
                                            onChange={(e) => setHasSavedMnemonic(e.target.checked)}
                                            className="w-6 h-6 rounded-lg bg-white/10 accent-indigo-500 cursor-pointer"
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-white/60 group-hover:text-white transition-colors leading-snug">
                                        {t('auth.recovery.confirmSaved')}
                                    </span>
                                </label>

                                <button
                                    onClick={finalizeVaultCreation}
                                    disabled={!hasSavedMnemonic}
                                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-20 text-lg"
                                >
                                    {t('common.finish')}
                                </button>
                                <button onClick={() => setStep('auth')} className="w-full text-white/20 hover:text-white/40 text-xs font-bold uppercase tracking-widest">{t('common.cancel')}</button>
                            </motion.div>
                        )}

                        {step === 'recovery-entry' && (
                            <motion.div
                                key="recovery"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center gap-4 mb-2">
                                    <button
                                        onClick={() => setStep('auth')}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all hover:scale-110"
                                    >
                                        <ChevronRight className="w-6 h-6 rotate-180 text-white/60" />
                                    </button>
                                    <div>
                                        <h2 className="text-2xl font-black text-white">{t('auth.recovery.title')}</h2>
                                        <p className="text-white/40 text-xs font-bold uppercase tracking-wider mt-1">Kasa Erişimini Kurtar</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[11px] text-white/40 uppercase font-black tracking-widest px-1">{t('auth.recovery.enterMnemonic')}</label>
                                        <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-2 scrollbar-none">
                                            {mnemonicWords.map((word, i) => (
                                                <div key={i} className="relative group">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-white/20 font-black pointer-events-none">
                                                        {(i + 1).toString().padStart(2, '0')}
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={word}
                                                        onChange={(e) => {
                                                            const newWords = [...mnemonicWords];
                                                            newWords[i] = e.target.value.toLowerCase().trim();
                                                            setMnemonicWords(newWords);
                                                        }}
                                                        onPaste={(e) => {
                                                            if (i === 0) {
                                                                e.preventDefault();
                                                                const pasteData = e.clipboardData.getData('text');
                                                                const words = pasteData.trim().split(/\s+/).slice(0, 24);
                                                                if (words.length > 1) {
                                                                    const newWords = [...mnemonicWords];
                                                                    words.forEach((w, idx) => {
                                                                        if (idx < 24) newWords[idx] = w.toLowerCase().trim();
                                                                    });
                                                                    setMnemonicWords(newWords);
                                                                }
                                                            }
                                                        }}
                                                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-8 pr-2 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-medium"
                                                        placeholder="word..."
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4 p-5 bg-indigo-500/5 rounded-[2rem] border border-white/5">
                                        <div className="space-y-2">
                                            <label className="text-[11px] text-white/40 uppercase font-black tracking-widest px-1">{t('auth.createMasterPassword')}</label>
                                            <div className="relative group">
                                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-400" />
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] text-white/40 uppercase font-black tracking-widest px-1">{t('auth.confirmPassword')}</label>
                                            <div className="relative group">
                                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-400" />
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                                />
                                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSubmit}
                                        disabled={isLoading || mnemonicWords.some(w => !w) || !password}
                                        className="w-full py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-20 text-lg"
                                    >
                                        {isLoading ? (
                                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                                <Lock className="w-5 h-5" />
                                            </motion.div>
                                        ) : (
                                            <ShieldCheck className="w-6 h-6" />
                                        )}
                                        {t('auth.recovery.recoverAction')}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 'hardware-handshake' && (
                            <motion.div
                                key="hardware-handshake"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                className="space-y-8 py-10 text-center"
                            >
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-white tracking-tight">{t('settings.hardwareKey')}</h2>
                                    <p className="text-white/40 text-sm font-medium">{t('settings.hardwareKeyInstructions')}</p>
                                </div>

                                <div className="flex justify-center py-6">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.15, 1],
                                            rotate: [0, 5, -5, 0]
                                        }}
                                        transition={{
                                            repeat: Infinity,
                                            duration: 3,
                                            ease: "easeInOut"
                                        }}
                                        className="relative"
                                    >
                                        <div className="absolute inset-0 bg-indigo-500/30 blur-3xl rounded-full" />
                                        <div className="relative w-28 h-28 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                                            <Usb className="w-14 h-14 text-white" />
                                        </div>
                                    </motion.div>
                                </div>

                                <motion.div
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="text-xs text-indigo-400 font-bold uppercase tracking-[0.3em]"
                                >
                                    Authenticating...
                                </motion.div>
                            </motion.div>
                        )}

                        {step === '2fa-handshake' && (
                            <motion.div
                                key="2fa-handshake"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="text-center space-y-2">
                                    <h2 className="text-2xl font-black text-white">{t('settings.twoFactor')}</h2>
                                    <p className="text-white/40 text-sm">{t('settings.twoFAInstructions')}</p>
                                </div>

                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={twofaInput}
                                        onChange={(e) => setTwofaInput(e.target.value.replace(/[^0-9]/g, ''))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleTwoFAVerify()}
                                        placeholder="000000"
                                        className="w-full bg-navy-900 border-2 border-white/5 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[0.5em] text-indigo-400 focus:outline-none focus:border-indigo-500/50 transition-all"
                                        autoFocus
                                    />

                                    {error && (
                                        <p className="text-rose-400 text-xs font-bold text-center">{error}</p>
                                    )}

                                    <button
                                        onClick={handleTwoFAVerify}
                                        className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        {t('common.confirm')}
                                    </button>

                                    <button
                                        onClick={cancelMfa}
                                        className="w-full py-2 text-white/20 hover:text-white/40 text-xs font-bold underline transition-colors"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Device ID Display at Bottom */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 text-center"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{t('common.deviceId')}</span>
                        <span className="text-[10px] font-mono text-white/40 font-bold tracking-widest leading-none select-all cursor-help" title="Donanıma özel cihaz kimliği">
                            {deviceId}
                        </span>
                    </div>
                </motion.div>
            </motion.div>

            {/* Privacy & Terms Modal */}
            <Modal
                isOpen={showDoc !== null}
                onClose={() => setShowDoc(null)}
                title={showDoc === 'policy' ? t('auth.privacy.policyTitle') : t('auth.privacy.termsTitle')}
            >
                <div className="p-6">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-white/70 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {showDoc === 'policy' ? t('auth.privacy.policyContent') : t('auth.privacy.termsContent')}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default LockScreen;
