import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../i18n/useTranslation';
import SecurityScore from './SecurityScore';
import QuickActions from './QuickActions';
import RecentPasswords from './RecentPasswords';
import PasswordStrength from './PasswordStrength';
import BreachMonitor from './BreachMonitor';
import SyncStatus from './SyncStatus';
import { useVaultStore } from '../../store/vaultStore';
import { Crown, Timer, Info } from 'lucide-react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            ease: [0.23, 1, 0.32, 1],
        },
    },
};

const BentoGrid: React.FC = () => {
    const { t } = useTranslation();
    const { licenseStatus, checkLicense } = useVaultStore();
    const [deviceId, setDeviceId] = React.useState<string>('');

    React.useEffect(() => {
        const fetchId = async () => {
            const id = await window.aegis.system.getDeviceId();
            setDeviceId(id);
        };
        fetchId();
        checkLicense();
    }, [checkLicense]);

    return (
        <div className="relative z-10 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-center md:text-left"
                >
                    <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
                        <span className="gradient-text">Aegis Vault</span>
                        <span className="opacity-40 ml-4 text-3xl font-light">v3.0.0</span>
                    </h1>
                    <p className="opacity-60 text-xl max-w-2xl">
                        {t('dashboard.subtitle')}
                    </p>

                    {/* Device ID Display on Dashboard */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-6 flex flex-wrap items-center gap-3 justify-center md:justify-start"
                    >
                        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl group hover:border-teal-500/30 transition-all shadow-lg shadow-black/20">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{t('common.deviceId')}</div>
                            </div>
                            <div className="font-mono text-sm text-teal-400 font-bold tracking-widest">{deviceId || '...'}</div>
                            <button
                                onClick={async () => {
                                    await window.aegis.clipboard.setSecure(deviceId);
                                    alert(t('common.copySuccess'));
                                }}
                                className="p-1.5 hover:bg-teal-500/10 rounded-lg text-teal-400/40 hover:text-teal-400 transition-colors"
                                title={t('common.copy')}
                            >
                                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                            </button>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Premium / Trial Status Widget */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-col gap-3 min-w-[300px]"
                >
                    {licenseStatus?.isPremium ? (
                        <div className="p-4 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/30 backdrop-blur-xl flex items-center gap-4 shadow-xl shadow-indigo-500/10">
                            <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/40">
                                <Crown className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">{t('premium.statusBanner.premium')}</div>
                                <div className="text-sm font-black text-white">{t('premium.statusBanner.lifetime')}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-[2rem] bg-orange-500/10 border border-orange-500/30 backdrop-blur-xl space-y-3 shadow-xl shadow-orange-500/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/40">
                                        <Timer className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest">{t('premium.trialPeriod')}</div>
                                        <div className="text-xs font-black text-white">
                                            {t('premium.trialDaysRemaining').replace('{days}', String(licenseStatus?.trialDaysLeft))}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        // We can trigger the settings modal here if we had a way to open it, 
                                        // or just let the user know it's in settings.
                                        alert(t('premium.trialDescription'));
                                    }}
                                    className="p-2 hover:bg-orange-500/20 rounded-xl text-orange-400 transition-colors"
                                >
                                    <Info className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="h-1.5 bg-navy-900/50 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(licenseStatus?.trialDaysLeft || 0) / 3 * 100}%` }}
                                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                />
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Grid Layout */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-12 gap-6"
            >
                {/* Security Score (Large) */}
                <motion.div
                    variants={itemVariants}
                    className="col-span-12 lg:col-span-7 xl:col-span-8 group"
                >
                    <SecurityScore />
                </motion.div>

                {/* Quick Actions (Compact) */}
                <motion.div
                    variants={itemVariants}
                    className="col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4"
                >
                    <QuickActions />
                </motion.div>

                {/* Recent Passwords */}
                <motion.div
                    variants={itemVariants}
                    className="col-span-12 md:col-span-6 lg:col-span-5"
                >
                    <RecentPasswords />
                </motion.div>

                {/* Password Strength Analysis */}
                <motion.div
                    variants={itemVariants}
                    className="col-span-12 lg:col-span-7"
                >
                    <PasswordStrength />
                </motion.div>

                {/* Breach Monitor */}
                <motion.div
                    variants={itemVariants}
                    className="col-span-12 md:col-span-6 lg:col-span-5"
                >
                    <BreachMonitor />
                </motion.div>

                {/* Sync Status */}
                <motion.div
                    variants={itemVariants}
                    className="col-span-12 md:col-span-6 lg:col-span-7"
                >
                    <SyncStatus />
                </motion.div>
            </motion.div>
        </div>
    );
};

export default BentoGrid;
