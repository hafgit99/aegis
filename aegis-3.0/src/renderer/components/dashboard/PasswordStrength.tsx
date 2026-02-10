import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';

interface StrengthData {
    label: string;
    count: number;
    percentage: number;
    color: string;
}

const PasswordStrength: React.FC = () => {
    const { t } = useTranslation();
    const { entries } = useVaultStore();

    // Calculate actual distributions
    const total = entries.length;
    const strongArr = entries.filter(e => e.strength === 'Strong');
    const mediumArr = entries.filter(e => e.strength === 'Medium');
    const weakArr = entries.filter(e => e.strength === 'Weak');

    const strengthData: StrengthData[] = [
        {
            label: t('generator.strength.strong'),
            count: strongArr.length,
            percentage: total > 0 ? Math.round((strongArr.length / total) * 100) : 0,
            color: 'bg-teal-500'
        },
        {
            label: t('generator.strength.medium'),
            count: mediumArr.length,
            percentage: total > 0 ? Math.round((mediumArr.length / total) * 100) : 0,
            color: 'bg-yellow-500'
        },
        {
            label: t('generator.strength.weak'),
            count: weakArr.length,
            percentage: total > 0 ? Math.round((weakArr.length / total) * 100) : 0,
            color: 'bg-red-500'
        },
    ];

    return (
        <div className="glass-card-hover rounded-3xl p-6 h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-teal-400" />
                    <h3 className="text-lg font-semibold">{t('dashboard.passwordStrength')}</h3>
                </div>
                <span className="text-sm text-navy-500 font-bold">{total} {t('generator.countUnit')}</span>
            </div>

            {/* Strength Bars */}
            <div className="space-y-4">
                {strengthData.map((item, index) => (
                    <div key={item.label}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className={`text-xs ${item.color.replace('bg-', 'text-')} font-bold`}>
                                {item.count} {t('generator.countUnit')} (%{item.percentage})
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-3 bg-navy-950 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${item.percentage}%` }}
                                transition={{ delay: index * 0.1, duration: 1, ease: 'easeOut' }}
                                className={`h-full ${item.color} rounded-full relative`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                            </motion.div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dynamic Recommendation */}
            <div className={`mt-6 p-4 rounded-xl border ${weakArr.length > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-teal-500/5 border-teal-500/20'}`}>
                {weakArr.length > 0 ? (
                    <p className="text-sm text-red-400 leading-relaxed text-center">
                        ⚠️ <span className="font-bold">{t('generator.weakCount').replace('{count}', weakArr.length.toString())}</span> bulundu.
                        {t('generator.weakWarning')}
                    </p>
                ) : total > 0 ? (
                    <p className="text-sm text-teal-400 leading-relaxed text-center">
                        {t('generator.allSafe')}
                    </p>
                ) : (
                    <p className="text-sm text-navy-500 leading-relaxed text-center">
                        {t('generator.noData')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default PasswordStrength;
