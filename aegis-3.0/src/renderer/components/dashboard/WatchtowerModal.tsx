import React, { useState, useEffect, useMemo } from 'react';
import {
    ShieldAlert,
    ShieldCheck,
    AlertTriangle,
    Clock,
    Repeat,
    Globe,
    RefreshCw,
    Copy,
    Edit,
    Check
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import Modal from '../ui/Modal';
import { useVaultStore } from '../../store/vaultStore';
import type { VaultEntry } from '../../store/vaultStore';

interface AuditReport {
    score: number;
    weakEntries: string[];
    reusedEntries: { [hash: string]: string[] };
    oldEntries: string[];
    breachedEntries: string[];
    summary: {
        total: number;
        weak: number;
        reused: number;
        old: number;
        breached: number;
    };
}

const WatchtowerModal: React.FC = () => {
    const { t } = useTranslation();
    const { entries, watchtowerOpen, watchtowerCategory, setWatchtowerOpen, setEditingEntry, breachedEntryIds } = useVaultStore();
    const [audit, setAudit] = useState<AuditReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCategoryState, setActiveCategoryState] = useState<'all' | 'weak' | 'reused' | 'old' | 'breached'>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Sync local activeCategory with store's watchtowerCategory when opened
    useEffect(() => {
        if (watchtowerOpen) {
            setActiveCategoryState(watchtowerCategory);
        }
    }, [watchtowerOpen, watchtowerCategory]);

    const activeCategory = activeCategoryState;
    const setActiveCategory = (cat: 'all' | 'weak' | 'reused' | 'old' | 'breached') => {
        setActiveCategoryState(cat);
    };

    const isOpen = watchtowerOpen;
    const onClose = () => setWatchtowerOpen(false);

    const runAudit = async () => {
        setIsLoading(true);
        try {
            const report = await window.aegis.security.audit();
            setAudit(report);
        } catch (error) {
            console.error('Audit failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            runAudit();
        }
    }, [isOpen]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-rose-400';
    };

    // Filter entries based on active category
    const filteredEntries = useMemo(() => {
        if (!audit) return [];

        const entryMap = new Map(entries.map(e => [e.id, e]));
        const problematicIds = new Set<string>();

        if (activeCategory === 'all' || activeCategory === 'weak') {
            audit.weakEntries.forEach(id => problematicIds.add(id));
        }
        if (activeCategory === 'all' || activeCategory === 'reused') {
            Object.values(audit.reusedEntries).flat().forEach(id => problematicIds.add(id));
        }
        if (activeCategory === 'all' || activeCategory === 'old') {
            audit.oldEntries.forEach(id => problematicIds.add(id));
        }
        if (activeCategory === 'all' || activeCategory === 'breached') {
            audit.breachedEntries.forEach(id => problematicIds.add(id));
            breachedEntryIds.forEach(id => problematicIds.add(id));
        }

        return Array.from(problematicIds)
            .map(id => entryMap.get(id))
            .filter((e): e is VaultEntry => e !== undefined);
    }, [audit, entries, activeCategory, breachedEntryIds]);

    const getIssueType = (entryId: string): { type: string; color: string; icon: React.ReactNode } => {
        if (audit?.weakEntries.includes(entryId)) {
            return {
                type: 'weak',
                color: 'text-rose-400',
                icon: <AlertTriangle className="w-4 h-4" />
            };
        }
        if (audit?.breachedEntries.includes(entryId) || breachedEntryIds.includes(entryId)) {
            return {
                type: 'breached',
                color: 'text-purple-400',
                icon: <Globe className="w-4 h-4" />
            };
        }
        if (audit?.oldEntries.includes(entryId)) {
            return {
                type: 'old',
                color: 'text-blue-400',
                icon: <Clock className="w-4 h-4" />
            };
        }
        return {
            type: 'reused',
            color: 'text-amber-400',
            icon: <Repeat className="w-4 h-4" />
        };
    };

    const copyPassword = async (entryId: string, password: string) => {
        try {
            await window.aegis.clipboard.setSecure(password);
            setCopiedId(entryId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error('Copy failed:', error);
        }
    };

    const handleEdit = (entry: VaultEntry) => {
        setEditingEntry(entry);
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Watchtower">
            <div className="space-y-6">
                {/* Score Header */}
                <div className="relative overflow-hidden rounded-3xl bg-navy-800/50 border border-white/5 p-8">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <ShieldAlert className="w-32 h-32" />
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="60"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    className="text-white/5"
                                />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="60"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    strokeDasharray={377}
                                    strokeDashoffset={377 - (377 * (audit?.score || 0)) / 100}
                                    strokeLinecap="round"
                                    className={`${getScoreColor(audit?.score || 0)} transition-all duration-1000`}
                                />
                            </svg>
                            <span className={`absolute text-3xl font-black ${getScoreColor(audit?.score || 0)}`}>
                                {audit?.score || 0}
                            </span>
                        </div>

                        <div className="flex-1 text-center md:text-left space-y-2">
                            <h2 className="text-2xl font-black text-white">
                                {audit?.score && audit.score > 80 ? t('security.excellent') : t('security.fair')}
                            </h2>
                            <p className="text-white/40 text-sm max-w-md">
                                {t('security.watchtowerDesc')}
                            </p>
                        </div>

                        <button
                            onClick={runAudit}
                            className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white transition-all disabled:opacity-50"
                            disabled={isLoading}
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        label={t('security.weakPasswords')}
                        count={audit?.summary.weak || 0}
                        color="rose"
                        isActive={activeCategory === 'weak'}
                        onClick={() => setActiveCategory('weak')}
                    />
                    <StatCard
                        icon={<Repeat className="w-5 h-5" />}
                        label={t('security.reusedPasswords')}
                        count={audit?.summary.reused || 0}
                        color="amber"
                        isActive={activeCategory === 'reused'}
                        onClick={() => setActiveCategory('reused')}
                    />
                    <StatCard
                        icon={<Clock className="w-5 h-5" />}
                        label={t('security.oldPasswords')}
                        count={audit?.summary.old || 0}
                        color="blue"
                        isActive={activeCategory === 'old'}
                        onClick={() => setActiveCategory('old')}
                    />
                    <StatCard
                        icon={<Globe className="w-5 h-5" />}
                        label={t('security.breachedPasswords')}
                        count={new Set([...(audit?.breachedEntries || []), ...breachedEntryIds]).size}
                        color="purple"
                        isActive={activeCategory === 'breached'}
                        onClick={() => setActiveCategory('breached')}
                    />
                </div>

                {/* Problematic Entries List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">
                            {activeCategory === 'all' ? 'Tüm Sorunlu Kayıtlar' :
                                activeCategory === 'weak' ? 'Zayıf Şifreler' :
                                    activeCategory === 'reused' ? 'Yeniden Kullanılan Şifreler' :
                                        activeCategory === 'old' ? 'Eski Şifreler' :
                                            'İhlal Edilmiş Şifreler'}
                        </h3>
                        <span className="text-xs text-white/20 font-medium">
                            {filteredEntries.length} kayıt
                        </span>
                    </div>

                    <div className="bg-navy-800/30 rounded-3xl border border-white/5 p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-4 py-12">
                                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                                <p className="text-white/40 text-sm">{t('breach.scanningInProgress')}</p>
                            </div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="flex flex-col items-center gap-4 py-12 text-center">
                                <div className="p-4 bg-emerald-500/10 rounded-full">
                                    <ShieldCheck className="w-12 h-12 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold">{t('security.noIssuesFound')}</h4>
                                    <p className="text-white/40 text-sm">Bu kategoride sorun bulunamadı.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredEntries.map((entry) => {
                                    const issue = getIssueType(entry.id);
                                    const isCopied = copiedId === entry.id;
                                    return (
                                        <div
                                            key={entry.id}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/[0.08] transition-all group"
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* Icon */}
                                                <div className={`p-2 rounded-xl ${issue.color} bg-opacity-10`}>
                                                    {issue.icon}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-white font-bold truncate">{entry.title}</h4>
                                                        {entry.username && (
                                                            <span className="text-white/40 text-sm truncate">
                                                                ({entry.username})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <span className={`px-2 py-1 rounded-lg ${issue.color} bg-opacity-10 font-bold uppercase`}>
                                                            {issue.type === 'weak' ? 'Zayıf' :
                                                                issue.type === 'breached' ? 'İhlal' :
                                                                    issue.type === 'old' ? 'Eski' :
                                                                        'Yeniden Kullanılmış'}
                                                        </span>
                                                        {entry.password && (
                                                            <span className="px-2 py-1 rounded-lg bg-white/5 text-white/40">
                                                                {entry.password.length} karakter
                                                            </span>
                                                        )}
                                                        {entry.strength && (
                                                            <span className={`px-2 py-1 rounded-lg ${entry.strength === 'Strong' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                entry.strength === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                                                                    'bg-rose-500/20 text-rose-400'
                                                                }`}>
                                                                {entry.strength === 'Strong' ? 'Güçlü' :
                                                                    entry.strength === 'Medium' ? 'Orta' :
                                                                        'Zayıf'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => entry.password && copyPassword(entry.id, entry.password)}
                                                        className={`p-2 rounded-xl transition-all ${isCopied
                                                            ? 'bg-emerald-500/20 text-emerald-400'
                                                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                                            }`}
                                                        title={isCopied ? 'Kopyalandı!' : 'Şifreyi kopyala'}
                                                    >
                                                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(entry)}
                                                        className="p-2 bg-white/5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-all"
                                                        title="Düzenle"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: 'rose' | 'amber' | 'blue' | 'purple';
    isActive: boolean;
    onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, count, color, isActive, onClick }) => {
    const colors = {
        rose: 'from-rose-500/10 to-transparent border-rose-500/20 text-rose-400',
        amber: 'from-amber-500/10 to-transparent border-amber-500/20 text-amber-400',
        blue: 'from-blue-500/10 to-transparent border-blue-500/20 text-blue-400',
        purple: 'from-purple-500/10 to-transparent border-purple-500/20 text-purple-400'
    };

    return (
        <button
            onClick={onClick}
            className={`
                relative p-4 rounded-2xl border bg-gradient-to-br ${colors[color]}
                text-left transition-all hover:scale-[1.02] active:scale-[0.98]
                ${isActive ? 'ring-2 ring-white/10 border-opacity-100' : 'border-opacity-30'}
            `}
        >
            <div className="mb-3">{icon}</div>
            <div className="text-2xl font-black mb-1">{count}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                {label}
            </div>
        </button>
    );
};

export default WatchtowerModal;
