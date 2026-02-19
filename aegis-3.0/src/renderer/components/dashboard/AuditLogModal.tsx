import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    Info,
    X,
    Search,
    Download,
    ShieldCheck,
    AlertTriangle,
    Activity,
    Clock,
    User,
    Lock,
    RefreshCw,
    Database,
    Zap
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface AuditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AuditLog {
    timestamp: string;
    event: string;
    details: any;
    deviceFingerprint: string;
    appVersion: string;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [integrityStatus, setIntegrityStatus] = useState<{ valid: boolean; message: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
            checkIntegrity();
        }
    }, [isOpen]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const data = await window.aegis.security.getAuditLogs();
            setLogs(data || []);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const checkIntegrity = async () => {
        try {
            const status = await window.aegis.security.verifyAuditLog();
            setIntegrityStatus(status);
        } catch (err) {
            console.error('Failed to verify audit log integrity:', err);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getEventIcon = (event: string) => {
        if (event.includes('vault:open')) return <Lock className="w-4 h-4 text-emerald-400" />;
        if (event.includes('breach')) return <AlertTriangle className="w-4 h-4 text-rose-400" />;
        if (event.includes('clipboard')) return <Activity className="w-4 h-4 text-amber-400" />;
        if (event.includes('sync')) return <RefreshCw className="w-4 h-4 text-blue-400" />;
        if (event.includes('p2p')) return <Zap className="w-4 h-4 text-purple-400" />;
        return <Info className="w-4 h-4 text-indigo-400" />;
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
                className="relative w-full max-w-4xl bg-navy-900 border border-white/10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-navy-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/10">
                            <Shield className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">{t('settings.auditLog')}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                {integrityStatus?.valid ? (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">GÜVENLİ</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">RİSKLİ</span>
                                    </div>
                                )}
                                <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">
                                    {logs.length} KAYIT BULUNDU
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-white/5 rounded-2xl text-white/20 hover:text-white transition-all active:scale-95"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search & Actions */}
                <div className="px-8 py-4 border-b border-white/5 bg-navy-950/30 flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-navy-900/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/30 transition-all font-medium"
                        />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={fetchLogs}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white transition-all active:scale-95"
                            title={t('common.refresh')}
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                            DIŞA AKTAR
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-none bg-navy-950/20">
                    <AnimatePresence mode="popLayout">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center gap-4">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"
                                />
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Kayıtlar Yükleniyor...</span>
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-20 text-center space-y-4"
                            >
                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                    <Database className="w-10 h-10 text-white/10" />
                                </div>
                                <p className="text-sm text-white/20 italic font-medium">Herhangi bir kayıt bulunamadı.</p>
                            </motion.div>
                        ) : (
                            filteredLogs.map((log, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(index * 0.05, 1) }}
                                    className="p-5 rounded-[2rem] bg-navy-900/50 border border-white/5 flex items-start gap-5 group hover:border-indigo-500/30 transition-all hover:bg-navy-900"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 group-hover:scale-110 transition-transform shadow-lg shadow-black/20 shrink-0">
                                        {getEventIcon(log.event)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-white/80 uppercase tracking-widest truncate">
                                                {log.event.replace(/:/g, ' ')}
                                            </span>
                                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                                <Clock className="w-3 h-3 text-white/20" />
                                                <span className="text-[10px] font-bold text-white/20">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/20 border border-white/[0.02] mt-2">
                                            <pre className="text-[10px] text-indigo-300/60 font-mono whitespace-pre-wrap break-all leading-relaxed">
                                                {JSON.stringify(log.details, null, 2)}
                                            </pre>
                                        </div>
                                        <div className="flex items-center gap-4 mt-3 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3 h-3" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">{log.deviceFingerprint?.substring(0, 8)}...</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Zap className="w-3 h-3" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">v{log.appVersion}</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-6 bg-navy-950/50 border-t border-white/5 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Live Audit Logging Enabled</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AuditLogModal;
