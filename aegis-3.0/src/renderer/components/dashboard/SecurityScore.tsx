import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';

interface SecurityMetrics {
    score: number;
    weakPasswords: number;
    reusedPasswords: number;
    breachedPasswords: number;
    twoFactorEnabled: number;
}

const SecurityScore: React.FC = () => {
    const { t } = useTranslation();
    const { entries, breachedEntriesCount, setWatchtowerOpen } = useVaultStore();
    const [metrics, setMetrics] = useState<SecurityMetrics>({
        score: 0,
        weakPasswords: 0,
        reusedPasswords: 0,
        breachedPasswords: 0,
        twoFactorEnabled: 0,
    });

    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        // Calculate real metrics
        // Only consider entries that have passwords and are not in trash
        const passwordEntries = entries.filter(e => e.type === 'login' && e.password && e.category !== 'Trash');
        const total = passwordEntries.length;

        if (total === 0) {
            setMetrics({ score: 0, weakPasswords: 0, reusedPasswords: 0, breachedPasswords: 0, twoFactorEnabled: 0 });
            setAnimatedScore(0);
            return;
        }

        const weak = passwordEntries.filter(e => e.strength === 'Weak').length;
        const medium = passwordEntries.filter(e => e.strength === 'Medium').length;
        const strong = passwordEntries.filter(e => e.strength === 'Strong').length;

        // Reused Passwords Calculation
        const passwordCounts = new Map<string, number>();
        passwordEntries.forEach(e => {
            if (e.password) {
                passwordCounts.set(e.password, (passwordCounts.get(e.password) || 0) + 1);
            }
        });
        const reused = passwordEntries.filter(e => e.password && (passwordCounts.get(e.password) || 0) > 1).length;

        // Base score formula (Weighted by strength)
        let calculatedScore = Math.round(((strong * 100) + (medium * 60) + (weak * 20)) / total);

        // Penalize for breaches and reuse (Relative to vault size)
        if (total > 0) {
            // Breach penalty: High impact. If 100% breached, -100 points.
            const breachPenalty = (breachedEntriesCount / total) * 100;
            calculatedScore -= breachPenalty;

            // Reuse penalty: Moderate impact. If 100% reused, -20 points.
            const reusePenalty = (reused / total) * 20;
            calculatedScore -= reusePenalty;
        }

        // If we have very few passwords, penalize slightly but show progress
        if (total < 5) calculatedScore = Math.max(0, calculatedScore - (5 - total) * 5);

        const newMetrics: SecurityMetrics = {
            score: Math.min(100, Math.max(0, Math.round(calculatedScore))),
            weakPasswords: weak,
            reusedPasswords: reused,
            breachedPasswords: breachedEntriesCount,
            twoFactorEnabled: 0, // Mock for now
        };

        setMetrics(newMetrics);

        // Animate score
        let current = 0;
        const target = newMetrics.score;
        const interval = setInterval(() => {
            if (current < target) {
                current += 1;
                setAnimatedScore(current);
            } else if (current > target) {
                current -= 1;
                setAnimatedScore(current);
            } else {
                clearInterval(interval);
            }
        }, 20);

        return () => clearInterval(interval);
    }, [entries, breachedEntriesCount]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-teal-400';
        if (score >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreGradient = (score: number) => {
        if (score >= 80) return ['#2dd4bf', '#22d3ee']; // teal to cyan
        if (score >= 50) return ['#facc15', '#fb923c']; // yellow to orange
        return ['#f87171', '#f472b6']; // red to pink
    };

    const circumference = 2 * Math.PI * 58;
    const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
    const currentColors = getScoreGradient(metrics.score);

    return (
        <div className="glass-card-hover rounded-3xl p-8 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-2xl">
                    <Shield className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold">{t('security.score')}</h3>
                    <p className="text-sm text-white/40">{t('dashboard.vaultHealth')}</p>
                </div>
            </div>

            {/* Score Ring */}
            <div className="flex-1 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" onClick={() => setWatchtowerOpen(true, 'all')}>
                <div className="relative">
                    {/* Background Circle */}
                    <svg className="w-48 h-48 transform -rotate-90">
                        <circle
                            cx="96"
                            cy="96"
                            r="58"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="none"
                            className="text-white/5"
                        />
                        {/* Progress Circle */}
                        <circle
                            cx="96"
                            cy="96"
                            r="58"
                            stroke="url(#scoreGradient)"
                            strokeWidth="12"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-1000 ease-out"
                        />
                        <defs>
                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={currentColors[0]} />
                                <stop offset="100%" stopColor={currentColors[1]} />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Score Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span
                            className={`text-5xl font-bold ${getScoreColor(metrics.score)}`}
                            key={animatedScore}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                        >
                            {animatedScore}
                        </motion.span>
                        <span className="text-white/20 text-sm mt-1">/ 100</span>
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="space-y-3 mt-6">
                <MetricItem
                    icon={<XCircle className="w-4 h-4" />}
                    label={t('security.weakPasswords')}
                    value={metrics.weakPasswords}
                    color={metrics.weakPasswords > 0 ? "text-red-400" : "text-navy-500"}
                    onClick={metrics.weakPasswords > 0 ? () => setWatchtowerOpen(true, 'weak') : undefined}
                />
                <MetricItem
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label={t('security.reusedPasswords')}
                    value={metrics.reusedPasswords}
                    color={metrics.reusedPasswords > 0 ? "text-amber-400" : "text-navy-500"}
                    onClick={metrics.reusedPasswords > 0 ? () => setWatchtowerOpen(true, 'reused') : undefined}
                />
                <MetricItem
                    icon={<XCircle className="w-4 h-4" />}
                    label={t('security.breachedPasswords')}
                    value={metrics.breachedPasswords}
                    color={metrics.breachedPasswords > 0 ? "text-red-500 animate-pulse" : "text-navy-500"}
                    onClick={metrics.breachedPasswords > 0 ? () => setWatchtowerOpen(true, 'breached') : undefined}
                />
                <MetricItem
                    icon={<CheckCircle className="w-4 h-4" />}
                    label={t('dashboard.twoFactorActive')}
                    value={metrics.twoFactorEnabled}
                    color="text-teal-400"
                />
            </div>
        </div>
    );
};

interface MetricItemProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
    onClick?: () => void;
}

const MetricItem: React.FC<MetricItemProps> = ({ icon, label, value, color, onClick }) => (
    <div
        onClick={onClick}
        className={`flex items-center justify-between p-3 rounded-xl transition-colors ${onClick
            ? 'bg-navy-900/50 hover:bg-navy-800 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
            : 'bg-navy-900/30'
            }`}
    >
        <div className="flex items-center gap-2">
            <span className={color}>{icon}</span>
            <span className="text-sm text-white/50">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
);

export default SecurityScore;
