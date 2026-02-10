import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    Eye,
    EyeOff,
    Copy,
    Check,
    Search,
    LayoutList,
    StickyNote,
    FileText,
    Wallet,
    Lock,
    Trash2,
    Terminal,
    Award,
    Contact,
    CreditCard,
    Send
} from 'lucide-react';
import { useVaultStore, VaultEntry } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import SharingModal from './SharingModal';

const RecentPasswords: React.FC = () => {
    const { t } = useTranslation();
    const { entries, isLoading, deleteEntry } = useVaultStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [sharingEntry, setSharingEntry] = useState<VaultEntry | null>(null);

    const handleOpenExplorer = () => {
        window.aegis.window.openVaultExplorer();
    };

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCopy = async (id: string, text?: string) => {
        if (!text) return;
        await window.aegis.clipboard.setSecure(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(t('vault.confirmDelete'))) {
            try {
                await deleteEntry(id);
            } catch (err) {
                alert(t('vault.deleteFailed'));
            }
        }
    };

    const filteredEntries = useMemo(() => {
        return (entries as VaultEntry[])
            .filter(entry =>
                entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (entry.username && entry.username.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''))
            .slice(0, 5);
    }, [entries, searchTerm]);

    const getEntryIcon = (type: string) => {
        switch (type) {
            case 'note': return <StickyNote className="w-5 h-5 text-amber-400" />;
            case 'file': return <FileText className="w-5 h-5 text-indigo-400" />;
            case 'wallet': return <Wallet className="w-5 h-5 text-emerald-400" />;
            case 'card': return <CreditCard className="w-5 h-5 text-rose-400" />;
            case 'identity': return <Contact className="w-5 h-5 text-blue-400" />;
            case 'license': return <Award className="w-5 h-5 text-purple-400" />;
            case 'ssh': return <Terminal className="w-5 h-5 text-zinc-400" />;
            default: return <Lock className="w-5 h-5 text-teal-400" />;
        }
    };

    const getEntrySubtitle = (item: VaultEntry) => {
        if (item.type === 'login') return item.username || item.website || t('entry.types.login');
        if (item.type === 'note') return t('entry.types.note');
        if (item.type === 'file') return `${(item.fileSize ? item.fileSize / (1024 * 1024) : 0).toFixed(2)} MB - ${t('entry.types.file')}`;
        if (item.type === 'wallet') return t('entry.types.wallet');
        if (item.type === 'card') return item.cardHolder || t('entry.types.card');
        if (item.type === 'identity') return item.idNumber || t('entry.types.identity');
        if (item.type === 'license') return item.licenseKey ? `${item.licenseKey.substring(0, 8)}...` : t('entry.types.license');
        if (item.type === 'ssh') return t('entry.types.ssh');
        return t('entry.types.entry');
    };

    const getPrimaryValue = (item: VaultEntry) => {
        if (item.type === 'login') return item.password;
        if (item.type === 'note') return item.notes;
        if (item.type === 'wallet') return item.seedPhrase || item.walletAddress;
        if (item.type === 'card') return item.cardNumber;
        if (item.type === 'identity') return item.idNumber;
        if (item.type === 'license') return item.licenseKey;
        if (item.type === 'ssh') return item.privateKey;
        return '';
    };

    return (
        <div className="bg-navy-800/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 h-full flex flex-col shadow-2xl relative overflow-hidden group/card shadow-indigo-500/5">
            <div className="flex items-center justify-between mb-6 group">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        <Clock className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h2 className="text-sm font-bold text-white tracking-tight">{t('dashboard.recentPasswords')}</h2>
                </div>
                <button
                    onClick={handleOpenExplorer}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-[11px] font-bold text-white group"
                >
                    <LayoutList className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                    {t('dashboard.viewAll')}
                </button>
            </div>

            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                    type="text"
                    placeholder={t('dashboard.searchRecent')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-navy-900/50 border border-white/5 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/30 transition-all font-medium"
                />
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full"
                            />
                            <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{t('common.loading')}</span>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-xs text-white/20 italic font-medium">{t('dashboard.noRecent')}</p>
                        </div>
                    ) : (
                        filteredEntries.map((item) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={() => handleCopy(item.id, getPrimaryValue(item))}
                                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 group transition-all cursor-pointer relative overflow-hidden"
                            >
                                <AnimatePresence>
                                    {copiedId === item.id && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute inset-0 bg-teal-500/90 backdrop-blur-sm z-20 flex items-center justify-center gap-2"
                                        >
                                            <Check className="w-4 h-4 text-white" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{t('common.copySuccess')}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 bg-navy-900 border border-white/5 rounded-xl flex items-center justify-center shrink-0 shadow-lg group-hover:bg-navy-800 transition-colors">
                                            {getEntryIcon(item.type)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-white truncate leading-none mb-1.5">{item.title}</div>
                                            <div className="text-[10px] text-white/30 truncate font-semibold uppercase tracking-wider">{getEntrySubtitle(item)}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.type !== 'file' ? (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePasswordVisibility(item.id);
                                                    }}
                                                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                                    title={t('common.edit')}
                                                >
                                                    {visiblePasswords.has(item.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(item.id, getPrimaryValue(item));
                                                    }}
                                                    className={`p-1.5 hover:bg-white/10 rounded-lg transition-all ${copiedId === item.id ? 'text-teal-400' : 'text-white/40 hover:text-white'}`}
                                                    title={t('common.copy')}
                                                >
                                                    {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSharingEntry(item);
                                                    }}
                                                    className="p-1.5 hover:bg-indigo-500/20 rounded-lg text-white/40 hover:text-indigo-400 transition-all"
                                                    title={t('common.share')}
                                                >
                                                    <Send size={14} />
                                                </button>
                                            </>
                                        ) : null}
                                        <button
                                            onClick={(e) => handleDelete(item.id, e)}
                                            className="p-1.5 hover:bg-red-500/20 rounded-lg text-white/40 hover:text-red-400 transition-all"
                                            title={t('common.delete')}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {visiblePasswords.has(item.id) && item.type !== 'file' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-2.5 p-2 bg-black/20 rounded-xl border border-white/5"
                                    >
                                        <div className="text-[10px] font-mono text-indigo-300 break-all select-all selection:bg-indigo-500/30">
                                            {item.type === 'login' ? item.password : item.type === 'wallet' ? item.seedPhrase : item.notes}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            <SharingModal
                isOpen={!!sharingEntry}
                onClose={() => setSharingEntry(null)}
                entryToShare={sharingEntry || undefined}
            />
        </div>
    );
};

export default RecentPasswords;
