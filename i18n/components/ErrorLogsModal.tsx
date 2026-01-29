
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Clock, AlertCircle, Terminal, Clipboard } from 'lucide-react';
import { ErrorHandlingService, ErrorLog } from '../../services/errorHandlingService';

interface ErrorLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: 'tr' | 'en';
}

const ErrorLogsModal: React.FC<ErrorLogsModalProps> = ({ isOpen, onClose, lang }) => {
    const [logs, setLogs] = React.useState<ErrorLog[]>([]);

    React.useEffect(() => {
        if (isOpen) {
            setLogs(ErrorHandlingService.getLogs());
        }
    }, [isOpen]);

    const handleClear = () => {
        ErrorHandlingService.clearLogs();
        setLogs([]);
    };

    const copyLogs = () => {
        const text = JSON.stringify(logs, null, 2);
        navigator.clipboard.writeText(text);
        alert(lang === 'tr' ? 'Günlükler panoya kopyalandı.' : 'Logs copied to clipboard.');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="glass w-full max-w-4xl h-[80vh] rounded-[3rem] border border-white/10 overflow-hidden flex flex-col shadow-2xl shadow-black/50"
                    >
                        {/* Header */}
                        <div className="p-10 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl">
                                    <Terminal size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                                        {lang === 'tr' ? 'Sistem Hata Günlükleri' : 'System Error Logs'}
                                    </h2>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                                        {lang === 'tr' ? 'Teknik Sorun Giderme Verileri' : 'Technical Troubleshooting Data'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={copyLogs}
                                    className="p-4 hover:bg-white/5 text-zinc-400 hover:text-white rounded-2xl transition-all border border-white/5"
                                    title={lang === 'tr' ? 'Kopyala' : 'Copy'}
                                >
                                    <Clipboard size={20} />
                                </button>
                                <button
                                    onClick={handleClear}
                                    className="p-4 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-2xl transition-all border border-white/5"
                                    title={lang === 'tr' ? 'Temizle' : 'Clear'}
                                >
                                    <Trash2 size={20} />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-4 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-10 space-y-4 custom-scrollbar bg-black/20">
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                    <div className="p-8 bg-zinc-800/50 rounded-full mb-6 italic">
                                        <AlertCircle size={64} />
                                    </div>
                                    <p className="text-sm font-black uppercase tracking-[0.2em]">
                                        {lang === 'tr' ? 'Henüz hata kaydı yok' : 'No error logs yet'}
                                    </p>
                                </div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="glass-light p-8 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all group">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="text-red-400 opacity-50"><AlertCircle size={16} /></div>
                                                <h4 className="text-xs font-black text-red-400 uppercase tracking-widest">
                                                    {log.context || 'UNSPECIFIED CONTEXT'}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                                <Clock size={12} />
                                                {new Date(log.timestamp).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                                            </div>
                                        </div>
                                        <p className="text-sm font-bold text-zinc-200 leading-relaxed mb-4 font-mono break-all selection:bg-red-500/30">
                                            {log.message}
                                        </p>
                                        {log.stack && (
                                            <div className="mt-4 p-6 bg-black/40 rounded-2xl border border-white/[0.03] overflow-x-auto">
                                                <pre className="text-[10px] text-zinc-600 font-mono leading-relaxed whitespace-pre group-hover:text-zinc-500 transition-colors">
                                                    {log.stack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ErrorLogsModal;
