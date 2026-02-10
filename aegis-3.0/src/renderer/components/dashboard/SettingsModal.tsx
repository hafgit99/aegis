import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { LanguageSelector } from '../ui/LanguageSwitcher';
import {
    Shield,
    Smartphone,
    Globe,
    Lock,
    ShieldCheck,
    Info,
    ChevronRight,
    Clock,
    Key,
    LogOut,
    Trash2,
    LockKeyhole,
    CheckCircle2,
    Sparkles,
    Copy,
    KeyRound,
    Usb,
    AlertTriangle,
    ShieldAlert,
    Laptop,
    Cloud,
    Server,
    RefreshCw,
    Database,
    Coins,
    Timer,
    Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import { QRCodeSVG } from 'qrcode.react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: TabType;
}

type TabType = 'general' | 'security' | 'emergency' | 'sync' | 'about' | 'premium';

const BiometricSection: React.FC = () => {
    const { t } = useTranslation();
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isSettingUp, setIsSettingUp] = useState(false);

    useEffect(() => {
        const checkAvailability = async () => {
            const available = await window.aegis.biometrics.isAvailable();
            setIsAvailable(available);
            const saved = localStorage.getItem('biometricEnabled');
            setIsEnabled(saved === 'true');
        };
        checkAvailability();
    }, []);

    const handleToggle = async () => {
        if (!isEnabled) {
            setIsSettingUp(true);
            // MOCK Setup Flow (Biyometrik Mock Uygulama)
            try {
                // Simulating a native prompt delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                localStorage.setItem('biometricEnabled', 'true');
                setIsEnabled(true);
                alert(t('common.success'));
            } catch (err) {
                console.error('Biometric setup failed:', err);
            } finally {
                setIsSettingUp(false);
            }
        } else {
            localStorage.setItem('biometricEnabled', 'false');
            setIsEnabled(false);
        }
    };

    if (isAvailable === false) return null;

    return (
        <div className={`p-6 rounded-3xl border transition-all ${isEnabled ? 'bg-teal-500/10 border-teal-500/20' : 'bg-navy-800/50 border-white/5'}`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isEnabled ? 'bg-teal-500/20 shadow-lg shadow-teal-500/20' : 'bg-navy-900 border border-white/5'}`}>
                        <Smartphone className={`w-6 h-6 ${isEnabled ? 'text-teal-400' : 'text-white/20'}`} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white/90">{t('settings.biometric')}</h3>
                        <p className="text-xs text-white/30">{t('settings.biometricDesc')}</p>
                    </div>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={isSettingUp}
                    className={`relative w-12 h-6 rounded-full transition-all ${isEnabled ? 'bg-teal-500' : 'bg-white/10'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isEnabled ? 'left-7' : 'left-1'}`} />
                </button>
            </div>

            {isSettingUp ? (
                <div className="text-center py-4 space-y-3">
                    <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-xs text-teal-400 font-bold uppercase tracking-widest"
                    >
                        {t('auth.biometricAuth')}...
                    </motion.div>
                </div>
            ) : isEnabled ? (
                <div className="p-3 bg-teal-500/5 rounded-xl border border-teal-500/10 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">{t('settings.biometricEnabled')}</span>
                </div>
            ) : (
                <div className="text-[10px] text-white/20 italic">
                    {t('settings.biometricAvailable')}
                </div>
            )}
        </div>
    );
};

const RecoveryPhraseSection: React.FC = () => {
    const { t } = useTranslation();
    const [isVerifying, setIsVerifying] = useState(false);
    const [password, setPassword] = useState('');
    const [showPhrase, setShowPhrase] = useState(false);
    const [mnemonic, setMnemonic] = useState('');
    const [error, setError] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    const handleVerify = async () => {
        try {
            const isValid = await window.aegis.vault.open(password);
            if (isValid) {
                let savedMnemonic = await window.aegis.database.getMetadata('recovery_mnemonic');

                if (!savedMnemonic) {
                    savedMnemonic = await window.aegis.mnemonic.generate();
                    await window.aegis.database.setMetadata('recovery_mnemonic', savedMnemonic);
                }

                setMnemonic(savedMnemonic);
                setShowPhrase(true);
                setIsVerifying(false);
                setError('');
            } else {
                setError(t('errors.invalidPassword'));
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(mnemonic);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (showPhrase) {
        return (
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-sm font-bold">{t('settings.recoveryPhrase')} (24 Word)</span>
                    </div>
                    <button
                        onClick={() => setShowPhrase(false)}
                        className="text-xs text-white/40 hover:text-white/60 underline"
                    >
                        {t('settings.hideRecoveryPhrase')}
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {mnemonic.split(' ').map((word, i) => (
                        <div key={i} className="bg-navy-900/80 p-2 rounded-lg border border-white/5 flex gap-2 items-center">
                            <span className="text-[10px] text-white/20 w-4 font-mono">{(i + 1).toString().padStart(2, '0')}</span>
                            <span className="text-xs text-white/80 font-medium selection:bg-indigo-500/30">{word}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex-1 flex items-center justify-center gap-2 p-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-bold transition-all"
                    >
                        {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {isCopied ? t('settings.copiedRecoveryPhrase') : t('settings.copyRecoveryPhrase')}
                    </button>
                </div>

                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-400 leading-tight">
                        {t('settings.recoveryPhraseWarning')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 rounded-xl bg-navy-800/50 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-navy-900 rounded-lg">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-white/90">{t('settings.recoveryPhrase')}</div>
                        <div className="text-xs text-white/30">{t('settings.recoveryPhraseDesc')}</div>
                    </div>
                </div>

                {!isVerifying ? (
                    <button
                        onClick={() => setIsVerifying(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-lg text-xs font-bold transition-all"
                    >
                        {t('settings.viewRecoveryPhrase')}
                    </button>
                ) : (
                    <button
                        onClick={() => setIsVerifying(false)}
                        className="text-xs text-white/40 hover:text-white/60 underline"
                    >
                        {t('common.cancel')}
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isVerifying && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-3 border-t border-white/5 space-y-3"
                    >
                        <p className="text-[10px] text-white/40 italic">
                            {t('settings.verifyPasswordRequest')}
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                placeholder={t('auth.masterPassword')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="flex-1 bg-navy-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                            />
                            <button
                                onClick={handleVerify}
                                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                            >
                                {t('common.confirm')}
                            </button>
                        </div>
                        {error && <p className="text-[10px] text-red-500">{error}</p>}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const EmergencyAccessSection: React.FC = () => {
    const { t } = useTranslation();
    const [contacts, setContacts] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', email: '', waitingPeriod: 604800 }); // Default 7 days

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            const list = await window.aegis.emergency.list();
            setContacts(list || []);
        } catch (err) {
            console.error('Failed to fetch emergency contacts:', err);
        }
    };

    const handleAdd = async () => {
        if (!newContact.name || !newContact.email) return;
        try {
            await window.aegis.emergency.save(newContact);
            setNewContact({ name: '', email: '', waitingPeriod: 604800 });
            setIsAdding(false);
            fetchContacts();
        } catch (err) {
            console.error('Failed to add contact:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirm'))) return;
        try {
            await window.aegis.emergency.delete(id);
            fetchContacts();
        } catch (err) {
            console.error('Failed to delete contact:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white/90">{t('settings.emergencyAccess')}</h3>
                    <p className="text-sm text-white/40">{t('settings.emergencyAccessDesc')}</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                    <ShieldCheck className="w-4 h-4" />
                    {t('settings.addContact')}
                </button>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-300/60 leading-relaxed">
                    {t('settings.emergencyAccessInfo')}
                </p>
            </div>

            {isAdding && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-navy-800/80 border border-indigo-500/30 space-y-4"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-white/40 uppercase font-black px-1">{t('settings.contactName')}</label>
                            <input
                                type="text"
                                value={newContact.name}
                                onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-white/40 uppercase font-black px-1">{t('settings.contactEmail')}</label>
                            <input
                                type="email"
                                value={newContact.email}
                                onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="name@email.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] text-white/40 uppercase font-black px-1">{t('settings.waitingPeriod')}</label>
                        <select
                            value={newContact.waitingPeriod}
                            onChange={e => setNewContact({ ...newContact, waitingPeriod: parseInt(e.target.value) })}
                            className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        >
                            <option value={7200}>{t('settings.periods.2h')}</option>
                            <option value={43200}>{t('settings.periods.12h')}</option>
                            <option value={86400}>{t('settings.periods.24h')}</option>
                            <option value={172800}>{t('settings.periods.2d')}</option>
                            <option value={604800}>{t('settings.periods.7d')}</option>
                        </select>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-white/40 hover:text-white/60 text-xs font-bold"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleAdd}
                            className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="space-y-2">
                {contacts.length === 0 ? (
                    <div className="p-8 text-center bg-navy-800/20 rounded-2xl border border-white/5 border-dashed">
                        <p className="text-xs text-white/20 italic">{t('settings.noEmergencyContacts')}</p>
                    </div>
                ) : (
                    contacts.map(contact => (
                        <div key={contact.id} className="p-4 rounded-2xl bg-navy-800/50 border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                    <Key className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white/90">{contact.name}</div>
                                    <div className="text-xs text-white/30">{contact.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <div className="text-[10px] text-white/20 uppercase font-black">{t('settings.waitingPeriod')}</div>
                                    <div className="text-xs text-white/60 font-medium">
                                        {contact.waitingPeriod === 7200 && t('settings.periods.2h')}
                                        {contact.waitingPeriod === 43200 && t('settings.periods.12h')}
                                        {contact.waitingPeriod === 86400 && t('settings.periods.24h')}
                                        {contact.waitingPeriod === 172800 && t('settings.periods.2d')}
                                        {contact.waitingPeriod === 604800 && t('settings.periods.7d')}
                                    </div>
                                </div>
                                <div className="text-right min-w-[80px]">
                                    <div className="text-[10px] text-white/20 uppercase font-black">{t('settings.status')}</div>
                                    <div className={`text-xs font-bold ${contact.status === 'active' ? 'text-teal-400' : 'text-orange-400'}`}>
                                        {(contact.status || '').toUpperCase()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(contact.id)}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-white/10 hover:text-red-400 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const HardwareKeySection: React.FC = () => {
    const { t } = useTranslation();
    const [isRegistered, setIsRegistered] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const keyId = await window.aegis.database.getMetadata('fido2_key_id');
            setIsRegistered(!!keyId);
        } catch (err) {
            console.error('Failed to check hardware key status:', err);
        }
    };

    const handleRegister = async () => {
        setIsRegistering(true);
        try {
            // Give user time to see the instruction
            await new Promise(resolve => setTimeout(resolve, 1500));
            const result = await window.aegis.fido2.register();
            if (result.success) {
                await window.aegis.database.setMetadata('fido2_key_id', result.credentialId);
                setIsRegistered(true);
                alert(t('settings.hardwareKeySuccess'));
            }
        } catch (err) {
            console.error('FIDO2 Registration failed:', err);
            alert('Hardware Key registration failed. Please ensure your device is connected.');
        } finally {
            setIsRegistering(false);
        }
    };

    const handleRevoke = async () => {
        if (!confirm(t('common.confirm'))) return;
        try {
            await window.aegis.database.setMetadata('fido2_key_id', '');
            setIsRegistered(false);
        } catch (err) {
            console.error('Failed to revoke hardware key:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className={`p-6 rounded-3xl border transition-all ${isRegistered ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-navy-800/50 border-white/5'}`}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isRegistered ? 'bg-indigo-500/20 shadow-lg shadow-indigo-500/20' : 'bg-navy-900 border border-white/5'}`}>
                            <KeyRound className={`w-6 h-6 ${isRegistered ? 'text-indigo-400' : 'text-white/20'}`} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white/90">{t('settings.hardwareKey')}</h3>
                            <p className="text-xs text-white/30">{isRegistered ? t('settings.hardwareKeyStatusActive') : t('settings.hardwareKeyStatusInactive')}</p>
                        </div>
                    </div>
                </div>

                {!isRegistered && !isRegistering && (
                    <button
                        onClick={handleRegister}
                        className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-sm font-bold transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                        <ShieldCheck className="w-5 h-5" />
                        {t('settings.setupHardwareKey')}
                    </button>
                )}

                {isRegistering && (
                    <div className="text-center py-8 space-y-4">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="w-16 h-16 bg-indigo-500/20 rounded-full mx-auto flex items-center justify-center"
                        >
                            <Usb className="w-8 h-8 text-indigo-400" />
                        </motion.div>
                        <p className="text-sm text-indigo-300 font-medium animate-pulse">
                            {t('settings.hardwareKeyInstructions')}
                        </p>
                    </div>
                )}

                {isRegistered && (
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                <span className="text-xs text-white/60 font-medium">Security Key Linked</span>
                            </div>
                            <button
                                onClick={handleRevoke}
                                className="text-xs text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider"
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-indigo-300/40 leading-relaxed uppercase font-bold tracking-wider">
                    Fiziksel güvenlik anahtarı (YubiKey vb.), dijital kasanız için en yüksek güvenlik katmanını sağlar. Anahtarınız takılı olmadan kasanız açılamaz.
                </p>
            </div>
        </div>
    );
};

const DuressPasswordSection: React.FC = () => {
    const { t } = useTranslation();
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [isSet, setIsSet] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const status = await window.aegis.database.getMetadata('duress_enabled');
                setIsSet(status === 'true');
            } catch (err) {
                console.error('Failed to check duress status:', err);
            }
        };
        checkStatus();
    }, []);

    const handleSave = async () => {
        if (!password || password !== confirm) {
            alert(t('auth.passwordMismatch'));
            return;
        }

        try {
            await window.aegis.vault.setDuressPassword(password);
            await window.aegis.database.setMetadata('duress_enabled', 'true');
            setIsSet(true);
            setIsConfiguring(false);
            setPassword('');
            setConfirm('');
            alert(t('common.success'));
        } catch (err) {
            console.error('Failed to set duress password:', err);
            alert(t('common.error'));
        }
    };

    return (
        <div className={`p-6 rounded-3xl border transition-all ${isSet ? 'bg-amber-500/10 border-amber-500/20' : 'bg-navy-800/50 border-white/5'}`}>
            <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${isSet ? 'bg-amber-500/20 shadow-lg shadow-amber-500/20' : 'bg-navy-900 border border-white/5'}`}>
                    <ShieldAlert className={`w-6 h-6 ${isSet ? 'text-amber-400' : 'text-white/20'}`} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white/90">{t('settings.duressPassword')}</h3>
                    <p className="text-xs text-white/30">{t('settings.duressPasswordDesc')}</p>
                </div>
            </div>

            {!isConfiguring ? (
                <button
                    onClick={() => setIsConfiguring(true)}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                    {isSet ? t('settings.changeDuressPassword') : t('settings.setupDuressPassword')}
                </button>
            ) : (
                <div className="space-y-4">
                    <p className="text-xs text-amber-400/80 bg-amber-400/5 p-4 rounded-xl border border-amber-400/10">
                        {t('settings.duressPasswordInstructions')}
                    </p>
                    <input
                        type="password"
                        placeholder={t('auth.newPassword')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-navy-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50"
                    />
                    <input
                        type="password"
                        placeholder={t('auth.confirmNewPassword')}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="w-full bg-navy-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/20"
                        >
                            {t('common.save')}
                        </button>
                        <button
                            onClick={() => setIsConfiguring(false)}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all border border-white/5"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab }) => {
    const { t } = useTranslation();
    const { lock, isLocked, licenseStatus, checkLicense, activateLicense } = useVaultStore();
    const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'general');
    const [showDoc, setShowDoc] = useState<'policy' | 'terms' | null>(null);
    const [deviceId, setDeviceId] = useState<string>('');
    const [licenseKey, setLicenseKey] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [activationMessage, setActivationMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }

        // Fetch Device ID
        const fetchDeviceId = async () => {
            const id = await window.aegis.system.getDeviceId();
            setDeviceId(id);
        };
        fetchDeviceId();
        checkLicense();
    }, [isOpen, initialTab, checkLicense]);

    // Settings state
    const [autoLockTime, setAutoLockTime] = useState<number>(5);
    const [deviceName, setDeviceName] = useState<string>('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [isConfiguring2FA, setIsConfiguring2FA] = useState(false);
    const [twoFASecret, setTwoFASecret] = useState('');
    const [twoFACode, setTwoFACode] = useState('');
    const [passwordForm, setPasswordForm] = useState({
        current: '',
        new: '',
        confirm: ''
    });
    const [backupCodes, setBackupCodes] = useState<string[]>([]);


    const [syncConfig, setSyncConfig] = useState({
        provider: 'nextcloud',
        endpoint: '',
        username: '',
        password: '',
        remotePath: '',
        enabled: false,
        autoSync: true,
        e2ee: true
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            const savedAutoLock = localStorage.getItem('autoLockTime');
            const savedDeviceName = localStorage.getItem('deviceName');

            if (savedAutoLock) setAutoLockTime(parseInt(savedAutoLock));
            if (savedDeviceName) setDeviceName(savedDeviceName);

            // Don't try to load from DB if locked
            if (isLocked) {
                // Return to default state when locked to prevent stale info
                setIs2FAEnabled(false);
                setTwoFASecret('');
                setBackupCodes([]);
                return;
            }

            try {
                const isEnabled = await window.aegis.database.getMetadata('2fa_enabled');
                const secret = await window.aegis.database.getMetadata('2fa_secret');
                const codes = await window.aegis.database.getMetadata('2fa_backup_codes');

                setIs2FAEnabled(isEnabled === 'true');
                if (secret) setTwoFASecret(secret);
                if (codes) setBackupCodes(JSON.parse(codes));

                const config = await window.aegis.cloudSync.getConfig();
                if (config) setSyncConfig(config);
            } catch (err: any) {
                if (!err.message?.includes('Database not open')) {
                    console.error('Failed to load settings from DB:', err);
                }
            }
        };
        loadSettings();
    }, [isLocked]);

    const handleLockVault = () => {
        lock();
        onClose();
    };

    const handleResetVault = async () => {
        if (!confirm(t('settings.resetConfirm'))) return;
        if (!confirm(t('settings.resetFinalConfirm'))) return;

        try {
            await window.aegis.vault.reset();
            alert(t('settings.resetSuccess'));
            window.location.reload();
        } catch (err: any) {
            alert(`${t('common.error')}: ${err.message}`);
        }
    };

    const handleExit = () => {
        if (confirm(t('settings.exitConfirm'))) {
            window.close();
        }
    };

    const handleAutoLockChange = async (minutes: number) => {
        setAutoLockTime(minutes);
        localStorage.setItem('autoLockTime', minutes.toString());

        // Persist to disk for Main process background monitor
        await window.aegis.system.saveSettings({ autoLockTime: minutes });
    };

    const handleSaveDeviceName = () => {
        localStorage.setItem('deviceName', deviceName);
        alert(t('settings.deviceNameSaved'));
    };

    const handleCopyDeviceId = async () => {
        if (!deviceId) return;
        try {
            await window.aegis.clipboard.setSecure(deviceId);
            alert(t('common.copySuccess'));
        } catch (err) {
            console.error('Copy failed:', err);
            alert(t('common.copyFailed'));
        }
    };

    const handle2FASetup = async () => {
        const secret = await window.aegis.totp.generateSecret();
        setTwoFASecret(secret);
        setIsConfiguring2FA(true);
        // Sync time for better success rate
        window.aegis.totp.syncTime();
    };

    const handle2FAVerify = async () => {
        if (twoFACode.length === 6) {
            const isValid = await window.aegis.totp.verify(twoFACode, twoFASecret);
            if (isValid) {
                setIs2FAEnabled(true);
                setIsConfiguring2FA(false);
                await window.aegis.database.setMetadata('2fa_enabled', 'true');
                await window.aegis.database.setMetadata('2fa_secret', twoFASecret);
                alert(t('common.success'));
                setTwoFACode('');

                // Generate initial backup codes
                const codes = await window.aegis.totp.generateBackupCodes();
                setBackupCodes(codes);
                await window.aegis.database.setMetadata('2fa_backup_codes', JSON.stringify(codes));
            } else {

                alert(t('errors.verifyError'));
            }
        } else {
            alert(t('common.error'));
        }
    };

    const handle2FADisable = async () => {
        if (confirm(t('settings.disable2FA') + '?')) {
            setIs2FAEnabled(false);
            setTwoFASecret('');
            await window.aegis.database.setMetadata('2fa_enabled', 'false');
            await window.aegis.database.setMetadata('2fa_secret', '');
            await window.aegis.database.setMetadata('2fa_backup_codes', '');
            setBackupCodes([]);
            alert(t('common.success'));
        }
    };

    const handleGenerateBackupCodes = async () => {
        if (!confirm(t('settings.generateBackupCodesConfirm') || 'Are you sure you want to generate new backup codes? Old ones will be invalidated.')) return;
        const codes = await window.aegis.totp.generateBackupCodes();
        setBackupCodes(codes);
        await window.aegis.database.setMetadata('2fa_backup_codes', JSON.stringify(codes));
    };

    const handleExportTOTP = async () => {
        try {
            const data = {
                secret: twoFASecret,
                backupCodes: backupCodes,
                issuer: 'AegisVault',
                account: deviceName || 'User',
                timestamp: Date.now()
            };
            const json = JSON.stringify(data, null, 2);
            await window.aegis.clipboard.setSecure(json);
            alert('TOTP configuration copied to clipboard (encrypted payload).');
        } catch (err) {
            alert('Export failed');
        }
    };

    const handleImportTOTP = async () => {
        const payload = prompt('TOTP Konfigürasyonunu (JSON) buraya yapıştırın:');
        if (!payload) return;
        try {
            const data = JSON.parse(payload);
            if (data.secret) {
                setTwoFASecret(data.secret);
                if (data.backupCodes) setBackupCodes(data.backupCodes);
                await window.aegis.database.setMetadata('2fa_secret', data.secret);
                if (data.backupCodes) await window.aegis.database.setMetadata('2fa_backup_codes', JSON.stringify(data.backupCodes));
                setIs2FAEnabled(true);
                alert('TOTP yapılandırması başarıyla içe aktarıldı.');
            }
        } catch (err) {
            alert('Geçersiz yapılandırma formatı.');
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.new !== passwordForm.confirm) {
            alert(t('auth.passwordMismatch'));
            return;
        }

        if (passwordForm.new.length < 8) {
            alert(t('auth.weakPassword'));
            return;
        }

        try {
            // Önce mevcut şifreyi doğrula
            const isValid = await window.aegis.vault.open(passwordForm.current);
            if (!isValid || !isValid.success) {
                alert(t('errors.invalidPassword'));
                return;
            }

            // Yeni vault oluştur (eski verileri koru)
            await window.aegis.vault.reset();
            await window.aegis.vault.create(passwordForm.new);

            alert(t('common.success'));
            window.location.reload();
        } catch (err: any) {
            alert(`${t('common.error')}: ${err.message}`);
        }
    };

    const handleSaveSyncConfig = async () => {
        try {
            await window.aegis.cloudSync.saveConfig(syncConfig);
            alert(t('common.success'));
        } catch (err: any) {
            alert(`${t('common.error')}: ${err.message}`);
        }
    };

    const handleTestSync = async () => {
        setIsTesting(true);
        try {
            const success = await window.aegis.cloudSync.test(syncConfig);
            if (success) alert(t('cloudSync.testSuccess'));
            else alert(t('cloudSync.testFailed'));
        } catch (err: any) {
            alert(`${t('cloudSync.testFailed')}: ${err.message}`);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSyncPush = async () => {
        setIsSyncing(true);
        try {
            const result = await window.aegis.cloudSync.push();
            if (result.success) alert(t('common.success'));
            else alert(result.error || t('common.error'));
        } catch (err: any) {
            alert(`${t('common.error')}: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const tabs = [
        { id: 'general', label: t('settings.general'), icon: <Globe className="w-4 h-4" /> },
        { id: 'security', label: t('settings.security'), icon: <Shield className="w-4 h-4" /> },
        { id: 'emergency', label: t('settings.emergencyAccess'), icon: <ShieldCheck className="w-4 h-4" /> },
        { id: 'sync', label: t('settings.sync'), icon: <Smartphone className="w-4 h-4" /> },
        { id: 'premium', label: t('premium.title'), icon: <Sparkles className="w-4 h-4" /> },
        { id: 'about', label: t('settings.about'), icon: <Info className="w-4 h-4" /> },
    ];

    const autoLockOptions = [
        { value: 1, label: t('settings.autoLockOptions.1min') },
        { value: 5, label: t('settings.autoLockOptions.5min') },
        { value: 10, label: t('settings.autoLockOptions.10min') },
        { value: 30, label: t('settings.autoLockOptions.30min') },
        { value: 0, label: t('settings.autoLockOptions.never') },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('settings.title')}>
            <div className="flex flex-col md:flex-row gap-6 min-h-[500px]">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-1/4 flex flex-row md:flex-col gap-1 border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0 md:pr-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                                ${activeTab === tab.id
                                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                    : 'text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent'}
                            `}
                        >
                            {tab.icon}
                            <span className="hidden md:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto max-h-[600px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {activeTab === 'general' && (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-sm font-bold text-white/20 uppercase tracking-widest mb-4">{t('settings.appearance')}</h4>
                                        <div className="space-y-4">
                                            <LanguageSelector />

                                            {/* Auto Lock */}
                                            <div className="p-4 rounded-xl bg-navy-800/50 border border-white/5">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Clock className="w-5 h-5 text-orange-400" />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-semibold text-white/90">{t('settings.autoLock')}</div>
                                                        <div className="text-xs text-white/30">{t('settings.autoLockDescLong')}</div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {autoLockOptions.map((option) => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => handleAutoLockChange(option.value)}
                                                            className={`
                                                                px-3 py-2 rounded-lg text-xs font-medium transition-all
                                                                ${autoLockTime === option.value
                                                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                                    : 'bg-navy-900/50 text-white/40 border border-white/5 hover:border-white/10'}
                                                            `}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="pt-4 border-t border-white/5 space-y-2">
                                        <h4 className="text-sm font-bold text-white/20 uppercase tracking-widest mb-3">{t('settings.quickActions')}</h4>

                                        <button
                                            onClick={handleLockVault}
                                            className="w-full flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 hover:border-yellow-500/30 transition-all group"
                                        >
                                            <div className="p-2 bg-yellow-500/20 rounded-lg">
                                                <LockKeyhole className="w-5 h-5 text-yellow-400" />
                                            </div>
                                            <div className="text-left flex-1">
                                                <div className="text-sm font-semibold text-yellow-400">{t('settings.lockVault')}</div>
                                                <div className="text-xs text-yellow-400/60">{t('settings.lockVaultDesc')}</div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={handleExit}
                                            className="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/30 transition-all group"
                                        >
                                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                                <LogOut className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div className="text-left flex-1">
                                                <div className="text-sm font-semibold text-blue-400">{t('settings.exit')}</div>
                                                <div className="text-xs text-blue-400/60">{t('settings.exitDesc')}</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-white/20 uppercase tracking-widest">{t('settings.securityLayer')}</h4>

                                    <div className="space-y-2">
                                        {/* Change Master Password */}
                                        {!isChangingPassword ? (
                                            <button
                                                onClick={() => setIsChangingPassword(true)}
                                                className="w-full flex items-center justify-between p-4 rounded-xl bg-navy-800/50 hover:bg-navy-800 border border-white/5 transition-all group cursor-pointer active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-navy-900 rounded-lg group-hover:scale-110 transition-transform">
                                                        <Key className="w-5 h-5 text-teal-400" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-semibold text-white/90">{t('settings.changeMasterPassword')}</div>
                                                        <div className="text-xs text-white/30">{t('settings.changeMasterPasswordDesc')}</div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
                                            </button>
                                        ) : (
                                            <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-sm font-bold text-teal-400">{t('settings.changeMasterPassword')}</h5>
                                                    <button
                                                        onClick={() => setIsChangingPassword(false)}
                                                        className="text-xs text-white/40 hover:text-white/60"
                                                    >
                                                        {t('common.cancel')}
                                                    </button>
                                                </div>
                                                <input
                                                    type="password"
                                                    placeholder={t('auth.currentPassword')}
                                                    value={passwordForm.current}
                                                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                                    className="w-full bg-navy-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder={t('auth.newPassword')}
                                                    value={passwordForm.new}
                                                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                                    className="w-full bg-navy-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder={t('auth.confirmNewPassword')}
                                                    value={passwordForm.confirm}
                                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                                    className="w-full bg-navy-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                                                />
                                                <button
                                                    onClick={handleChangePassword}
                                                    className="w-full bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                                >
                                                    {t('settings.changePasswordAction')}
                                                </button>
                                            </div>
                                        )}

                                        {/* 2FA */}
                                        <div className={`p-4 rounded-xl border transition-all ${is2FAEnabled ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-navy-800/50 border-white/5'}`}>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-lg ${is2FAEnabled ? 'bg-indigo-500/20' : 'bg-navy-900'}`}>
                                                        <Lock className={`w-5 h-5 ${is2FAEnabled ? 'text-indigo-400' : 'text-white/40'}`} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-semibold text-white/90">{t('settings.twoFactor')}</div>
                                                        <div className="text-xs text-white/30 truncate max-w-[200px]">
                                                            {is2FAEnabled ? 'Aktif (TOTP)' : t('settings.addSecurityLayer')}
                                                        </div>
                                                    </div>
                                                </div>

                                                {!is2FAEnabled && !isConfiguring2FA && (
                                                    <button
                                                        onClick={handle2FASetup}
                                                        className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        {t('settings.setup2FA')}
                                                    </button>
                                                )}

                                                {is2FAEnabled && (
                                                    <button
                                                        onClick={handle2FADisable}
                                                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        {t('settings.disable2FA')}
                                                    </button>
                                                )}
                                            </div>

                                            {/* 2FA Setup Flow */}
                                            {is2FAEnabled && (
                                                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={handleGenerateBackupCodes}
                                                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-white/5 transition-all"
                                                        >
                                                            Yedek Kodları Yenile
                                                        </button>
                                                        <button
                                                            onClick={handleExportTOTP}
                                                            className="flex-1 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-indigo-500/20 transition-all"
                                                        >
                                                            Dışa Aktar
                                                        </button>
                                                        <button
                                                            onClick={handleImportTOTP}
                                                            className="flex-1 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-teal-500/20 transition-all"
                                                        >
                                                            İçe Aktar
                                                        </button>
                                                    </div>

                                                    {backupCodes.length > 0 && (
                                                        <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                                                            <div className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-2 flex justify-between items-center">
                                                                <span>Yedek Kodlar (Kurtarma İçin)</span>
                                                                <span className="text-amber-500/50 italic text-[8px] normal-case">Güvenli bir yere kaydedin</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {backupCodes.map((code, idx) => (
                                                                    <div key={idx} className="font-mono text-[10px] text-white/60 bg-white/5 py-1 px-2 rounded border border-white/5 text-center select-all">
                                                                        {code}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <AnimatePresence>
                                                {isConfiguring2FA && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mt-4 pt-4 border-t border-white/10 space-y-4"
                                                    >
                                                        <div className="bg-navy-900/50 p-4 rounded-xl border border-white/10 text-center">
                                                            <div className="w-32 h-32 bg-white rounded-lg mx-auto mb-4 flex items-center justify-center p-2">
                                                                <QRCodeSVG
                                                                    value={`otpauth://totp/AegisVault:${deviceName || 'User'}?secret=${twoFASecret}&issuer=AegisVault`}
                                                                    size={112}
                                                                    level="M"
                                                                    includeMargin={false}
                                                                />
                                                            </div>
                                                            <div className="text-[10px] text-white/40 mb-1 uppercase tracking-widest font-bold">{t('settings.twoFASecretKey')}</div>
                                                            <div className="text-sm font-mono text-indigo-400 break-all bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
                                                                {twoFASecret}
                                                            </div>
                                                            <p className="text-[10px] text-white/30 mt-2 italic">
                                                                {t('settings.twoFAInstructions')}
                                                            </p>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                maxLength={6}
                                                                placeholder={t('settings.twoFACodePlaceholder')}
                                                                value={twoFACode}
                                                                onChange={(e) => setTwoFACode(e.target.value.replace(/[^0-9]/g, ''))}
                                                                className="flex-1 bg-navy-900 border border-white/10 rounded-lg px-4 py-2 text-center text-sm tracking-[0.5em] font-black focus:outline-none focus:border-indigo-500/50"
                                                            />
                                                            <button
                                                                onClick={handle2FAVerify}
                                                                className="px-6 py-2 bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                            >
                                                                {t('common.confirm')}
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => setIsConfiguring2FA(false)}
                                                            className="w-full text-xs text-white/20 hover:text-white/40 py-1 transition-colors underline"
                                                        >
                                                            {t('common.cancel')}
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {/* Biometric Unlock */}
                                        <BiometricSection />

                                        {/* Hardware Key Section */}
                                        <HardwareKeySection />

                                        {/* Duress Password Section */}
                                        <DuressPasswordSection />

                                        {/* Encryption Info */}
                                        <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                                            <div className="flex gap-3">
                                                <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0" />
                                                <p className="text-[11px] text-orange-400/70 leading-relaxed font-medium">
                                                    {t('settings.encryptionInfo')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Recovery Phrase Section */}
                                        <RecoveryPhraseSection />

                                        {/* Danger Zone */}
                                        <div className="pt-4 mt-4 border-t border-red-500/20">
                                            <h4 className="text-sm font-bold text-red-400/60 uppercase tracking-widest mb-3">{t('settings.dangerZone')}</h4>
                                            <button
                                                onClick={handleResetVault}
                                                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 transition-all group"
                                            >
                                                <div className="p-2 bg-red-500/20 rounded-lg">
                                                    <Trash2 className="w-5 h-5 text-red-400" />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <div className="text-sm font-semibold text-red-400">{t('settings.resetVault')}</div>
                                                    <div className="text-xs text-red-400/60">{t('settings.resetVaultDesc')}</div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-red-400/40 group-hover:text-red-400/80 transition-colors" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'emergency' && (
                                <EmergencyAccessSection />
                            )}

                            {activeTab === 'sync' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-white/20 uppercase tracking-widest">{t('cloudSync.title')}</h4>
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold ${syncConfig.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                                            {syncConfig.enabled ? t('settings.syncActive') : t('cloudSync.setupRequired')}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Sync Toggle */}
                                        <div className="p-4 rounded-xl bg-navy-800/50 border border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${syncConfig.enabled ? 'bg-indigo-500/20' : 'bg-white/5'}`}>
                                                    <Cloud className={`w-5 h-5 ${syncConfig.enabled ? 'text-indigo-400' : 'text-white/20'}`} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-white/90">{t('cloudSync.autoSync')}</div>
                                                    <div className="text-xs text-white/30">{t('cloudSync.autoSyncDesc')}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSyncConfig({ ...syncConfig, enabled: !syncConfig.enabled })}
                                                className={`relative w-12 h-6 rounded-full transition-all ${syncConfig.enabled ? 'bg-indigo-500' : 'bg-white/10'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${syncConfig.enabled ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        {syncConfig.enabled && (
                                            <div className="p-5 rounded-2xl bg-navy-800/50 border border-white/5 space-y-4">
                                                {/* Provider Selection */}
                                                <div className="grid grid-cols-4 gap-2">
                                                    {(['nextcloud', 'webdav', 'google', 's3'] as const).map((p) => (
                                                        <button
                                                            key={p}
                                                            onClick={() => setSyncConfig({ ...syncConfig, provider: p })}
                                                            className={`
                                                                py-2 px-3 rounded-lg border text-[10px] font-bold transition-all capitalize
                                                                ${syncConfig.provider === p
                                                                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                                                                    : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}
                                                            `}
                                                        >
                                                            {p}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                                                    <Lock className="w-4 h-4 text-emerald-400" />
                                                    <div className="text-xs text-emerald-400 font-medium">
                                                        {t('cloudSync.e2eeNotice')}
                                                    </div>
                                                </div>

                                                {/* Inputs */}
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-[10px] text-white/30 uppercase font-bold tracking-widest ml-1 mb-1 block">{t('cloudSync.endpoint')}</label>
                                                        <div className="relative">
                                                            <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                                            <input
                                                                type="text"
                                                                value={syncConfig.endpoint}
                                                                onChange={(e) => setSyncConfig({ ...syncConfig, endpoint: e.target.value })}
                                                                placeholder="https://nextcloud.example.com/remote.php/dav/files/user/"
                                                                className="w-full bg-navy-900 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] text-white/30 uppercase font-bold tracking-widest ml-1 mb-1 block">{t('cloudSync.username')}</label>
                                                            <input
                                                                type="text"
                                                                value={syncConfig.username}
                                                                onChange={(e) => setSyncConfig({ ...syncConfig, username: e.target.value })}
                                                                className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-white/30 uppercase font-bold tracking-widest ml-1 mb-1 block">{t('cloudSync.password')}</label>
                                                            <input
                                                                type="password"
                                                                value={syncConfig.password}
                                                                onChange={(e) => setSyncConfig({ ...syncConfig, password: e.target.value })}
                                                                className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] text-white/30 uppercase font-bold tracking-widest ml-1 mb-1 block">{t('cloudSync.path')}</label>
                                                        <input
                                                            type="text"
                                                            value={syncConfig.remotePath}
                                                            onChange={(e) => setSyncConfig({ ...syncConfig, remotePath: e.target.value })}
                                                            placeholder="AegisVault (optional)"
                                                            className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2 pt-2">
                                                    <button
                                                        onClick={handleTestSync}
                                                        disabled={isTesting}
                                                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white/60 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isTesting ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Database className="w-4 h-4" />
                                                        )}
                                                        {t('cloudSync.testConnection')}
                                                    </button>
                                                    <button
                                                        onClick={handleSaveSyncConfig}
                                                        className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
                                                    >
                                                        {t('common.save')}
                                                    </button>
                                                </div>

                                                {/* Sync Now */}
                                                <button
                                                    onClick={handleSyncPush}
                                                    disabled={isSyncing}
                                                    className="w-full mt-4 flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 hover:border-teal-500/30 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg bg-teal-500/20 ${isSyncing ? 'animate-spin' : ''}`}>
                                                            <RefreshCw className="w-5 h-5 text-teal-400" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-sm font-bold text-teal-400">{t('cloudSync.syncNow')}</div>
                                                            <div className="text-[10px] text-teal-400/60 uppercase tracking-widest">{t('cloudSync.lastSync')}: {new Date().toLocaleTimeString()}</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-teal-400/30 group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Device Stats (Always visible) */}
                                        <div className="p-4 rounded-xl bg-navy-800/50 border border-white/5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Laptop className="w-4 h-4 text-orange-400" />
                                                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{t('settings.deviceName')}</label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-white/20">{deviceId}</span>
                                                    <button
                                                        onClick={handleCopyDeviceId}
                                                        className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                                                        title={t('common.copy')}
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={deviceName}
                                                    onChange={(e) => setDeviceName(e.target.value)}
                                                    className="flex-1 bg-navy-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                                                />
                                                <button
                                                    onClick={handleSaveDeviceName}
                                                    className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    {t('common.save')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'premium' && (
                                <div className="space-y-6">
                                    {/* Premium Status Banner */}
                                    <div className={`p-6 rounded-[2rem] border transition-all ${licenseStatus?.isPremium ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-navy-950 border-white/5'}`}>
                                        <div className="flex items-center gap-6">
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl ${licenseStatus?.isPremium ? 'bg-indigo-500 shadow-indigo-500/40' : 'bg-navy-900 border border-white/5 shadow-black/40'}`}>
                                                <Crown className={`w-8 h-8 ${licenseStatus?.isPremium ? 'text-white' : 'text-white/20'}`} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="text-xl font-black text-white tracking-tight">{licenseStatus?.isPremium ? t('premium.statusBanner.premium') : t('premium.statusBanner.notPremium')}</h3>
                                                    {licenseStatus?.isPremium && (
                                                        <div className="px-3 py-1 bg-indigo-500 text-[10px] font-black italic rounded-full shadow-lg shadow-indigo-500/20">{t('premium.statusBanner.lifetime')}</div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
                                                    {licenseStatus?.isPremium ? t('premium.statusBanner.supportMessage') : t('premium.statusBanner.unlockFeatures')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {!licenseStatus?.isPremium && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-6 rounded-[1.5rem] bg-navy-800/30 border border-white/5 space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                                    <h4 className="text-xs font-black text-white/60 uppercase tracking-widest">{t('premium.activateTitle')}</h4>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="relative group">
                                                        <input
                                                            type="text"
                                                            value={licenseKey}
                                                            onChange={(e) => setLicenseKey(e.target.value)}
                                                            placeholder={t('premium.placeholder')}
                                                            className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-indigo-500/50 font-mono transition-all"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                const text = await navigator.clipboard.readText();
                                                                setLicenseKey(text);
                                                            }}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-lg text-white/20 hover:text-indigo-400 transition-all"
                                                            title={t('common.copySuccess').split(' ')[0]} // Use "Copy" variant or just title
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            setIsActivating(true);
                                                            const result = await activateLicense(licenseKey);
                                                            setIsActivating(false);
                                                            if (result.success) {
                                                                setActivationMessage({ type: 'success', text: t('common.success') });
                                                                setLicenseKey('');
                                                            } else {
                                                                const errorText = result.error === 'INVALID_LICENSE'
                                                                    ? t('premium.errors.invalidLicense')
                                                                    : (result.error || t('common.error'));
                                                                setActivationMessage({ type: 'error', text: errorText });
                                                            }
                                                        }}
                                                        disabled={isActivating || !licenseKey}
                                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                                                    >
                                                        {isActivating ? t('premium.activating') : t('premium.activateButton')}
                                                    </button>
                                                    {activationMessage && (
                                                        <div className={`text-[10px] font-bold text-center mt-2 ${activationMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {activationMessage.text}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="p-6 rounded-[1.5rem] bg-navy-800/30 border border-white/5 space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Timer className="w-4 h-4 text-orange-400" />
                                                    <h4 className="text-xs font-black text-white/60 uppercase tracking-widest">{t('premium.trialPeriod')}</h4>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center text-sm font-bold">
                                                        <span className="text-white/40">{t('premium.trialPeriod')}</span>
                                                        <span className="text-white">3 {t('settings.autoLockOptions.1min').split(' ')[1]}</span>
                                                    </div>
                                                    <div className="h-2 bg-navy-900 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(licenseStatus?.trialDaysLeft || 0) / 3 * 100}%` }}
                                                            className="h-full bg-gradient-to-r from-orange-600 to-orange-400"
                                                        />
                                                    </div>
                                                    <div className="text-[10px] text-orange-500/60 font-black text-center uppercase tracking-widest">
                                                        {t('premium.trialDaysRemaining').replace('{days}', String(licenseStatus?.trialDaysLeft))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!licenseStatus?.isPremium && (
                                        <div className="p-6 rounded-[2rem] bg-navy-800/50 border border-white/5 space-y-6">
                                            <div className="flex items-center gap-3">
                                                <Coins className="w-6 h-6 text-yellow-500" />
                                                <div>
                                                    <h4 className="text-sm font-black text-white tracking-tight leading-none mb-1">{t('premium.paymentTitle')}: 15 Euro</h4>
                                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{t('premium.paymentDesc')}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {[
                                                    { name: 'BTC/USDT-TRC20', addr: 'TQBz3q8Ddjap3K8QdFQHtJKBxbvXMCi62E' },
                                                    { name: 'ETH', addr: '0x4bd17Cc073D08E3E021Fd315d840554c840843E1' },
                                                    { name: 'SOL', addr: '81H1rKZHjpSsnr6Epumw9XVTfqAnqSHcTKm7D3VsEd74' },
                                                    { name: 'LTC', addr: 'LZC3egqj1K9aZ3i42HbsRWK7m1SbUgXmak' },
                                                    { name: 'BCH', addr: 'qzfd46kp4tguu8pxrs6gnux0qxndhnqk8sa83q08wm' },
                                                    { name: 'XTZ', addr: 'tz1Tij1ujzkEyvA949x1q7EW17s6pUNbEUdV' }
                                                ].map((crypto) => (
                                                    <div key={crypto.name} className="p-3 rounded-xl bg-navy-900 border border-white/5 space-y-1">
                                                        <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">{crypto.name}</div>
                                                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                            <div className="text-[10px] font-mono text-white/60 truncate">{crypto.addr}</div>
                                                            <button
                                                                onClick={() => {
                                                                    window.navigator.clipboard.writeText(crypto.addr);
                                                                    alert(t('common.copySuccess'));
                                                                }}
                                                                className="shrink-0 p-1.5 hover:bg-white/5 rounded-lg text-white/20 hover:text-white transition-colors"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Info className="w-4 h-4 text-orange-400" />
                                                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{t('premium.howToGetTitle')}</span>
                                                </div>
                                                <p className="text-[11px] text-white/50 leading-relaxed">
                                                    {t('premium.howToGetDesc')}
                                                </p>
                                                <div className="flex items-center justify-between p-3 bg-navy-950 rounded-lg border border-white/5">
                                                    <div className="text-[10px] font-mono text-white/40">{deviceId}</div>
                                                    <button
                                                        onClick={handleCopyDeviceId}
                                                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase"
                                                    >
                                                        {t('common.copy')} {t('common.deviceId')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'about' && (
                                <div className="space-y-6 text-center py-4">
                                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <Shield className="w-10 h-10 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Aegis Vault 3.0</h3>
                                        <p className="text-indigo-400 text-sm font-medium">{t('settings.version')}</p>
                                    </div>
                                    <p className="text-white/40 text-sm max-w-xs mx-auto">
                                        {t('settings.description')}
                                    </p>

                                    <div className="bg-navy-900/50 p-3 rounded-2xl border border-white/5 max-w-[200px] mx-auto">
                                        <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1">{t('common.deviceId')}</div>
                                        <div className="text-xs font-mono text-white/60 font-bold tracking-wider">{deviceId}</div>
                                    </div>

                                    <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
                                        <button onClick={() => setShowDoc('terms')} className="text-xs text-white/30 hover:text-white transition-colors underline decoration-white/10 underline-offset-4">{t('settings.termsOfService')}</button>
                                        <span className="w-1 h-1 bg-white/10 rounded-full" />
                                        <button onClick={() => setShowDoc('policy')} className="text-xs text-white/30 hover:text-white transition-colors underline decoration-white/10 underline-offset-4">{t('settings.privacyPolicy')}</button>
                                    </div>

                                    <AnimatePresence>
                                        {showDoc && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10 text-left"
                                            >
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                                        {showDoc === 'policy' ? t('auth.privacy.policyTitle') : t('auth.privacy.termsTitle')}
                                                    </span>
                                                    <button onClick={() => setShowDoc(null)} className="text-[10px] text-white/20 hover:text-white uppercase font-bold">Close</button>
                                                </div>
                                                <div className="text-[11px] text-white/50 leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto pr-2 scrollbar-none">
                                                    {showDoc === 'policy' ? t('auth.privacy.policyContent') : t('auth.privacy.termsContent')}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </Modal>
    );
};

export default SettingsModal;
