import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useVaultStore, VaultEntry } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
    Send,
    Download,
    ShieldCheck,
    Copy,
    Check,
    Zap,
    Key,
    QrCode,
    ArrowRight,
    RefreshCw,
    Clock,
    Lock,
    Link as LinkIcon,
    Settings as SettingsIcon,
    MoreHorizontal,
    Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SharingModalProps {
    isOpen: boolean;
    onClose: () => void;
    entryToShare?: VaultEntry;
}

const SharingModal: React.FC<SharingModalProps> = ({ isOpen, onClose, entryToShare }) => {
    const { t } = useTranslation();
    const { saveEntry } = useVaultStore();

    const [mode, setMode] = useState<'share' | 'receive'>(entryToShare ? 'share' : 'receive');
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Receive State
    const [keyPair, setKeyPair] = useState<{ publicKey: string; secretKey: string } | null>(null);
    const [receivedPayload, setReceivedPayload] = useState('');

    // Share State
    const [portalCode, setPortalCode] = useState('');
    const [generatedPayload, setGeneratedPayload] = useState('');
    const [expiration, setExpiration] = useState('1h');
    const [accessPassword, setAccessPassword] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [sharingLink, setSharingLink] = useState('');

    const generateRequest = async () => {
        setIsLoading(true);
        try {
            const keys = await window.aegis.crypto.generateKeyPair();
            setKeyPair(keys);
            setStep(2);
        } catch (error) {
            console.error('Failed to generate PQC keys:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = async () => {
        if (!portalCode || !entryToShare) return;
        setIsLoading(true);
        try {
            // Bundle entry data with expiration and access control meta
            const entryData = JSON.stringify({
                title: entryToShare.title,
                username: entryToShare.username,
                password: entryToShare.password,
                website: entryToShare.website,
                notes: entryToShare.notes,
                type: entryToShare.type,
                meta: {
                    expires: expiration,
                    secured: accessPassword ? true : false,
                    timestamp: Date.now()
                }
            });

            // If access password is set, we could do an extra layer of encryption here
            // For now, we use PQC with the portal code (public key)
            const payload = await window.aegis.crypto.encryptPQC(entryData, portalCode);
            setGeneratedPayload(payload);

            // Generate a simulated secure link
            // In production, this would upload to a temporary storage server
            const link = `https://share.hetech-me.space/#/receive?p=${encodeURIComponent(payload)}`;
            setSharingLink(link);

            setStep(2);
        } catch (error) {
            console.error('Failed to encrypt share:', error);
            alert(t('sharing.invalidCode'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleReceive = async () => {
        if (!receivedPayload || !keyPair) return;
        setIsLoading(true);
        try {
            const decrypted = await window.aegis.crypto.decryptPQC(receivedPayload, keyPair.secretKey);
            const entryData = JSON.parse(decrypted);

            // Access Control Check (If implemented in meta)
            // if (entryData.meta?.secured) { ... prompt for password ... }

            await saveEntry({
                ...entryData,
                id: crypto.randomUUID(),
                category: 'General',
                tags: 'Shared'
            });

            setStep(3);
        } catch (error) {
            console.error('Failed to decrypt payload:', error);
            alert(t('sharing.invalidCode'));
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setKeyPair(null);
            setPortalCode('');
            setGeneratedPayload('');
            setReceivedPayload('');
            setShowAdvanced(false);
            setSharingLink('');
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('sharing.title')}>
            <div className="space-y-6">
                {/* Header Info */}
                <div className="flex items-center gap-4 p-4 bg-indigo-500/5 rounded-3xl border border-indigo-500/10">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                        <Zap className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-white font-bold">{t('sharing.quantumSafe')}</h4>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest">{t('sharing.subtitle')}</p>
                    </div>
                </div>

                {/* Mode Selector */}
                {!entryToShare && step === 1 && (
                    <div className="flex bg-navy-800/50 p-1.5 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setMode('receive')}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'receive' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40'}`}
                        >
                            <Download className="w-4 h-4" /> {t('common.receive')}
                        </button>
                        <button
                            onClick={() => setMode('share')}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'share' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40'}`}
                        >
                            <Send className="w-4 h-4" /> {t('common.share')}
                        </button>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {/* SHARE FLOW */}
                    {mode === 'share' && (
                        <motion.div
                            key="share"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {step === 1 ? (
                                <div className="space-y-4">
                                    <div className="p-6 bg-navy-800/30 rounded-3xl border border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-black uppercase tracking-widest text-white/30">{t('sharing.portalCode')}</label>
                                            <div className="p-1 px-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center gap-1.5">
                                                <Shield className="w-3 h-3 text-indigo-400" />
                                                <span className="text-[10px] text-indigo-400 font-bold uppercase">PQC Active</span>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={portalCode}
                                                onChange={(e) => setPortalCode(e.target.value)}
                                                placeholder="AEGIS-XXXX-XXXX..."
                                                className="w-full bg-navy-950 border border-white/10 rounded-2xl py-4 px-6 text-white text-center font-mono focus:border-indigo-500/50 transition-all outline-none"
                                            />
                                        </div>
                                        <p className="text-[10px] text-white/30 text-center px-4 leading-relaxed">
                                            {t('sharing.shareInstruction')}
                                        </p>
                                    </div>

                                    {/* Advanced Settings */}
                                    <div className="border border-white/5 rounded-3xl overflow-hidden">
                                        <button
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="w-full p-4 bg-white/2 flex items-center justify-between hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <SettingsIcon className="w-4 h-4 text-white/40" />
                                                <span className="text-xs font-bold text-white/60">{t('sharing.advancedSecurity')}</span>
                                            </div>
                                            <MoreHorizontal className={`w-4 h-4 text-white/20 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showAdvanced && (
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: 'auto' }}
                                                    exit={{ height: 0 }}
                                                    className="bg-black/20 p-4 pt-0 space-y-4"
                                                >
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/20 flex items-center gap-2">
                                                                <Clock className="w-3 h-3" /> {t('sharing.expiration')}
                                                            </label>
                                                            <select
                                                                value={expiration}
                                                                onChange={(e) => setExpiration(e.target.value)}
                                                                className="w-full bg-navy-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/30"
                                                            >
                                                                <option value="1h">{t('sharing.oneHour')}</option>
                                                                <option value="1d">{t('sharing.oneDay')}</option>
                                                                <option value="1w">{t('sharing.oneWeek')}</option>
                                                                <option value="once">{t('sharing.oneView')}</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/20 flex items-center gap-2">
                                                                <Lock className="w-3 h-3" /> {t('sharing.accessPassword')}
                                                            </label>
                                                            <input
                                                                type="password"
                                                                value={accessPassword}
                                                                onChange={(e) => setAccessPassword(e.target.value)}
                                                                placeholder="****"
                                                                className="w-full bg-navy-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/30"
                                                            />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <button
                                        onClick={handleShare}
                                        disabled={!portalCode || isLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                                    >
                                        {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5" /> {t('sharing.generateLink')}</>}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6 text-center">
                                    <div className="p-8 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
                                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-4 border border-emerald-500/30">
                                            <LinkIcon className="w-8 h-8" />
                                        </div>
                                        <h4 className="text-white font-bold mb-1">{t('sharing.linkCreated')}</h4>
                                        <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-4">Post-Quantum Tunnel Active</p>

                                        <div className="relative group mt-4">
                                            <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 pr-12 text-[10px] font-mono text-emerald-400/80 truncate">
                                                {sharingLink}
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(sharingLink)}
                                                className="absolute top-1/2 -translate-y-1/2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all shadow-lg"
                                            >
                                                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* Manual Payload Option */}
                                        <div className="mt-4 pt-4 border-t border-white/5">
                                            <button
                                                onClick={() => setShowAdvanced(!showAdvanced)}
                                                className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5 mx-auto"
                                            >
                                                <Key className="w-3 h-3" /> {t('sharing.encryptedData')} (Manual)
                                            </button>
                                            <AnimatePresence>
                                                {showAdvanced && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="mt-3"
                                                    >
                                                        <textarea
                                                            readOnly
                                                            value={generatedPayload}
                                                            className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[9px] font-mono text-white/40 h-24 resize-none outline-none"
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-navy-800/10 rounded-2xl border border-white/5">
                                        <div className="flex items-center justify-center gap-4">
                                            <div className="flex items-center gap-2 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                                <Clock className="w-3 h-3" /> {expiration === '1h' ? t('sharing.oneHour') : expiration === '1d' ? t('sharing.oneDay') : expiration}
                                            </div>
                                            <span className="w-1 h-1 bg-white/10 rounded-full" />
                                            <div className="flex items-center gap-2 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                                <ShieldCheck className="w-3 h-3 text-emerald-500/50" /> E2EE (ML-KEM)
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-full bg-navy-800 hover:bg-navy-700 text-white font-bold py-4 rounded-2xl transition-all"
                                    >
                                        {t('common.close')}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* RECEIVE FLOW */}
                    {mode === 'receive' && (
                        <motion.div
                            key="receive"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {step === 1 ? (
                                <div className="text-center space-y-6 py-8">
                                    <div className="w-24 h-24 bg-indigo-500/10 rounded-[40px] flex items-center justify-center text-indigo-400 mx-auto border-2 border-dashed border-indigo-500/20">
                                        <Key className="w-10 h-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white">{t('sharing.generateRequest')}</h3>
                                        <p className="text-sm text-white/30 max-w-xs mx-auto">
                                            {t('sharing.receiveInstruction')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={generateRequest}
                                        disabled={isLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                                    >
                                        {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><QrCode className="w-5 h-5" /> {t('sharing.generateRequest')}</>}
                                    </button>
                                </div>
                            ) : step === 2 ? (
                                <div className="space-y-6">
                                    <div className="p-6 bg-navy-800/30 rounded-3xl border border-white/5 space-y-4">
                                        <label className="text-xs font-black uppercase tracking-widest text-white/30">
                                            {t('sharing.portalCode')}
                                        </label>
                                        <div className="relative group">
                                            <div className="w-full bg-navy-950 border border-indigo-500/30 rounded-2xl p-4 pr-12 font-mono text-sm text-white break-all select-all">
                                                {keyPair?.publicKey}
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(keyPair?.publicKey || '')}
                                                className="absolute top-1/2 -translate-y-1/2 right-2 p-3 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all"
                                            >
                                                {isCopied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-white/30 italic text-center">
                                            {t('sharing.portalCodeDesc')}
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-black uppercase tracking-widest text-white/30">
                                            {t('sharing.receivePayload')}
                                        </label>
                                        <textarea
                                            value={receivedPayload}
                                            onChange={(e) => setReceivedPayload(e.target.value)}
                                            placeholder="Paste payload here..."
                                            className="w-full bg-navy-950 border border-white/10 rounded-2xl p-4 text-xs font-mono text-white/60 h-24 focus:border-indigo-500/50 outline-none transition-all resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleReceive}
                                        disabled={!receivedPayload || isLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                                    >
                                        {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> {t('sharing.receivePayload')}</>}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-12 space-y-6">
                                    <motion.div
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                                    >
                                        <ShieldCheck className="w-10 h-10" />
                                    </motion.div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white">{t('sharing.decryptSuccess')}</h3>
                                        <p className="text-sm text-white/30">Veri güvenli tünelden geçerek kasanıza eklendi.</p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-full bg-navy-800 hover:bg-navy-700 text-white font-bold py-4 rounded-2xl transition-all"
                                    >
                                        {t('common.close')}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Modal>
    );
};

export default SharingModal;
