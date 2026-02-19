import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Info,
    Trash2,
    Key,
    Mail,
    User,
    Clock,
    X,
    Plus,
    Lock,
    Monitor,
    Copy,
    CheckCircle2,
    Send
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useVaultStore } from '../../store/vaultStore';

interface EmergencyAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const EmergencyAccessModal: React.FC<EmergencyAccessModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { isLocked } = useVaultStore();
    const [contacts, setContacts] = useState<any[]>([]);
    const [monitoredVaults, setMonitoredVaults] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isAddingMonitored, setIsAddingMonitored] = useState(false);
    const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');
    const [newContact, setNewContact] = useState({ name: '', email: '', waitingPeriod: 604800 });
    const [newMonitored, setNewMonitored] = useState({ name: '', deviceId: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [myDeviceId, setMyDeviceId] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchMyDeviceId();
            if (!isLocked) {
                fetchContacts();
            }
            fetchMonitoredVaults();
        }
    }, [isOpen, isLocked]);

    const fetchMyDeviceId = async () => {
        try {
            const id = await window.aegis.system.getDeviceId();
            setMyDeviceId(id);
        } catch (err) {
            console.error('Failed to fetch device ID:', err);
        }
    };

    const fetchContacts = async () => {
        if (isLocked) return;
        setIsLoading(true);
        try {
            const list = await window.aegis.emergency.list();
            setContacts(list || []);
        } catch (err) {
            console.error('Failed to fetch emergency contacts:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMonitoredVaults = () => {
        const stored = localStorage.getItem('monitored_vaults');
        if (stored) {
            setMonitoredVaults(JSON.parse(stored));
        }
    };

    const handleAdd = async () => {
        if (!newContact.name || !newContact.email) return;
        try {
            const result = await window.aegis.emergency.save(newContact);
            if (result && result.success) {
                setNewContact({ name: '', email: '', waitingPeriod: 604800 });
                setIsAdding(false);
                fetchContacts();
            } else {
                alert(t('errors.databaseError') || 'Kasa kapalı veya bir hata oluştu.');
            }
        } catch (err) {
            console.error('Failed to add contact:', err);
        }
    };

    const handleAddMonitored = () => {
        if (!newMonitored.name || !newMonitored.deviceId) return;
        const updated = [...monitoredVaults, { ...newMonitored, id: Math.random().toString(36).substring(2, 11), status: 'idle' }];
        setMonitoredVaults(updated);
        localStorage.setItem('monitored_vaults', JSON.stringify(updated));
        setNewMonitored({ name: '', deviceId: '' });
        setIsAddingMonitored(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirm') || 'Are you sure?')) return;
        try {
            const result = await window.aegis.emergency.delete(id);
            if (result && result.success) {
                fetchContacts();
            }
        } catch (err) {
            console.error('Failed to delete contact:', err);
        }
    };

    const handleDeleteMonitored = (id: string) => {
        if (!confirm(t('common.confirm') || 'Are you sure?')) return;
        const updated = monitoredVaults.filter(v => v.id !== id);
        setMonitoredVaults(updated);
        localStorage.setItem('monitored_vaults', JSON.stringify(updated));
    };

    const handleRequestAccess = (id: string) => {
        const updated = monitoredVaults.map(v => {
            if (v.id === id) {
                return { ...v, status: 'requested', requestedAt: Date.now() };
            }
            return v;
        });
        setMonitoredVaults(updated);
        localStorage.setItem('monitored_vaults', JSON.stringify(updated));
        
        // P2P Broadcast (Experimental)
        try {
            window.aegis.p2p.broadcast({
                type: 'EMERGENCY_REQUEST',
                targetDeviceId: monitoredVaults.find(v => v.id === id)?.deviceId,
                requestorDeviceId: myDeviceId
            });
        } catch (e) {
            console.warn('P2P Broadcast failed, request stored locally only.');
        }

        alert('Erişim talebi P2P ağı üzerinden gönderildi. Karşı tarafın onay süresine kadar beklemeniz gerekmektedir.');
    };

    const copyDeviceId = () => {
        navigator.clipboard.writeText(myDeviceId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const periods = [
        { value: 7200, label: t('settings.periods.2h') },
        { value: 43200, label: t('settings.periods.12h') },
        { value: 86400, label: t('settings.periods.24h') },
        { value: 172800, label: t('settings.periods.2d') },
        { value: 604800, label: t('settings.periods.7d') },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-navy-900 border border-white/10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                            <ShieldCheck className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">{t('settings.emergencyAccess')}</h2>
                            <p className="text-xs text-white/40">{activeTab === 'outgoing' ? t('settings.emergencyAccessDesc') : (t('settings.emergencyRequestsDesc') || 'Başkasına Ait Kasalar')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-xl text-white/20 hover:text-white transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-none">
                    {/* Tabs */}
                    <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('outgoing')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'outgoing' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            {t('settings.emergencyAccessTitle') || 'Kişilerim'}
                        </button>
                        <button
                            onClick={() => setActiveTab('incoming')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'incoming' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                        >
                            <User className="w-4 h-4" />
                            {t('settings.emergencyRequests') || 'Erişim Taleplerim'}
                        </button>
                    </div>

                    {activeTab === 'outgoing' ? (
                        <>
                            {/* Device ID Card */}
                            <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-indigo-400/60 uppercase tracking-widest px-1">Cihaz Kimliğim (Device ID)</h3>
                                    <button 
                                        onClick={copyDeviceId}
                                        className="flex items-center gap-1.5 text-[9px] font-black text-indigo-400 hover:text-white transition-colors"
                                    >
                                        {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copied ? 'Kopyalandı' : 'Kopyala'}
                                    </button>
                                </div>
                                <div className="p-4 bg-navy-950/50 rounded-2xl border border-white/5 font-mono text-xs text-indigo-300 break-all select-all">
                                    {myDeviceId}
                                </div>
                                <p className="text-[10px] text-white/30 italic px-1">
                                    * Acil durum kişisi olarak atadığınız kişilere bu kimliği vermeniz, onların sizin kasanızı izlemesini sağlar.
                                </p>
                            </div>

                            {/* Info Card */}
                            <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                    <Info className="w-5 h-5 text-indigo-400" />
                                </div>
                                <p className="text-sm text-indigo-300/60 leading-relaxed font-medium">
                                    {t('settings.emergencyAccessInfo')}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-white/20 uppercase tracking-[0.2em]">{t('settings.emergencyAccessTitle')}</h3>
                                {!isAdding && (
                                    <button
                                        onClick={() => setIsAdding(true)}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('settings.addContact')}
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Info Card Recipient */}
                            <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                    <Monitor className="w-5 h-5 text-indigo-400" />
                                </div>
                                <p className="text-sm text-indigo-300/60 leading-relaxed font-medium">
                                    {t('settings.emergencyRecipientInfo')}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-white/20 uppercase tracking-[0.2em]">{t('settings.emergencyRequestsDesc') || 'İzlenen Kasalar'}</h3>
                                {!isAddingMonitored && (
                                    <button
                                        onClick={() => setIsAddingMonitored(true)}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('settings.addMonitoredVault') || 'Kasa İzle'}
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'outgoing' && (
                        <AnimatePresence>
                            {isAdding && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                    className="p-6 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/30 space-y-6"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-indigo-400/60 uppercase font-black px-1 tracking-widest">{t('settings.contactName')}</label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={newContact.name}
                                                    onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                                                    className="w-full bg-navy-950 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                                                    placeholder="..."
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-indigo-400/60 uppercase font-black px-1 tracking-widest">{t('settings.contactEmail')}</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    type="email"
                                                    value={newContact.email}
                                                    onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                                                    className="w-full bg-navy-950 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                                                    placeholder="name@email.com"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] text-indigo-400/60 uppercase font-black px-1 tracking-widest">{t('settings.waitingPeriod')}</label>
                                        <div className="relative group">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                                            <select
                                                value={newContact.waitingPeriod}
                                                onChange={e => setNewContact({ ...newContact, waitingPeriod: parseInt(e.target.value) })}
                                                className="w-full bg-navy-950 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer font-medium"
                                            >
                                                {periods.map(p => (
                                                    <option key={p.value} value={p.value}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-2">
                                        <button
                                            onClick={() => setIsAdding(false)}
                                            className="flex-1 py-3 text-white/40 hover:text-white/60 text-[11px] font-black uppercase tracking-widest transition-all"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            onClick={handleAdd}
                                            className="flex-1 py-3 bg-indigo-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                                        >
                                            {t('common.save')}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}

                    {activeTab === 'incoming' && (
                        <AnimatePresence>
                            {isAddingMonitored && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                    className="p-6 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/30 space-y-6"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-indigo-400/60 uppercase font-black px-1 tracking-widest">Kasa Sahibinin İsmi</label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={newMonitored.name}
                                                    onChange={e => setNewMonitored({ ...newMonitored, name: e.target.value })}
                                                    className="w-full bg-navy-950 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                                                    placeholder="Örn: Ahmet Bey"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-indigo-400/60 uppercase font-black px-1 tracking-widest">Cihaz Kimliği (Device ID)</label>
                                            <div className="relative group">
                                                <Monitor className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={newMonitored.deviceId}
                                                    onChange={e => setNewMonitored({ ...newMonitored, deviceId: e.target.value })}
                                                    className="w-full bg-navy-950 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                                                    placeholder="AEGIS-XXXX-XXXX"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-2">
                                        <button
                                            onClick={() => setIsAddingMonitored(false)}
                                            className="flex-1 py-3 text-white/40 hover:text-white/60 text-[11px] font-black uppercase tracking-widest transition-all"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            onClick={handleAddMonitored}
                                            className="flex-1 py-3 bg-indigo-500 text-white rounded-2xl text-xs font-black shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                                        >
                                            {t('common.save')}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}

                    {/* Contacts List / Monitored List */}
                    <div className="space-y-3">
                        {activeTab === 'outgoing' ? (
                            isLocked ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-12 text-center bg-red-500/5 rounded-[2.5rem] border border-red-500/10 space-y-4"
                                >
                                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-400">
                                        <Lock className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-red-400/80 font-bold">{t('auth.vaultLocked') || 'Vault Locked'}</p>
                                        <p className="text-xs text-white/20 mt-1">{t('settings.emergencyLockedDesc') || 'Acil durum kişilerini yönetmek için lütfen kasanızı açın.'}</p>
                                    </div>
                                </motion.div>
                            ) : isLoading ? (
                                <div className="p-12 flex justify-center">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"
                                    />
                                </div>
                            ) : contacts.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-12 text-center bg-white/[0.02] rounded-[2.5rem] border border-white/5 border-dashed space-y-4"
                                >
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                        <ShieldCheck className="w-8 h-8 text-white/10" />
                                    </div>
                                    <p className="text-sm text-white/20 italic font-medium">{t('settings.noEmergencyContacts')}</p>
                                </motion.div>
                            ) : (
                                contacts.map((contact, index) => (
                                    <motion.div
                                        key={contact.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="p-5 rounded-[2rem] bg-navy-950/50 border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all hover:bg-navy-950"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 group-hover:scale-110 transition-transform shadow-lg shadow-black/20">
                                                <Key className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white tracking-wide">{contact.name}</div>
                                                <div className="text-xs text-white/30 font-medium">{contact.email}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="hidden sm:block text-right">
                                                <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1">{t('settings.waitingPeriod')}</div>
                                                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-white/60 font-black uppercase">
                                                    {periods.find(p => p.value === contact.waitingPeriod)?.label}
                                                </div>
                                            </div>
                                            <div className="text-right min-w-[100px]">
                                                <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1">{t('settings.status')}</div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${contact.status === 'active' && !contact.lastRequestAt ? 'bg-teal-400 animate-pulse' : 'bg-orange-400'}`} />
                                                    <div className={`text-[10px] font-black uppercase tracking-widest ${contact.status === 'active' && !contact.lastRequestAt ? 'text-teal-400' : 'text-orange-400'}`}>
                                                        {contact.lastRequestAt ? t('common.pending') : contact.status}
                                                    </div>
                                                </div>
                                                {contact.lastRequestAt && (
                                                    <div className="text-[9px] text-white/20 mt-1 font-bold">
                                                        {new Date(contact.lastRequestAt * 1000).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDelete(contact.id)}
                                                className="p-3 hover:bg-red-500/10 rounded-2xl text-white/10 hover:text-red-400 transition-all active:scale-90"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )
                        ) : (
                            monitoredVaults.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-12 text-center bg-white/[0.02] rounded-[2.5rem] border border-white/5 border-dashed space-y-4"
                                >
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                        <Monitor className="w-8 h-8 text-white/10" />
                                    </div>
                                    <p className="text-sm text-white/20 italic font-medium">Henüz izlenen bir kasa yok.</p>
                                </motion.div>
                            ) : (
                                monitoredVaults.map((vault, index) => (
                                    <motion.div
                                        key={vault.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="p-5 rounded-[2rem] bg-navy-950/50 border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all hover:bg-navy-950"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 group-hover:scale-110 transition-transform shadow-lg shadow-black/20">
                                                <Monitor className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white tracking-wide">{vault.name}</div>
                                                <div className="text-[9px] text-white/30 font-mono mt-0.5">{vault.deviceId}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right min-w-[120px]">
                                                <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mb-1">Durum</div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${vault.status === 'requested' ? 'bg-orange-400 animate-pulse' : 'bg-teal-400'}`} />
                                                    <div className={`text-[10px] font-black uppercase tracking-widest ${vault.status === 'requested' ? 'text-orange-400' : 'text-teal-400'}`}>
                                                        {vault.status === 'requested' ? 'Erişim Bekleniyor' : 'Bağlı'}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {vault.status !== 'requested' ? (
                                                <button
                                                    onClick={() => handleRequestAccess(vault.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    Erişim İste
                                                </button>
                                            ) : (
                                                <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black text-white/20 uppercase tracking-widest">
                                                    Süre İşliyor...
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleDeleteMonitored(vault.id)}
                                                className="p-3 hover:bg-red-500/10 rounded-2xl text-white/10 hover:text-red-400 transition-all active:scale-90"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="p-6 border-t border-white/5 bg-navy-950/30">
                    <div className="flex items-center gap-3 justify-center opacity-20">
                        <Lock className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">End-to-End Encrypted P2P Protocol</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default EmergencyAccessModal;
