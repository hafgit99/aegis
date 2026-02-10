import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Bolt, Lock, Settings, Shield, Copy, ShieldAlert, Zap } from 'lucide-react';
import PasswordGeneratorModal from './PasswordGeneratorModal';
import SettingsModal from './SettingsModal';
import SharingModal from './SharingModal';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    gradient: string;
    onClick: () => void;
}

const QuickActions: React.FC = () => {
    const { t } = useTranslation();
    const { lock, setWatchtowerOpen, setAddEntryModalOpen } = useVaultStore();
    const [isGenModalOpen, setIsGenModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);

    const handleLockVault = () => {
        if (confirm(t('dashboard.actions.lockConfirm'))) {
            lock();
        }
    };

    const handleGeneratePassword = () => {
        setIsGenModalOpen(true);
    };

    const handleCheckSecurity = () => {
        setWatchtowerOpen(true);
    };

    const handleCopyLastPassword = async () => {
        try {
            const entries = await window.aegis.database.getAll();
            if (entries.length === 0) {
                alert(t('dashboard.actions.noPasswords'));
                return;
            }

            // Get the most recently added entry
            const sortedEntries = entries.sort((a: any, b: any) => b.createdAt - a.createdAt);
            const lastEntry = sortedEntries[0];

            if (lastEntry.password) {
                await window.aegis.clipboard.setSecure(lastEntry.password);
                alert('✅ ' + t('dashboard.actions.copySuccess').replace('{title}', lastEntry.title));
            } else {
                alert(t('dashboard.actions.noPasswordInEntry'));
            }
        } catch (error) {
            console.error('Copy password error:', error);
            alert(t('dashboard.actions.copyFailed'));
        }
    };

    const actions: QuickAction[] = [
        {
            id: 'new-password',
            label: t('dashboard.newPassword'),
            icon: <Plus className="w-5 h-5" />,
            color: 'text-teal-400',
            gradient: 'from-emerald-500/20 to-teal-500/20',
            onClick: () => setAddEntryModalOpen(true),
        },
        {
            id: 'generate',
            label: t('dashboard.generate'),
            icon: <Bolt className="w-5 h-5" />,
            color: 'text-purple-400',
            gradient: 'from-purple-500/20 to-pink-500/20',
            onClick: handleGeneratePassword,
        },
        {
            id: 'lock-vault',
            label: t('dashboard.actions.lockVault'),
            icon: <Lock className="w-5 h-5" />,
            color: 'text-red-400',
            gradient: 'from-red-500/20 to-rose-500/20',
            onClick: handleLockVault,
        },
        {
            id: 'security-check',
            label: t('dashboard.actions.securityCheck'),
            icon: <Shield className="w-5 h-5" />,
            color: 'text-cyan-400',
            gradient: 'from-cyan-500/20 to-blue-500/20',
            onClick: handleCheckSecurity,
        },
        {
            id: 'copy-last',
            label: t('dashboard.actions.copyLast'),
            icon: <Copy className="w-5 h-5" />,
            color: 'text-amber-400',
            gradient: 'from-amber-500/20 to-orange-500/20',
            onClick: handleCopyLastPassword,
        },
        {
            id: 'panic',
            label: 'PANİK MODU',
            icon: <ShieldAlert className="w-5 h-5" />,
            color: 'text-rose-500',
            gradient: 'from-orange-600/20 to-rose-600/20',
            onClick: () => lock(), // Immediate lock without confirm
        },
        {
            id: 'portal-receive',
            label: 'AEGIS PORTAL',
            icon: <Zap className="w-5 h-5" />,
            color: 'text-indigo-400',
            gradient: 'from-indigo-500/20 to-blue-500/20',
            onClick: () => setIsSharingModalOpen(true),
        },
        {
            id: 'settings',
            label: t('dashboard.settings'),
            icon: <Settings className="w-5 h-5" />,
            color: 'text-gray-400',
            gradient: 'from-gray-500/20 to-slate-500/20',
            onClick: () => setIsSettingsModalOpen(true),
        },
    ];

    return (
        <div className="glass-card-hover rounded-3xl p-6 h-full">
            <h3 className="text-lg font-semibold mb-4">{t('dashboard.quickActions')}</h3>

            <div className="grid grid-cols-2 gap-3">
                {actions.map((action, index) => (
                    <motion.button
                        key={action.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={action.onClick}
                        className={`
                            relative overflow-hidden
                            p-4 rounded-2xl
                            bg-gradient-to-br ${action.gradient}
                            border border-white/5
                            hover:border-white/10
                            transition-all duration-300
                            group
                        `}
                    >
                        <div className={`${action.color} mb-2 group-hover:scale-110 transition-transform`}>
                            {action.icon}
                        </div>
                        <span className="text-xs font-medium text-white/80 group-hover:text-white transition-colors">
                            {action.label}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                ))}
            </div>

            <PasswordGeneratorModal
                isOpen={isGenModalOpen}
                onClose={() => setIsGenModalOpen(false)}
            />
            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
            />
            <SharingModal
                isOpen={isSharingModalOpen}
                onClose={() => setIsSharingModalOpen(false)}
            />
        </div>
    );
};

export default QuickActions;
