import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { Clock, RotateCcw, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface HistoryItem {
    changedAt: number;
    data: string;
    version: number;
}

interface PasswordHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    entryId: string;
    onRestore: (data: any) => void;
}

const PasswordHistoryModal: React.FC<PasswordHistoryModalProps> = ({
    isOpen,
    onClose,
    entryId,
    onRestore
}) => {
    const { t } = useTranslation();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && entryId) {
            loadHistory();
        }
    }, [isOpen, entryId]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await window.aegis.database.getHistory(entryId);
            setHistory(data);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setLoading(false);
        }
    };

    const parseData = (hexData: string) => {
        try {
            const json = Buffer.from(hexData, 'hex').toString();
            return JSON.parse(json);
        } catch (e) {
            return { password: 'Error' };
        }
    };

    const togglePassword = (index: number) => {
        setVisiblePasswords(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const copyToClipboard = (text: string, index: number) => {
        window.aegis.clipboard.setSecure(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('entry.passwordHistory') || 'Şifre Geçmişi'}
        >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-white/40 text-sm animate-pulse">{t('common.loading')}</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                        <div className="p-4 bg-white/5 rounded-2xl text-white/20">
                            <Clock size={32} />
                        </div>
                        <p className="text-white/40 text-sm">{t('entry.noHistory') || 'Bu öğe için henüz bir şifre geçmişi bulunmuyor.'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item, index) => {
                            const data = parseData(item.data);
                            const isVisible = visiblePasswords[index];

                            return (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-navy-900/50 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
                                                v{item.version}
                                            </div>
                                            <div>
                                                <p className="text-xs text-white/40">{formatDate(item.changedAt)}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onRestore(data)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider"
                                        >
                                            <RotateCcw size={12} />
                                            {t('common.restore') || 'Geri Yükle'}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 bg-navy-950/50 rounded-xl px-3 py-2.5 border border-white/5">
                                        <div className="flex-1 font-mono text-sm text-white truncate">
                                            {isVisible ? data.password : '••••••••••••••••'}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => togglePassword(index)}
                                                className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                            >
                                                {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(data.password, index)}
                                                className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                                            >
                                                {copiedIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {(data.username || data.notes) && (
                                        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                                            {data.username && (
                                                <div className="text-[10px]">
                                                    <span className="text-white/20 block mb-0.5 uppercase tracking-tighter">Kullanıcı Adı</span>
                                                    <span className="text-white/60 truncate block">{data.username}</span>
                                                </div>
                                            )}
                                            {data.notes && (
                                                <div className="text-[10px]">
                                                    <span className="text-white/20 block mb-0.5 uppercase tracking-tighter">Notlar</span>
                                                    <span className="text-white/60 truncate block">{data.notes.substring(0, 20)}...</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                >
                    {t('common.close')}
                </button>
            </div>
        </Modal>
    );
};

export default PasswordHistoryModal;
