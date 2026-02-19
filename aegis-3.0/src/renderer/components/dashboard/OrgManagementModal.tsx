import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { useVaultStore } from '../../store/vaultStore';
import {
    Users,
    UserPlus,
    Shield,
    FolderPlus,
    Activity,
    Plus,
    X,
    Trash2,
    ChevronRight,
    LayoutDashboard,
    Globe,
    Lock,
    Search,
    Eye,
    EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OrgManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const OrgManagementModal: React.FC<OrgManagementModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { entries } = useVaultStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'members' | 'collections' | 'policies' | 'sso'>('overview');
    const [orgs, setOrgs] = useState<any[]>([]);
    const [currentOrg, setCurrentOrg] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateOrg, setShowCreateOrg] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    
    // Inline creation states
    const [showAddTeam, setShowAddTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [showInviteMember, setShowInviteMember] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showAddCollection, setShowAddCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [showEntryPicker, setShowEntryPicker] = useState(false);
    const [showTeamMemberPicker, setShowTeamMemberPicker] = useState(false);
    const [entrySearchTerm, setEntrySearchTerm] = useState('');
    const [ssoConfig, setSsoConfig] = useState({ provider: 'Okta (OIDC)', domain: '', metadata: '' });
    const [visibleEntries, setVisibleEntries] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            fetchOrgs();
        }
    }, [isOpen]);

    const fetchOrgs = async () => {
        setIsLoading(true);
        try {
            const data = await (window.aegis as any).organization.getAll();
            console.log('[ORG] Fetched organizations:', data);
            setOrgs(data);
            if (data.length > 0) {
                if (!currentOrg) {
                    setCurrentOrg(data[0]);
                    setSsoConfig({
                        provider: data[0].ssoProvider || 'Okta (OIDC)',
                        domain: data[0].ssoDomain || '',
                        metadata: data[0].ssoMetadata || ''
                    });
                } else {
                    const freshOrg = data.find((o: any) => o.id === currentOrg.id);
                    if (freshOrg) {
                        console.log('[ORG] Refreshing current organization:', freshOrg.name, 'Teams:', freshOrg.teams?.length);
                        setCurrentOrg(freshOrg);
                        setSsoConfig({
                            provider: freshOrg.ssoProvider || 'Okta (OIDC)',
                            domain: freshOrg.ssoDomain || '',
                            metadata: freshOrg.ssoMetadata || ''
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch orgs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateOrg = async () => {
        if (!newOrgName) return;
        setIsLoading(true);
        try {
            const newOrg = await (window.aegis as any).organization.create(newOrgName, '');
            setOrgs([...orgs, newOrg]);
            setCurrentOrg(newOrg);
            setShowCreateOrg(false);
            setNewOrgName('');
        } catch (err) {
            console.error('Failed to create org:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteOrg = async (id: string) => {
        if (confirm(t('organization.deleteConfirm'))) {
            await (window.aegis as any).organization.delete(id);
            const remaining = orgs.filter(o => o.id !== id);
            setOrgs(remaining);
            setCurrentOrg(remaining[0] || null);
        }
    };

    const handleUpdateOrg = async (updatedOrg: any) => {
        try {
            await (window.aegis as any).organization.update(updatedOrg);
            setOrgs(orgs.map(o => o.id === updatedOrg.id ? updatedOrg : o));
            setCurrentOrg(updatedOrg);
        } catch (err) {
            console.error('Failed to update org:', err);
        }
    };

    const handleAddTeam = async () => {
        if (!newTeamName || !currentOrg) return;
        try {
            setIsLoading(true);
            await (window.aegis as any).organization.addTeam(currentOrg.id, newTeamName, '');
            await fetchOrgs();
            setShowAddTeam(false);
            setNewTeamName('');
        } catch (err) {
            console.error('Failed to add team:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddMemberToTeam = async (memberId: string) => {
        if (!currentOrg || !selectedTeamId) return;
        try {
            setIsLoading(true);
            const updatedOrg = { ...currentOrg };
            const team = updatedOrg.teams.find((t: any) => t.id === selectedTeamId);
            if (team) {
                if (!team.memberIds) team.memberIds = [];
                if (!team.memberIds.includes(memberId)) {
                    team.memberIds.push(memberId);
                    await (window.aegis as any).organization.update(updatedOrg);
                    await fetchOrgs();
                }
            }
            setShowTeamMemberPicker(false);
        } catch (err) {
            console.error('Failed to add member to team:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveMemberFromTeam = async (memberId: string) => {
        if (!currentOrg || !selectedTeamId) return;
        try {
            setIsLoading(true);
            const updatedOrg = { ...currentOrg };
            const team = updatedOrg.teams.find((t: any) => t.id === selectedTeamId);
            if (team && team.memberIds) {
                team.memberIds = team.memberIds.filter((id: string) => id !== memberId);
                await (window.aegis as any).organization.update(updatedOrg);
                await fetchOrgs();
            }
        } catch (err) {
            console.error('Failed to remove member from team:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInviteMember = async () => {
        if (!inviteEmail || !currentOrg) return;
        try {
            setIsLoading(true);
            await (window.aegis as any).organization.inviteMember(currentOrg.id, inviteEmail, 'member');
            await fetchOrgs();
            setShowInviteMember(false);
            setInviteEmail('');
        } catch (err) {
            console.error('Failed to invite member:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddCollection = async () => {
        if (!newCollectionName || !currentOrg) return;
        try {
            setIsLoading(true);
            await (window.aegis as any).organization.addCollection(currentOrg.id, newCollectionName);
            await fetchOrgs();
            setShowAddCollection(false);
            setNewCollectionName('');
        } catch (err) {
            console.error('Failed to add collection:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSSO = () => {
        if (!currentOrg) return;
        handleUpdateOrg({
            ...currentOrg,
            ssoEnabled: !currentOrg.ssoEnabled
        });
    };

    const handleSaveSSO = async () => {
        if (!currentOrg) return;
        try {
            setIsLoading(true);
            await (window.aegis as any).organization.update({
                ...currentOrg,
                ssoProvider: ssoConfig.provider,
                ssoDomain: ssoConfig.domain,
                ssoMetadata: ssoConfig.metadata
            });
            await fetchOrgs();
        } catch (err) {
            console.error('Failed to save SSO config:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
        if (!currentOrg) return;
        try {
            setIsLoading(true);
            await (window.aegis as any).organization.updateMemberRole(currentOrg.id, memberId, newRole);
            await fetchOrgs();
        } catch (err) {
            console.error('Failed to update member role:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteMember = async (memberId: string) => {
        if (!currentOrg) return;
        if (!confirm(t('vault.confirmDelete'))) return;
        try {
            setIsLoading(true);
            await (window.aegis as any).organization.removeMember(currentOrg.id, memberId);
            await fetchOrgs();
        } catch (err) {
            console.error('Failed to delete member:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddEntryToCollection = async (entryId: string) => {
        if (!currentOrg || !selectedCollectionId) return;
        try {
            setIsLoading(true);
            
            // Resilience: Use org.update if the specific collection-add method is missing or as a primary method
            const updatedOrg = { ...currentOrg };
            const collection = updatedOrg.sharedCollections.find((c: any) => c.id === selectedCollectionId);
            
            if (collection) {
                if (!collection.entryIds) collection.entryIds = [];
                if (!collection.entryIds.includes(entryId)) {
                    collection.entryIds.push(entryId);
                    await (window.aegis as any).organization.update(updatedOrg);
                    await fetchOrgs();
                }
            }
            setShowEntryPicker(false);
        } catch (err) {
            console.error('Failed to add entry to collection:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveEntryFromCollection = async (entryId: string) => {
        if (!currentOrg || !selectedCollectionId) return;
        try {
            console.log('[COLLECTION] Removing entry:', entryId, 'from:', selectedCollectionId);
            setIsLoading(true);

            // Resilience: Use org.update to ensure it works even if preload hasn't refreshed
            const updatedOrg = { ...currentOrg };
            const collection = updatedOrg.sharedCollections.find((c: any) => c.id === selectedCollectionId);
            
            if (collection && collection.entryIds) {
                collection.entryIds = collection.entryIds.filter((id: string) => id !== entryId);
                await (window.aegis as any).organization.update(updatedOrg);
                await fetchOrgs();
            }
        } catch (err) {
            console.error('Failed to remove entry from collection:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleEntryVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(visibleEntries);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setVisibleEntries(next);
    };

    const policies = [
        { id: '2fa', title: t('organization.policyList.twoFaTitle'), desc: t('organization.policyList.twoFaDesc'), enabled: currentOrg?.securityPolicies?.['2fa'] ?? true },
        { id: 'complexity', title: t('organization.policyList.complexityTitle'), desc: t('organization.policyList.complexityDesc'), enabled: currentOrg?.securityPolicies?.['complexity'] ?? true },
        { id: 'biometric', title: t('organization.policyList.biometricTitle'), desc: t('organization.policyList.biometricDesc'), enabled: currentOrg?.securityPolicies?.['biometric'] ?? false },
        { id: 'auto-revoke', title: t('organization.policyList.autoRevokeTitle'), desc: t('organization.policyList.autoRevokeDesc'), enabled: currentOrg?.securityPolicies?.['auto-revoke'] ?? true }
    ];

    const healthScore = Math.round((policies.filter(p => p.enabled).length / policies.length) * 100);

    const togglePolicy = (id: string) => {
        if (!currentOrg) return;
        const updatedOrg = {
            ...currentOrg,
            securityPolicies: {
                ...(currentOrg.securityPolicies || {
                    '2fa': true,
                    'complexity': true,
                    'biometric': false,
                    'auto-revoke': true
                }),
                [id]: !policies.find(p => p.id === id)?.enabled
            }
        };
        handleUpdateOrg(updatedOrg);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('organization.title')}>
            <div className="flex flex-col h-[70vh]">
                {!currentOrg && !showCreateOrg ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                        <div className="w-24 h-24 bg-indigo-500/10 rounded-[40px] flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                            <Users size={48} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">{t('organization.title')}</h3>
                            <p className="text-sm text-white/30 max-w-sm mx-auto">
                                {t('organization.empty')}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateOrg(true)}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                        >
                            <Plus size={20} />
                            {t('organization.createOrg')}
                        </button>
                    </div>
                ) : showCreateOrg ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6">
                        <div className="w-full max-w-md space-y-4">
                            <h3 className="text-xl font-bold text-white text-center">{t('organization.createOrg')}</h3>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">
                                    {t('organization.orgName')}
                                </label>
                                <input
                                    type="text"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    placeholder="Company Name..."
                                    className="w-full bg-navy-900 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setShowCreateOrg(false)}
                                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-2xl transition-all"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleCreateOrg}
                                    disabled={!newOrgName || isLoading}
                                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/30"
                                >
                                    {isLoading ? t('common.loading') : t('common.create')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 overflow-hidden">
                        {/* Sidebar */}
                        <div className="w-64 border-r border-white/5 flex flex-col gap-1 p-4">
                            <div className="mb-6 px-2">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">{t('organization.title')}</h4>
                                    <button
                                        onClick={() => setShowCreateOrg(true)}
                                        className="p-1 hover:bg-white/5 rounded-md text-indigo-400"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <select
                                    value={currentOrg?.id}
                                    onChange={(e) => setCurrentOrg(orgs.find(o => o.id === e.target.value))}
                                    className="w-full bg-navy-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/30"
                                >
                                    {orgs.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                                <div className="mt-3 flex items-center justify-between px-1">
                                    <div 
                                        onClick={() => (window.aegis as any).clipboard.setSecure(currentOrg?.id)}
                                        className="flex flex-col cursor-pointer group/id"
                                    >
                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest group-hover/id:text-indigo-400 transition-colors">Org ID (Click to copy)</span>
                                        <code className="text-[10px] text-white/30 font-mono group-hover/id:text-indigo-400 transition-colors truncate max-w-[180px]">
                                            {currentOrg?.id}
                                        </code>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                            >
                                <LayoutDashboard size={18} />
                                {t('organization.dashboard.title')}
                            </button>
                            <button
                                onClick={() => setActiveTab('teams')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'teams' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                            >
                                <Users size={18} />
                                {t('organization.teams')}
                            </button>
                            <button
                                onClick={() => setActiveTab('members')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'members' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                            >
                                <UserPlus size={18} />
                                {t('organization.members')}
                            </button>
                            <button
                                onClick={() => setActiveTab('collections')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'collections' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                            >
                                <FolderPlus size={18} />
                                {t('organization.collections')}
                            </button>
                            <button
                                onClick={() => setActiveTab('policies')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'policies' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                            >
                                <Shield size={18} />
                                {t('organization.dashboard.policies')}
                            </button>
                            <button
                                onClick={() => { setActiveTab('sso'); setShowAddTeam(false); setShowInviteMember(false); setShowAddCollection(false); }}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'sso' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                            >
                                <Globe size={18} />
                                {t('organization.sso.title')}
                            </button>

                            <div className="mt-auto p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                                <button
                                    onClick={() => handleDeleteOrg(currentOrg.id)}
                                    className="w-full flex items-center gap-2 text-[10px] font-black uppercase text-rose-500 hover:text-rose-400 transition-colors"
                                >
                                    <Trash2 size={14} />
                                    {t('organization.deleteOrg')}
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 overflow-x-hidden">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-6"
                                >
                                    {activeTab === 'overview' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="p-6 bg-navy-900/50 rounded-3xl border border-white/5 space-y-2">
                                                    <h5 className="text-[10px] font-black text-white/30 uppercase tracking-widest">{t('organization.members')}</h5>
                                                    <p className="text-3xl font-black text-white">{currentOrg.members?.length || 0}</p>
                                                </div>
                                                <div className="p-6 bg-navy-900/50 rounded-3xl border border-white/5 space-y-2">
                                                    <h5 className="text-[10px] font-black text-white/30 uppercase tracking-widest">{t('organization.teams')}</h5>
                                                    <p className="text-3xl font-black text-white">{currentOrg.teams?.length || 0}</p>
                                                </div>
                                                <div className="p-6 bg-navy-900/50 rounded-3xl border border-white/5 space-y-2">
                                                    <h5 className="text-[10px] font-black text-white/30 uppercase tracking-widest">{t('organization.collections')}</h5>
                                                    <p className="text-3xl font-black text-white">{currentOrg.sharedCollections?.length || 0}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="p-8 bg-indigo-600/5 rounded-3xl border border-indigo-600/10 flex flex-col gap-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                                            <Activity size={24} />
                                                        </div>
                                                        <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-full border border-emerald-500/20">
                                                            {t('organization.dashboard.secure')}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest">{t('organization.dashboard.environmentStatus')}</h4>
                                                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{t('organization.dashboard.locked')}</p>
                                                    </div>
                                                </div>

                                                <div className="p-8 bg-white/5 rounded-3xl border border-white/5 flex flex-col gap-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white/40">
                                                            <Shield size={24} />
                                                        </div>
                                                        <div className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase rounded-full border border-indigo-500/20">
                                                            ENTERPRISE
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest">{t('organization.dashboard.compliance')}</h4>
                                                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{healthScore}% {t('organization.dashboard.healthScore')}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-navy-900/50 rounded-3xl border border-white/5">
                                                <h5 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">{t('organization.dashboard.insights')}</h5>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="text-white/40 font-bold uppercase">{t('organization.dashboard.ssoStatus')}</span>
                                                        <span className={currentOrg.ssoEnabled ? "text-emerald-400 font-black" : "text-rose-500 font-black"}>{currentOrg.ssoEnabled ? t('organization.sso.active') : t('organization.sso.inactive')}</span>
                                                    </div>
                                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${healthScore}%` }}
                                                            className="h-full bg-indigo-600" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'teams' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-lg font-bold text-white">{t('organization.teams')}</h3>
                                                <button 
                                                    onClick={() => setShowAddTeam(!showAddTeam)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    {showAddTeam ? <Trash2 size={16} /> : <Plus size={16} />}
                                                    {showAddTeam ? t('common.cancel') : t('organization.actions.createTeam')}
                                                </button>
                                            </div>

                                            {showAddTeam && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-4 bg-navy-900 border border-indigo-500/30 rounded-2xl flex gap-2"
                                                >
                                                    <input 
                                                        type="text"
                                                        value={newTeamName}
                                                        onChange={(e) => setNewTeamName(e.target.value)}
                                                        placeholder={t('organization.orgName')}
                                                        className="flex-1 bg-navy-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500/30"
                                                        autoFocus
                                                    />
                                                    <button 
                                                        onClick={handleAddTeam}
                                                        disabled={!newTeamName || isLoading}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                                                    >
                                                        {t('common.add')}
                                                    </button>
                                                </motion.div>
                                            )}

                                            <div className="space-y-3">
                                                {(!currentOrg.teams || currentOrg.teams.length === 0) ? (
                                                    <div className="py-12 text-center bg-navy-900/20 rounded-3xl border border-white/5 border-dashed">
                                                        <Users size={32} className="mx-auto text-white/10 mb-2" />
                                                        <p className="text-xs text-white/30">{t('organization.noTeams')}</p>
                                                    </div>
                                                ) : selectedTeamId ? (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between p-2">
                                                            <button 
                                                                onClick={() => setSelectedTeamId(null)}
                                                                className="flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors"
                                                            >
                                                                <ChevronRight size={16} className="rotate-180" />
                                                                {t('common.back')}
                                                            </button>
                                                            <h4 className="text-sm font-bold text-white uppercase tracking-widest">
                                                                {currentOrg.teams.find((t: any) => t.id === selectedTeamId)?.name}
                                                            </h4>
                                                            <button 
                                                                onClick={() => setShowTeamMemberPicker(!showTeamMemberPicker)}
                                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all"
                                                            >
                                                                <UserPlus size={16} />
                                                                {t('common.add')}
                                                            </button>
                                                        </div>

                                                        {showTeamMemberPicker && (
                                                            <div className="p-4 bg-navy-900 border border-indigo-500/30 rounded-2xl max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                                                                {currentOrg.members
                                                                    ?.filter((m: any) => !currentOrg.teams.find((t: any) => t.id === selectedTeamId)?.memberIds?.includes(m.id))
                                                                    .map((member: any) => (
                                                                        <div 
                                                                            key={member.id}
                                                                            onClick={() => handleAddMemberToTeam(member.id)}
                                                                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-between cursor-pointer group"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                                                                                    {member.email?.[0].toUpperCase() || '?'}
                                                                                </div>
                                                                                <span className="text-xs text-white/60 group-hover:text-white transition-colors">{member.email}</span>
                                                                            </div>
                                                                            <Plus size={14} className="text-white/10 group-hover:text-indigo-400" />
                                                                        </div>
                                                                    ))}
                                                                {(!currentOrg.members || currentOrg.members.length === 0) && (
                                                                    <p className="text-[10px] text-white/20 text-center py-4 uppercase font-black">{t('organization.noMembers')}</p>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-1 gap-2">
                                                            {currentOrg.teams.find((t: any) => t.id === selectedTeamId)?.memberIds?.map((memberId: string) => {
                                                                const member = currentOrg.members.find((m: any) => m.id === memberId);
                                                                return (
                                                                    <div key={memberId} className="p-4 bg-navy-900/50 rounded-2xl border border-white/5 flex items-center justify-between group">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-indigo-400">
                                                                                <Users size={18} />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-bold text-white">{member?.email || 'Unknown Member'}</p>
                                                                                <p className="text-[10px] text-white/30 uppercase tracking-widest">{member?.role || 'member'}</p>
                                                                            </div>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => handleRemoveMemberFromTeam(memberId)}
                                                                            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 rounded-xl text-white/20 hover:text-rose-500 transition-all"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                            {(!currentOrg.teams.find((t: any) => t.id === selectedTeamId)?.memberIds || currentOrg.teams.find((t: any) => t.id === selectedTeamId)?.memberIds.length === 0) && (
                                                                <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/5">
                                                                    <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">{t('organization.noMembers')}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    currentOrg.teams.map((team: any) => (
                                                        <div 
                                                            key={team.id} 
                                                            onClick={() => setSelectedTeamId(team.id)}
                                                            className="p-4 bg-navy-900/50 rounded-2xl border border-white/5 flex items-center justify-between group transition-all cursor-pointer hover:border-indigo-500/30"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                                                                    <Users size={18} />
                                                                </div>
                                                                <div>
                                                                    <h5 className="text-sm font-bold text-white">{team.name}</h5>
                                                                    <p className="text-[10px] text-white/30 uppercase tracking-widest">{team.memberIds?.length || 0} {t('organization.teamMembers')}</p>
                                                                </div>
                                                            </div>
                                                            <button 
                                                                className="p-2 hover:bg-white/5 rounded-lg text-white/30 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <ChevronRight size={18} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'members' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-lg font-bold text-white">{t('organization.members')}</h3>
                                                <button 
                                                    onClick={() => setShowInviteMember(!showInviteMember)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    {showInviteMember ? <X size={16} /> : <UserPlus size={16} />}
                                                    {showInviteMember ? t('common.cancel') : t('organization.actions.invite')}
                                                </button>
                                            </div>

                                            {showInviteMember && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-4 bg-navy-900 border border-indigo-500/30 rounded-2xl flex gap-2"
                                                >
                                                    <input 
                                                        id="invite-email-input"
                                                        type="text"
                                                        value={inviteEmail}
                                                        onChange={(e) => setInviteEmail(e.target.value)}
                                                        placeholder={t('common.email')}
                                                        className="flex-1 bg-navy-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500/30 relative z-10"
                                                        autoComplete="off"
                                                    />
                                                    <button 
                                                        onClick={handleInviteMember}
                                                        disabled={!inviteEmail || isLoading}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                                                    >
                                                        {t('common.add')}
                                                    </button>
                                                </motion.div>
                                            )}

                                            <p className="text-[10px] text-white/20 italic px-2">
                                                {t('organization.inviteInfo')}
                                            </p>

                                            <div className="space-y-2">
                                                {currentOrg.members?.map((member: any) => (
                                                    <div key={member.id} className="p-4 bg-navy-900/50 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400 border border-white/5">
                                                                <div className="text-lg font-black">{member.role === 'owner' ? '👑' : (member.role === 'admin' ? '🛡️' : (member.role === 'manager' ? '💼' : '👤'))}</div>
                                                            </div>
                                                            <div>
                                                                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                                                                    {member.email || 'Admin User'}
                                                                    {member.id === 'current-user-id' && (
                                                                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase rounded-full border border-indigo-500/20">YOU</span>
                                                                    )}
                                                                </h5>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{t(`organization.roles.${member.role as 'owner' | 'admin' | 'manager' | 'member'}`)}</p>
                                                                    <span className="w-1 h-1 bg-white/20 rounded-full" />
                                                                    <p className="text-[9px] text-white/30 uppercase font-bold leading-none">Joined {new Date(member.joinedAt).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <select 
                                                                className="bg-navy-950 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] font-black text-white/60 outline-none focus:border-indigo-500/30 opacity-0 group-hover:opacity-100 transition-all cursor-pointer uppercase"
                                                                value={member.role}
                                                                onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                                            >
                                                                <option value="owner">{t('organization.roles.owner')}</option>
                                                                <option value="admin">{t('organization.roles.admin')}</option>
                                                                <option value="manager">{t('organization.roles.manager')}</option>
                                                                <option value="member">{t('organization.roles.member')}</option>
                                                            </select>
                                                            <button 
                                                                onClick={() => handleDeleteMember(member.id)}
                                                                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 rounded-xl text-white/20 hover:text-rose-500 transition-all"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'collections' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-lg font-bold text-white">{t('organization.collections')}</h3>
                                                <button 
                                                    onClick={() => setShowAddCollection(!showAddCollection)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all"
                                                >
                                                    {showAddCollection ? <Trash2 size={16} /> : <FolderPlus size={16} />}
                                                    {showAddCollection ? t('common.cancel') : t('organization.actions.addCollection')}
                                                </button>
                                            </div>

                                            {showAddCollection && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-4 bg-navy-900 border border-indigo-500/30 rounded-2xl flex gap-2"
                                                >
                                                    <input 
                                                        type="text"
                                                        value={newCollectionName}
                                                        onChange={(e) => setNewCollectionName(e.target.value)}
                                                        placeholder={t('organization.collections')}
                                                        className="flex-1 bg-navy-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500/30"
                                                        autoFocus
                                                    />
                                                    <button 
                                                        onClick={handleAddCollection}
                                                        disabled={!newCollectionName || isLoading}
                                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                                                    >
                                                        {t('common.add')}
                                                    </button>
                                                </motion.div>
                                            )}

                                            {selectedCollectionId ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between p-2">
                                                        <button 
                                                            onClick={() => setSelectedCollectionId(null)}
                                                            className="flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors"
                                                        >
                                                            <ChevronRight size={16} className="rotate-180" />
                                                            {t('common.back')}
                                                        </button>
                                                        <h4 className="text-sm font-bold text-white">
                                                            {currentOrg.sharedCollections?.find((c: any) => c.id === selectedCollectionId)?.name}
                                                        </h4>
                                                        <button 
                                                            onClick={() => setShowEntryPicker(!showEntryPicker)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all"
                                                        >
                                                            <Plus size={16} />
                                                            {t('common.add')}
                                                        </button>
                                                    </div>

                                                    {showEntryPicker && (
                                                        <div className="p-4 bg-navy-900 border border-indigo-500/30 rounded-2xl space-y-3">
                                                            <div className="relative mb-2">
                                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                                                <input 
                                                                    type="text"
                                                                    value={entrySearchTerm}
                                                                    onChange={(e) => setEntrySearchTerm(e.target.value)}
                                                                    placeholder={t('vault.searchPlaceholder')}
                                                                    className="w-full bg-navy-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500/30"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                                                                {entries
                                                                    .filter(e => !currentOrg.sharedCollections?.find((c: any) => c.id === selectedCollectionId)?.entryIds?.includes(e.id))
                                                                    .filter(e => e.title.toLowerCase().includes(entrySearchTerm.toLowerCase()) || e.username?.toLowerCase().includes(entrySearchTerm.toLowerCase()))
                                                                    .map(entry => (
                                                                        <div 
                                                                            key={entry.id}
                                                                            onClick={() => handleAddEntryToCollection(entry.id)}
                                                                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-between cursor-pointer group"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <Lock size={14} className="text-white/20" />
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs text-white/60 group-hover:text-white transition-colors">{entry.title}</span>
                                                                                    {entry.username && <span className="text-[10px] text-white/20">{entry.username}</span>}
                                                                                </div>
                                                                            </div>
                                                                            <Plus size={14} className="text-white/10 group-hover:text-indigo-400" />
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 gap-2">
                                                        {currentOrg.sharedCollections?.find((c: any) => c.id === selectedCollectionId)?.entryIds?.map((entryId: string) => {
                                                            const entry = entries.find(e => e.id === entryId);
                                                            return (
                                                                <div key={entryId} className="p-4 bg-navy-900/50 rounded-2xl border border-white/5 flex flex-col gap-3 group">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-indigo-400">
                                                                                <Lock size={16} />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-bold text-white">{entry?.title || 'Unknown Entry'}</p>
                                                                                <p className="text-[10px] text-white/30 truncate max-w-[200px]">{entry?.username || entry?.website || 'No details'}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <button 
                                                                                onClick={(e) => toggleEntryVisibility(entryId, e)}
                                                                                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/5 rounded-xl text-white/20 hover:text-white transition-all"
                                                                            >
                                                                                {visibleEntries.has(entryId) ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                            </button>
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleRemoveEntryFromCollection(entryId);
                                                                                }}
                                                                                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 rounded-xl text-white/20 hover:text-rose-500 transition-all pointer-events-auto"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {visibleEntries.has(entryId) && entry && (
                                                                        <motion.div 
                                                                            initial={{ opacity: 0, height: 0 }}
                                                                            animate={{ opacity: 1, height: 'auto' }}
                                                                            className="pt-3 border-t border-white/5 space-y-2"
                                                                        >
                                                                            {entry.password && (
                                                                                <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                                                                    <span className="text-[10px] text-white/20 uppercase font-black">Password</span>
                                                                                    <code className="text-[10px] text-indigo-400 font-mono">{entry.password}</code>
                                                                                </div>
                                                                            )}
                                                                            {entry.notes && (
                                                                                <div className="p-2 bg-black/20 rounded-lg">
                                                                                    <span className="text-[10px] text-white/20 uppercase font-black block mb-1">Notes</span>
                                                                                    <p className="text-[10px] text-white/60 whitespace-pre-wrap">{entry.notes}</p>
                                                                                </div>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-4">
                                                    {currentOrg.sharedCollections?.map((col: any) => (
                                                        <div 
                                                            key={col.id} 
                                                            onClick={() => setSelectedCollectionId(col.id)}
                                                            className="p-6 bg-navy-900/50 rounded-3xl border border-white/5 space-y-2 hover:border-indigo-500/30 transition-all cursor-pointer group"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <h5 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{col.name}</h5>
                                                                <ChevronRight size={16} className="text-white/10 group-hover:text-white/40 group-hover:translate-x-1 transition-all" />
                                                            </div>
                                                            <p className="text-[10px] text-white/30 uppercase tracking-widest">{col.entryIds?.length || 0} {t('organization.entriesCount')}</p>
                                                        </div>
                                                    ))}
                                                    <div 
                                                        onClick={() => setShowAddCollection(true)}
                                                        className="p-6 bg-navy-900/50 rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-3 group hover:border-indigo-500/20 transition-all cursor-pointer"
                                                    >
                                                        <FolderPlus size={24} className="text-white/10 group-hover:text-indigo-400 transition-colors" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40">{t('organization.actions.addCollection')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'policies' && (
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-bold text-white">{t('organization.dashboard.policies')}</h3>
                                            <div className="space-y-3">
                                                {policies.map((policy) => (
                                                    <div key={policy.id} className="p-5 bg-navy-900/50 rounded-3xl border border-white/5 flex items-center justify-between">
                                                        <div>
                                                            <h5 className="text-sm font-bold text-white uppercase tracking-widest">{policy.title}</h5>
                                                            <p className="text-[10px] text-white/30 uppercase tracking-widest leading-none mt-1">{policy.desc}</p>
                                                        </div>
                                                        <div 
                                                            onClick={() => togglePolicy(policy.id)}
                                                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${policy.enabled ? 'bg-indigo-600' : 'bg-white/10'}`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${policy.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'sso' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xl font-bold text-white">{t('organization.sso.title')}</h3>
                                                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${currentOrg.ssoEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}>
                                                    {currentOrg.ssoEnabled ? t('organization.sso.statusActive') : t('organization.sso.statusInactive')}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="p-6 bg-navy-900/50 rounded-3xl border border-white/5 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                                                                <Lock size={20} />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-bold text-white tracking-wide">{t('organization.sso.enable')}</h4>
                                                                <p className="text-[10px] text-white/30 uppercase font-black">{t('organization.sso.configuration')}</p>
                                                            </div>
                                                        </div>
                                                        <div 
                                                            onClick={toggleSSO}
                                                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${currentOrg.ssoEnabled ? 'bg-indigo-600' : 'bg-white/10'}`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${currentOrg.ssoEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">
                                                                {t('organization.sso.provider')}
                                                            </label>
                                                            <select 
                                                                value={ssoConfig.provider}
                                                                onChange={(e) => setSsoConfig({ ...ssoConfig, provider: e.target.value })}
                                                                className="w-full bg-navy-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/30"
                                                            >
                                                                <option>Okta (OIDC)</option>
                                                                <option>Azure AD (SAML)</option>
                                                                <option>Google (OIDC)</option>
                                                                <option>Custom SAML 2.0</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">
                                                                {t('organization.sso.domain')}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={ssoConfig.domain}
                                                                onChange={(e) => setSsoConfig({ ...ssoConfig, domain: e.target.value })}
                                                                placeholder="company.com"
                                                                className="w-full bg-navy-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/30"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">
                                                            {t('organization.sso.metadata')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={ssoConfig.metadata}
                                                            onChange={(e) => setSsoConfig({ ...ssoConfig, metadata: e.target.value })}
                                                            placeholder="https://idp.com/metadata.xml"
                                                            className="w-full bg-navy-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500/30"
                                                        />
                                                    </div>

                                                    <div className="pt-4">
                                                        <button 
                                                            onClick={handleSaveSSO}
                                                            disabled={isLoading}
                                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                                        >
                                                            {t('common.save')}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="p-6 bg-rose-500/5 rounded-3xl border border-rose-500/10 flex items-start gap-4">
                                                    <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
                                                        <Shield size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">{t('organization.sso.securityNoteTitle')}</h4>
                                                        <p className="text-[10px] text-white/40 leading-relaxed mt-1">
                                                            {t('organization.sso.securityNoteDesc')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default OrgManagementModal;
