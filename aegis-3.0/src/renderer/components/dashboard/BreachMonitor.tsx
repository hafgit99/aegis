import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldCheck, Search, ShieldAlert } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';

interface BreachData {
    status: 'checking' | 'safe' | 'breached';
    breachedCount: number;
    lastCheck: string;
    totalChecked: number;
    currentProgress: number;
    breachedTitles?: string[];
}

const BreachMonitor: React.FC = () => {
    const { t } = useTranslation();
    const { entries, setWatchtowerOpen, scanAllBreaches, breachedEntriesCount, lastBreachScan, breachedEntryIds } = useVaultStore();
    const [breachData, setBreachData] = useState<BreachData>({
        status: 'safe',
        breachedCount: 0,
        lastCheck: '',
        totalChecked: 0,
        currentProgress: 0,
    });

    const checkBreaches = async () => {
        console.log('[BREACH] Starting breach check...');
        setBreachData({
            status: 'checking',
            breachedCount: 0,
            lastCheck: '',
            totalChecked: 0,
            currentProgress: 0,
        });

        try {
            const currentLang = localStorage.getItem('language') || 'en';
            const locale = currentLang === 'tr' ? 'tr-TR' : 'en-US';

            // Use store action
            const count = await scanAllBreaches((current: number, total: number) => {
                setBreachData(prev => ({
                    ...prev,
                    currentProgress: Math.round((current / total) * 100),
                    totalChecked: current,
                }));
            });

            // Get updated IDs from store
            const { breachedEntryIds, entries: currentEntries } = useVaultStore.getState();
            const breachedTitles = breachedEntryIds
                .map(id => currentEntries.find(e => e.id === id)?.title || '')
                .filter(t => t);

            const now = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

            setBreachData({
                status: count > 0 ? 'breached' : 'safe',
                breachedCount: count,
                lastCheck: now,
                totalChecked: currentEntries.filter(e => e.type === 'login' && e.password && e.category !== 'Trash').length,
                currentProgress: 100,
                breachedTitles: breachedTitles.slice(0, 5),
            });

            console.log('[BREACH] Scan complete. Breached:', count);
        } catch (error) {
            console.error('[BREACH] Check failed:', error);
            const currentLang = localStorage.getItem('language') || 'en';
            const locale = currentLang === 'tr' ? 'tr-TR' : 'en-US';
            const now = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            setBreachData({
                status: 'safe',
                breachedCount: 0,
                lastCheck: now,
                totalChecked: 0,
                currentProgress: 100,
            });
        }
    };

    useEffect(() => {
        const currentLang = localStorage.getItem('language') || 'en';
        const locale = currentLang === 'tr' ? 'tr-TR' : 'en-US';

        if (lastBreachScan) {
            const now = new Date(lastBreachScan).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            const breachedTitles = breachedEntryIds
                .map(id => entries.find(e => e.id === id)?.title || '')
                .filter(t => t);

            setBreachData({
                status: breachedEntriesCount > 0 ? 'breached' : 'safe',
                breachedCount: breachedEntriesCount,
                lastCheck: now,
                totalChecked: entries.filter(e => e.type === 'login' && e.password && e.category !== 'Trash').length,
                currentProgress: 100,
                breachedTitles: breachedTitles.slice(0, 5),
            });
        } else {
            const now = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            setBreachData({
                status: 'safe',
                breachedCount: 0,
                lastCheck: now,
                totalChecked: 0,
                currentProgress: 0,
            });
        }
    }, [lastBreachScan, breachedEntriesCount, breachedEntryIds, entries]);

    return (
        <div className="glass-card-hover rounded-3xl p-6 h-full flex flex-col relative overflow-hidden group">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <ShieldAlert className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold">{t('dashboard.breachMonitor')}</h3>
            </div>

            {/* Status Content */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                <AnimatePresence mode="wait">
                    {breachData.status === 'checking' && (
                        <motion.div
                            key="checking"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex flex-col items-center w-full"
                        >
                            <div className="relative mb-4">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-16 h-16 border-4 border-t-purple-500 border-white/10 rounded-full"
                                />
                                <Search className="absolute inset-0 m-auto w-6 h-6 text-purple-400" />
                            </div>
                            <p className="text-white/60 mb-2">{t('breach.scanningInProgress')}</p>
                            <div className="w-full max-w-xs">
                                <div className="flex justify-between text-xs text-white/40 mb-1">
                                    <span>{breachData.totalChecked} / {entries.filter(e => e.type === 'login' && e.password && e.category !== 'Trash').length}</span>
                                    <span>%{breachData.currentProgress}</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${breachData.currentProgress}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {breachData.status === 'safe' && (
                        <motion.div
                            key="safe"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center"
                        >
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                <ShieldCheck className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h4 className="text-xl font-bold text-emerald-400 mb-1">{t('breach.safe')}</h4>
                            <p className="text-white/40 text-sm">
                                {t('breach.noBreachFound')}
                            </p>
                        </motion.div>
                    )}

                    {breachData.status === 'breached' && (
                        <motion.div
                            key="breached"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center w-full"
                        >
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 relative">
                                <AlertTriangle className="w-8 h-8 text-red-400" />
                                <motion.div
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 bg-red-500/30 rounded-full"
                                />
                            </div>
                            <h4 className="text-xl font-bold text-red-400 mb-1">
                                {t('breach.breachFound').replace('{count}', breachData.breachedCount.toString())}
                            </h4>
                            <p className="text-white/40 text-sm mb-3">
                                {t('breach.breachedCount').replace('{count}', breachData.breachedCount.toString())}
                            </p>

                            {breachData.breachedTitles && breachData.breachedTitles.length > 0 && (
                                <div className="text-xs text-white/30 mt-2 w-full max-w-xs">
                                    <p className="font-bold mb-1">{t('breach.breachedAccounts')}</p>
                                    <ul className="text-left space-y-1">
                                        {breachData.breachedTitles.map((title, idx) => (
                                            <li key={idx} className="truncate">• {title}</li>
                                        ))}
                                        {breachData.breachedCount > 5 && (
                                            <li className="text-white/20">{t('breach.moreAccounts').replace('{count}', (breachData.breachedCount - 5).toString())}</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={() => setWatchtowerOpen(true, 'breached')}
                                className="mt-6 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all border border-red-500/20 group-hover:scale-105"
                            >
                                {t('breach.reviewDetails')}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-white/30">{t('breach.lastCheck')}: {breachData.lastCheck}</span>
                <button
                    onClick={checkBreaches}
                    disabled={breachData.status === 'checking'}
                    className={`text-xs font-bold transition-colors uppercase tracking-wider ${breachData.status === 'checking'
                        ? 'text-white/20 cursor-not-allowed'
                        : 'text-indigo-400 hover:text-indigo-300'
                        }`}
                >
                    {breachData.status === 'checking' ? t('breach.scanningInProgress') : t('breach.scanNow')}
                </button>
            </div>
        </div>
    );
};

export default BreachMonitor;
