import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Copy,
    Zap,
    Search,
    CheckCircle2,
    QrCode,
    AlertCircle,
    Plus,
    Gamepad2,
    Timer,
    Shield
} from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import { QRScanner } from '../ui/QRScanner';

interface TOTPModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TOTPModal: React.FC<TOTPModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { entries } = useVaultStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [codes, setCodes] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState(30);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const totpEntries = entries.filter(e => e.totpSecret && (
        e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.username?.toLowerCase().includes(searchTerm.toLowerCase())
    ));

    const [showScanner, setShowScanner] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const updateCodes = async () => {
            const newCodes: Record<string, string> = {};
            for (const entry of entries) {
                if (entry.totpSecret) {
                    try {
                        // SECURITY: Use generateCodeById to avoid passing secret through IPC

                        const titleLower = entry.title?.toLowerCase() || '';
                        const usernameLower = entry.username?.toLowerCase() || '';

                        const isSteam = titleLower.includes('steam') || usernameLower.includes('steam');
                        const isBlizzard = titleLower.includes('blizzard') || titleLower.includes('battle.net');

                        const options: any = {};
                        if (isSteam) options.isSteam = true;
                        if (isBlizzard) options.digits = 8;

                        const code = await window.aegis.totp.generateCodeById(entry.id, options);
                        newCodes[entry.id] = code;
                    } catch (e) {
                        console.error('TOTP Generation Failed:', e);
                        newCodes[entry.id] = '------';
                    }
                }
            }
            setCodes(newCodes);

            const now = Date.now();
            const currentSecond = Math.floor(now / 1000) % 30;
            setTimeLeft(30 - currentSecond);
        };

        updateCodes();
        const interval = setInterval(updateCodes, 1000);
        return () => clearInterval(interval);
    }, [isOpen, entries]);

    const handleCopy = (id: string, code: string) => {
        if (code === '------') return;
        window.aegis.clipboard.setSecure(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-navy-900 border border-white/10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-navy-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/10">
                            <Zap className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">{t('authenticator.title')}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                                    <Timer className="w-3 h-3 text-indigo-400" />
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                        {timeLeft}s {t('common.remaining')}
                                    </span>
                                </div>
                                <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">
                                    {totpEntries.length} {t('common.account')}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowScanner(true)}
                            className="p-3 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/10 transition-all active:scale-95 flex items-center gap-2"
                            title={t('authenticator.scanQr')}
                        >
                            <QrCode className="w-5 h-5" />
                            <Plus className="w-3 h-3 -ml-1" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-white/5 rounded-2xl text-white/20 hover:text-white transition-all active:scale-95"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-8 py-4 border-b border-white/5 bg-navy-950/30">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-navy-900/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/30 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Progress Bar (Timer) */}
                <div className="h-1 bg-navy-950 overflow-hidden">
                    <motion.div
                        initial={false}
                        animate={{ width: `${(timeLeft / 30) * 100}%` }}
                        transition={{ duration: 1, ease: "linear" }}
                        className={`h-full bg-gradient-to-r ${timeLeft < 5 ? 'from-rose-500 to-orange-500' : 'from-indigo-600 to-purple-600'}`}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-none bg-navy-950/20">
                    <AnimatePresence mode="popLayout">
                        {totpEntries.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-20 text-center space-y-4"
                            >
                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                    <QrCode className="w-10 h-10 text-white/10" />
                                </div>
                                <p className="text-sm text-white/20 italic font-medium px-10">
                                    {t('dashboard.noTotpAccounts') || 'Henüz 2FA/TOTP kaydı bulunmuyor. Yeni bir kayıt eklerken TOTP anahtarını girmeyi deneyin.'}
                                </p>
                            </motion.div>
                        ) : (
                            totpEntries.map((entry, index) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(index * 0.05, 1) }}
                                    className="p-5 rounded-[2rem] bg-navy-900/50 border border-white/5 flex items-center gap-5 group hover:border-indigo-500/30 transition-all hover:bg-navy-900/80 cursor-pointer"
                                    onClick={() => handleCopy(entry.id, codes[entry.id])}
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 group-hover:scale-110 transition-transform shadow-lg shadow-black/20 shrink-0">
                                        {(entry.title?.toLowerCase().includes('steam') || entry.title?.toLowerCase().includes('blizzard')) ? (
                                            <Gamepad2 className="w-6 h-6 text-indigo-400" />
                                        ) : (
                                            <Shield className="w-6 h-6 text-indigo-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-black text-white/90 truncate uppercase tracking-widest leading-tight">
                                            {entry.title}
                                            {entry.title?.toLowerCase().includes('steam') && (
                                                <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/20">STEAM</span>
                                            )}
                                            {entry.title?.toLowerCase().includes('blizzard') && (
                                                <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/20">BLIZZARD</span>
                                            )}
                                        </h3>
                                        <p className="text-[10px] text-white/30 font-bold truncate mt-0.5">{entry.username}</p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className={`text-2xl font-black tracking-[0.15em] font-mono leading-none ${timeLeft < 5 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                                                {codes[entry.id]?.length === 6 ? (
                                                    <>{codes[entry.id]?.substring(0, 3)} {codes[entry.id]?.substring(3)}</>
                                                ) : (
                                                    codes[entry.id]
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-all">
                                            {copiedId === entry.id ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            ) : (
                                                <Copy className="w-5 h-5" />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-6 bg-navy-950/50 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/30">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                            {t('dashboard.totpInfo') || 'Kodlar her 30 saniyede bir değişir'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Secure Sync Active</span>
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {showScanner && (
                    <QRScanner
                        onScan={async (data) => {
                            if (data.startsWith('otpauth://')) {
                                try {
                                    const url = new URL(data);
                                    const secret = url.searchParams.get('secret');
                                    const issuer = url.searchParams.get('issuer') || '';
                                    const label = decodeURIComponent(url.pathname.substring(url.pathname.indexOf('/') + 1));

                                    if (secret) {
                                        const [accIssuer, accName] = label.includes(':') ? label.split(':') : [issuer, label];

                                        await window.aegis.database.save({
                                            id: crypto.randomUUID(),
                                            type: 'login',
                                            title: accIssuer || issuer || 'New TOTP',
                                            username: accName || '',
                                            totpSecret: secret,
                                            category: 'Genel',
                                            lastUsed: new Date().toISOString()
                                        });
                                    }
                                } catch (e) {
                                    console.error('QR Parse Failed', e);
                                }
                            }
                            setShowScanner(false);
                        }}
                        onClose={() => setShowScanner(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default TOTPModal;
