import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';

export const BreachNotification: React.FC = () => {
    const { t } = useTranslation();
    const { breachedEntriesCount, isLocked } = useVaultStore();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!isLocked && breachedEntriesCount > 0) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [breachedEntriesCount, isLocked]);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="fixed bottom-6 right-6 z-[100] w-96"
            >
                <div className="relative group">
                    {/* Glow effect */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>

                    <div className="relative glass-panel border border-white/10 rounded-2xl p-5 shadow-2xl flex gap-4 overflow-hidden">
                        <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                            <ShieldAlert className="w-6 h-6 text-red-500" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">
                                    {t('breach.criticalAlert')}
                                </h4>
                                <button
                                    onClick={() => setIsVisible(false)}
                                    className="p-1 hover:bg-white/5 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-white/40" />
                                </button>
                            </div>

                            <p className="text-white/90 text-sm font-medium mb-3">
                                {t('breach.foundCount').replace('{count}', breachedEntriesCount.toString())}
                            </p>

                            <button
                                className="flex items-center gap-2 text-xs font-bold text-white/60 hover:text-white transition-colors group/btn"
                                onClick={() => {
                                    // Navigate to breach monitor or open modal
                                    setIsVisible(false);
                                }}
                            >
                                {t('breach.viewDetails')}
                                <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        {/* Background warning pattern */}
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] rotate-12 pointer-events-none">
                            <AlertTriangle className="w-24 h-24 text-white" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
