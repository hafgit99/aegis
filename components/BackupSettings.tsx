import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database, RefreshCw, Clock, ShieldCheck, Trash2,
    ExternalLink, Download, AlertTriangle, CheckCircle2,
    Calendar, Settings2, FolderOpen, Loader2, Save
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { BackupService } from '../services/backupService';
import { BackupSchedule, BackupMetadata } from '../types';

const BackupSettings: React.FC = () => {
    const { t, lang } = useLanguage();
    const { masterKey } = useAuth();

    const [config, setConfig] = useState<BackupSchedule>({
        enabled: false,
        frequency: 'manual',
        maxBackups: 10
    });
    const [history, setHistory] = useState<BackupMetadata[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsRefreshing(true);
        try {
            const [conf, hist] = await Promise.all([
                BackupService.getConfig(),
                BackupService.getHistory()
            ]);
            setConfig(conf);
            setHistory(hist);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleToggleAuto = async (enabled: boolean) => {
        const newConfig = { ...config, enabled };
        setConfig(newConfig);
        await BackupService.saveConfig(newConfig);
    };

    const handleChangeFrequency = async (freq: BackupSchedule['frequency']) => {
        const newConfig = { ...config, frequency: freq };
        setConfig(newConfig);
        await BackupService.saveConfig(newConfig);
    };

    const handleManualBackup = async () => {
        if (!masterKey) return;
        setIsCreating(true);
        setSuccessMsg(null);
        try {
            const result = await BackupService.createBackup(masterKey);
            if (result) {
                setSuccessMsg(lang === 'tr' ? 'Yedekleme başarıyla oluşturuldu.' : 'Backup created successfully.');
                await loadData();
                setTimeout(() => setSuccessMsg(null), 3000);
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteBackup = async (id: string) => {
        await BackupService.deleteBackup(id);
        await loadData();
    };

    const handleClearHistory = async () => {
        if (confirm(lang === 'tr' ? 'Tüm yedekleme geçmişini silmek istediğinize emin misiniz?' : 'Are you sure you want to clear all backup history?')) {
            await BackupService.clearHistory();
            await loadData();
        }
    };

    return (
        <div className="space-y-8">
            {/* Auto Backup Control */}
            <div className="glass p-8 rounded-[2.5rem] border border-emerald-500/10 bg-emerald-500/[0.02] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <RefreshCw size={120} className="animate-spin-slow" />
                </div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl shadow-inner">
                            <Database size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">{t('backup_settings')}</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t('backup_settings_desc')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                        <button
                            onClick={() => handleToggleAuto(true)}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${config.enabled ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-zinc-600 hover:text-white'}`}
                        >
                            {t('status_enabled')}
                        </button>
                        <button
                            onClick={() => handleToggleAuto(false)}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!config.enabled ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-white'}`}
                        >
                            {t('status_disabled')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Calendar size={12} /> {lang === 'tr' ? 'YEDEKLEME SIKLIĞI' : 'BACKUP FREQUENCY'}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['daily', 'weekly', 'monthly'] as const).map(freq => (
                                <button
                                    key={freq}
                                    onClick={() => handleChangeFrequency(freq)}
                                    className={`py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${config.frequency === freq
                                        ? 'bg-white/10 border-white/20 text-white'
                                        : 'bg-black/20 border-white/5 text-zinc-600 hover:border-white/10 hover:text-zinc-400'
                                        }`}
                                >
                                    {t(`freq_${freq}` as any) || freq}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-end gap-3">
                        <button
                            onClick={handleManualBackup}
                            disabled={isCreating || !masterKey}
                            className="flex-1 py-4 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            {isCreating ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            {lang === 'tr' ? 'ŞİMDİ YEDEKLE' : 'BACKUP NOW'}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {successMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500"
                        >
                            <CheckCircle2 size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{successMsg}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Backup History */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-blue-600 rounded-full" />
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter">{lang === 'tr' ? 'Yedekleme Geçmişi' : 'Backup History'}</h3>
                    </div>
                    <button
                        onClick={handleClearHistory}
                        className="text-[9px] font-black text-zinc-600 hover:text-red-500 uppercase tracking-widest flex items-center gap-2 transition-colors"
                    >
                        <Trash2 size={12} /> {lang === 'tr' ? 'TÜMÜNÜ TEMİZLE' : 'CLEAR ALL'}
                    </button>
                </div>

                <div className="space-y-3">
                    {history.length === 0 ? (
                        <div className="glass p-12 rounded-[2rem] border border-white/5 text-center flex flex-col items-center gap-4 opacity-50">
                            <Clock size={40} className="text-zinc-700" />
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{lang === 'tr' ? 'Yedekleme kaydı bulunamadı' : 'No backup records found'}</p>
                        </div>
                    ) : (
                        history.map((backup) => (
                            <motion.div
                                key={backup.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass p-5 rounded-3xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-white/5 text-zinc-500 rounded-2xl group-hover:text-blue-500 transition-colors">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-white uppercase tracking-tight">
                                                {new Date(backup.timestamp).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                                            </span>
                                            {backup.verified && (
                                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-emerald-500/20">
                                                    {lang === 'tr' ? 'DOĞRULANDI' : 'VERIFIED'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                                            <span>{backup.id.split('-')[0]}...</span>
                                            <span>•</span>
                                            <span>{(backup.size / 1024).toFixed(1)} KB</span>
                                            <span>•</span>
                                            <span>{backup.location === 'local' ? (lang === 'tr' ? 'YEREL' : 'LOCAL') : 'CLOUD'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDeleteBackup(backup.id)}
                                        className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Security Tip */}
            <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-[2rem] flex gap-5">
                <div className="p-3 bg-blue-500/10 text-blue-500 h-fit rounded-xl">
                    <AlertTriangle size={20} />
                </div>
                <div className="space-y-2">
                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{lang === 'tr' ? 'Güvenlik Notu' : 'Security Advisory'}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                        {lang === 'tr'
                            ? "Yedekleriniz ana şifrenizle uçtan uca şifrelenir. Otomatik yedekleme özelliği, verilerinizin fiziksel bir hata durumunda bile güvende kalmasını sağlar."
                            : "Your backups are end-to-end encrypted with your master key. Auto-backup ensures your data remains safe even in case of hardware failure."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BackupSettings;
