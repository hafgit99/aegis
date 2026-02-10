import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import Modal from '../ui/Modal';
import { useVaultStore, VaultEntry } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
    Search,
    Trash2,
    Copy,
    Check,
    Eye,
    EyeOff,
    Lock,
    FileText,
    Wallet,
    StickyNote,
    Download,
    RefreshCw,
    RotateCcw,
    AlertCircle,
    X,
    CreditCard,
    Contact,
    Terminal,
    Award,
    QrCode,
    Edit
} from 'lucide-react';
import AddEntryModal from './AddEntryModal';
import { motion, AnimatePresence } from 'framer-motion';

interface VaultBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
    standalone?: boolean;
}

const ActionButton: React.FC<{ icon: React.ReactNode; onClick: (e: React.MouseEvent) => void; active?: boolean; color: string; title?: string }> = ({ icon, onClick, active, color, title }) => (
    <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
            e.stopPropagation();
            onClick(e);
        }}
        title={title}
        className={`p-2 rounded-xl bg-navy-900 border border-white/5 transition-all ${active ? 'bg-white/10 border-white/20' : 'hover:bg-white/5'} ${color}`}
    >
        {icon}
    </motion.button>
);

const VaultBrowserModal: React.FC<VaultBrowserModalProps> = ({ isOpen, onClose, standalone }) => {
    const { t } = useTranslation();
    const { entries, deleteEntry, fetchEntries, moveToTrash, restoreFromTrash, setEditingEntry } = useVaultStore();
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearch = useDeferredValue(searchTerm);
    const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
    const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});


    useEffect(() => {
        const updateCodes = async () => {
            const newCodes: Record<string, string> = {};
            for (const entry of entries) {
                if (entry.totpSecret) {
                    try {
                        const code = await window.aegis.totp.generateCode(entry.totpSecret);
                        newCodes[entry.id] = code;
                    } catch (e) {
                        console.error('TOTP error:', e);
                    }
                }
            }
            setTotpCodes(newCodes);
        };

        updateCodes();
        const interval = setInterval(updateCodes, 10000); // Update every 10s
        return () => clearInterval(interval);
    }, [entries]);


    // Filter and Sort entries
    const filteredEntries = useMemo(() => {
        const query = deferredSearch.toLowerCase();
        return (entries as VaultEntry[])
            .filter(e => {
                const isTrash = e.category === 'Trash';
                if (activeTab === 'active' && isTrash) return false;
                if (activeTab === 'trash' && !isTrash) return false;

                return e.title.toLowerCase().includes(query) ||
                    (e.username && e.username.toLowerCase().includes(query)) ||
                    (e.website && e.website.toLowerCase().includes(query));
            })
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [entries, deferredSearch, activeTab]);

    const handleCopy = async (id: string, text?: string) => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDelete = async (entry: VaultEntry) => {
        if (activeTab === 'trash') {
            if (confirm(t('vault.confirmDelete'))) {
                try {
                    await deleteEntry(entry.id);
                } catch (err) {
                    alert(t('vault.deleteFailed'));
                }
            }
        } else {
            if (confirm(t('vault.confirmMoveToTrash'))) {
                try {
                    await moveToTrash(entry);
                } catch (err) {
                    alert(t('vault.deleteFailed'));
                }
            }
        }
    };

    const handleRestore = async (entry: VaultEntry) => {
        try {
            await restoreFromTrash(entry);
        } catch (err) {
            alert(t('vault.restoreFailed'));
        }
    };

    const handleDownload = (entry: VaultEntry) => {
        if (!entry.fileData || !entry.fileName) return;
        const link = document.createElement('a');
        link.href = entry.fileData;
        link.download = entry.fileName;
        link.click();
    };

    const toggleVisible = (id: string) => {
        const next = new Set(visiblePasswords);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setVisiblePasswords(next);
    };

    const getIcon = (type: string) => {
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

    const getSubtitle = (item: VaultEntry) => {
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

    const getPreviewContent = (entry: VaultEntry) => {
        if (entry.type === 'login') return entry.password;
        if (entry.type === 'note') return entry.notes;
        if (entry.type === 'wallet') return entry.seedPhrase || entry.walletAddress;
        if (entry.type === 'card') return entry.cardNumber;
        if (entry.type === 'identity') return entry.idNumber;
        if (entry.type === 'license') return entry.licenseKey;
        if (entry.type === 'ssh') return entry.privateKey;
        return '';
    };

    const content = (
        <div className={`flex flex-col ${standalone ? 'h-full' : 'h-[75vh]'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                        <Lock className="w-8 h-8 text-indigo-400" />
                    </div>
                    {t('vault.title').toUpperCase()}
                    <span className="text-xs font-bold text-white/20 ml-2 tracking-widest uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        {filteredEntries.length} / {entries.length}
                    </span>
                </h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchEntries()}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all group"
                        title={t('vault.refreshData')}
                    >
                        <RefreshCw className="w-6 h-6 text-white/40 group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-red-500/20 rounded-2xl border border-white/5 hover:border-red-500/30 transition-all group"
                        title={standalone ? "Pencereyi Kapat" : "Kapat"}
                    >
                        <X className="w-6 h-6 text-white/40 group-hover:text-red-400 transition-colors" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-black/20 rounded-2xl border border-white/5 w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'active'
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                >
                    {t('vault.activeEntries')}
                </button>
                <button
                    onClick={() => setActiveTab('trash')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'trash'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Trash2 size={16} />
                    {t('vault.trash')}
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                    <input
                        type="text"
                        placeholder={t('vault.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-navy-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                        autoFocus
                    />
                </div>
            </div>

            {activeTab === 'trash' && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                    <AlertCircle size={14} />
                    {t('vault.trashWarning')}
                </div>
            )}

            {/* List Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-bold text-white/10 uppercase tracking-widest border-b border-white/5 mb-2">
                <div className="col-span-5">{t('vault.entryDetails')}</div>
                <div className="col-span-5">{t('vault.contentPreview')}</div>
                <div className="col-span-2 text-right">{t('vault.actions')}</div>
            </div>

            {/* Entry List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                <AnimatePresence mode='popLayout' initial={false}>
                    {filteredEntries.length === 0 ? (
                        <div className="text-center py-20 text-white/10 italic font-medium">
                            {t('vault.noResults')}
                        </div>
                    ) : (
                        filteredEntries.slice(0, 100).map((entry) => (
                            <motion.div
                                key={entry.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => handleCopy(entry.id, getPreviewContent(entry))}
                                className="grid grid-cols-12 gap-4 items-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden cursor-pointer"
                            >
                                <AnimatePresence>
                                    {copiedId === entry.id && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 1.05 }}
                                            className="absolute inset-0 bg-teal-500/90 backdrop-blur-sm z-20 flex items-center justify-center gap-2"
                                        >
                                            <Check className="w-5 h-5 text-white" />
                                            <span className="text-sm font-black text-white uppercase tracking-widest">{t('common.copySuccess')}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Info */}
                                <div className="col-span-5 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-navy-900 border border-white/5 flex items-center justify-center shrink-0">
                                        {getIcon(entry.type)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-white truncate">{entry.title}</div>
                                        <div className="text-[10px] text-white/20 truncate mt-0.5 font-medium uppercase tracking-wider">{getSubtitle(entry)}</div>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="col-span-5">
                                    {entry.type === 'file' ? (
                                        <div className="text-[10px] text-indigo-400/50 font-mono italic">
                                            {entry.fileName}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-black/10 px-3 py-1.5 rounded-lg border border-white/5">
                                            <span className="flex-1 truncate text-[11px] font-mono text-white/40">
                                                {visiblePasswords.has(entry.id)
                                                    ? getPreviewContent(entry)
                                                    : '••••••••••••••••'}
                                            </span>

                                            {entry.totpSecret && totpCodes[entry.id] && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(entry.id, totpCodes[entry.id]);
                                                    }}
                                                    className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md text-[9px] font-black uppercase tracking-tighter border border-indigo-500/20 hover:bg-indigo-500/30 transition-all flex items-center gap-1"
                                                >
                                                    <QrCode size={10} />
                                                    {totpCodes[entry.id]}
                                                </button>
                                            )}

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleVisible(entry.id);
                                                }}
                                                className="text-white/20 hover:text-white transition-colors"
                                            >
                                                {visiblePasswords.has(entry.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    )}

                                </div>

                                {/* Actions */}
                                < div className="col-span-2 flex justify-end items-center gap-2" >
                                    {activeTab === 'trash' ? (
                                        <>
                                            <ActionButton
                                                icon={<RotateCcw size={16} />}
                                                onClick={() => handleRestore(entry)}
                                                color="text-emerald-400"
                                                title={t('vault.restore')}
                                            />
                                            <ActionButton
                                                icon={<Trash2 size={16} />}
                                                onClick={() => handleDelete(entry)}
                                                color="text-red-500"
                                                title={t('vault.permanentDelete')}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            {entry.type === 'file' ? (
                                                <ActionButton
                                                    icon={<Download size={16} />}
                                                    onClick={() => {
                                                        handleDownload(entry);
                                                    }}
                                                    color="text-indigo-400"
                                                />
                                            ) : (
                                                <ActionButton
                                                    icon={copiedId === entry.id ? <Check size={16} /> : <Copy size={16} />}
                                                    onClick={() => handleCopy(entry.id, getPreviewContent(entry))}
                                                    active={copiedId === entry.id}
                                                    color="text-teal-400"
                                                />
                                            )}
                                            <ActionButton
                                                icon={<Edit size={16} />}
                                                onClick={() => {
                                                    setEditingEntry(entry);
                                                    setShowEditModal(true);
                                                }}
                                                color="text-indigo-400"
                                                title={t('common.edit')}
                                            />
                                            <ActionButton
                                                icon={<Trash2 size={16} />}
                                                onClick={() => handleDelete(entry)}
                                                color="text-red-400/50 hover:text-red-400"
                                                title={t('vault.moveToTrash')}
                                            />
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                    {
                        filteredEntries.length > 100 && (
                            <div className="text-center py-4 text-[10px] text-white/20 font-bold uppercase tracking-widest bg-white/5 rounded-xl border border-dashed border-white/10">
                                {t('vault.showingLimit')}
                            </div>
                        )
                    }
                </AnimatePresence >
            </div >
            <AddEntryModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingEntry(null);
                }}
            />
        </div >
    );

    if (standalone) {
        return content;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${t('vault.title')} (${entries.length} ${t('common.entries', { count: entries.length })})`}>
            {content}
        </Modal>
    );
};

export default VaultBrowserModal;
