import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Cloud, CloudRain, Server, Globe, Key, CheckCircle2,
    AlertTriangle, Loader2, RefreshCw, Upload, Download,
    Settings, X, ShieldCheck, Database, Link, ExternalLink
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { CloudSyncService } from '../../services/cloud/CloudSyncService';

const CloudBridgeView: React.FC<{ onRefresh?: () => Promise<void> }> = ({ onRefresh }) => {
    const { t, lang } = useLanguage();
    const { masterKey } = useAuth();

    const [activeProvider, setActiveProvider] = useState<'google' | 'webdav' | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const isDesktop = !!(window as any).electronAPI;

    // WebDAV Form
    const [webdavConfig, setWebdavConfig] = useState({
        url: '',
        username: '',
        password: '',
        remotePath: '/Aegis-Vault'
    });

    useEffect(() => {
        const saved = localStorage.getItem('aegis_cloud_provider');
        if (saved) setActiveProvider(saved as any);

        const savedWebdav = localStorage.getItem('aegis_webdav_config');
        if (savedWebdav) setWebdavConfig(JSON.parse(savedWebdav));
    }, []);

    const handleConnectGoogle = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const clientId = localStorage.getItem('aegis_google_client_id');
            const clientSecret = localStorage.getItem('aegis_google_client_secret');

            if (!clientId || !clientSecret) {
                throw new Error(lang === 'tr' ? 'Lütfen Client ID ve Secret bilgilerini girin.' : 'Please enter Client ID and Secret.');
            }

            const sync = new CloudSyncService('google');
            // This triggers Oauth in Main via IPC, passing the custom keys
            await (sync as any).provider.initialize({ clientId, clientSecret });

            setActiveProvider('google');
            localStorage.setItem('aegis_cloud_provider', 'google');
            setSuccess(t('google_drive_connected'));
        } catch (e: any) {
            setError(e.message || t('cloud_sync_error'));
        } finally {
            setIsConnecting(false);
        }
    };

    const handleConnectWebDAV = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            localStorage.setItem('aegis_webdav_config', JSON.stringify(webdavConfig));
            const sync = new CloudSyncService('webdav');
            await (sync as any).provider.initialize();
            setActiveProvider('webdav');
            localStorage.setItem('aegis_cloud_provider', 'webdav');
            setSuccess(lang === 'tr' ? 'WebDAV Bağlantısı Başarılı!' : 'WebDAV Connection Successful!');
        } catch (e: any) {
            setError(t('cloud_sync_error'));
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSync = async (direction: 'push' | 'pull') => {
        if (!masterKey || !activeProvider) return;
        setIsSyncing(true);
        setError(null);
        setSuccess(null);
        try {
            const sync = new CloudSyncService(activeProvider);
            if (direction === 'push') {
                await sync.syncToCloud(masterKey);
                setSuccess(t('cloud_sync_success'));
            } else {
                await sync.pullFromCloud(masterKey);
                if (onRefresh) await onRefresh();
                setSuccess(lang === 'tr' ? 'Bulut verileri başarıyla indirildi ve eşitlendi.' : 'Cloud data successfully pulled and synced.');
            }
        } catch (e: any) {
            setError(t('cloud_sync_error'));
        } finally {
            setIsSyncing(false);
        }
    };

    const disconnect = () => {
        setActiveProvider(null);
        localStorage.removeItem('aegis_cloud_provider');
        setSuccess(lang === 'tr' ? 'Bağlantı kesildi.' : 'Disconnected.');
    };

    return (
        <div className="space-y-8">
            <div className="glass p-10 rounded-[3rem] border border-blue-500/10 bg-blue-500/[0.02] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Cloud size={150} className="animate-pulse" />
                </div>

                <div className="flex items-center justify-between mb-10 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-blue-600 text-white rounded-[1.5rem] shadow-xl shadow-blue-600/20">
                            <RefreshCw size={28} className={isSyncing ? 'animate-spin' : ''} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">{t('cloud_bridge_title')}</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t('cloud_bridge_desc')}</p>
                        </div>
                    </div>
                    {activeProvider && (
                        <button onClick={disconnect} className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all border border-red-500/10">
                            {lang === 'tr' ? 'BAĞLANTIYI KES' : 'DISCONNECT'}
                        </button>
                    )}
                </div>

                {!activeProvider ? (
                    <div className="space-y-6 relative z-10">
                        {!isDesktop && (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-500 mb-4">
                                <AlertTriangle size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-center">
                                    {lang === 'tr'
                                        ? "Bulut Senkronizasyonu sadece Masaüstü Uygulamasında kullanılabilir."
                                        : "Cloud Sync is only available in the Desktop Application."}
                                </span>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Google Drive Option */}
                            <div className={`glass p-8 rounded-[2rem] border border-white/5 space-y-6 flex flex-col items-center text-center group/card transition-all shadow-xl ${!isDesktop ? 'opacity-50 grayscale' : 'hover:border-blue-500/20'}`}>
                                <div className="p-5 bg-white/5 text-zinc-400 rounded-3xl group-hover/card:scale-110 group-hover/card:bg-blue-600 group-hover/card:text-white transition-all duration-500">
                                    <Globe size={32} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Google Drive</h4>
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-2">{lang === 'tr' ? 'Özel API Yapılandırması' : 'Custom API Configuration'}</p>
                                </div>
                                <div className="w-full space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Google Client ID"
                                        value={localStorage.getItem('aegis_google_client_id') || ''}
                                        onChange={e => localStorage.setItem('aegis_google_client_id', e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-300 outline-none focus:border-blue-500/50"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Google Client Secret"
                                        value={localStorage.getItem('aegis_google_client_secret') || ''}
                                        onChange={e => localStorage.setItem('aegis_google_client_secret', e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-300 outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <button
                                    onClick={handleConnectGoogle}
                                    disabled={isConnecting || !isDesktop}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl mb-2 transition-all shadow-xl shadow-blue-900/20"
                                >
                                    {isConnecting ? <Loader2 className="animate-spin mx-auto" size={16} /> : (lang === 'tr' ? 'KİMLİK DOĞRLAMA' : 'AUTHENTICATE')}
                                </button>
                            </div>

                            {/* WebDAV Option */}
                            <div className={`glass p-8 rounded-[2rem] border border-white/5 space-y-6 group/card transition-all shadow-xl ${!isDesktop ? 'opacity-50 grayscale' : 'hover:border-emerald-500/20'}`}>
                                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                                    <div className="p-3 bg-white/5 text-emerald-500 rounded-2xl">
                                        <Server size={24} />
                                    </div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest">WebDAV / Personal Cloud</h4>
                                </div>

                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Server URL (https://...)"
                                        value={webdavConfig.url}
                                        disabled={!isDesktop}
                                        onChange={e => setWebdavConfig({ ...webdavConfig, url: e.target.value })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-300 outline-none focus:border-emerald-500/50"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Username"
                                            value={webdavConfig.username}
                                            disabled={!isDesktop}
                                            onChange={e => setWebdavConfig({ ...webdavConfig, username: e.target.value })}
                                            className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-300 outline-none focus:border-emerald-500/50"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            value={webdavConfig.password}
                                            disabled={!isDesktop}
                                            onChange={e => setWebdavConfig({ ...webdavConfig, password: e.target.value })}
                                            className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-300 outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                    <button
                                        onClick={handleConnectWebDAV}
                                        disabled={isConnecting || !webdavConfig.url || !isDesktop}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-900/10 transition-all"
                                    >
                                        {isConnecting ? <Loader2 className="animate-spin mx-auto" size={16} /> : (lang === 'tr' ? 'SUNUCUYA BAĞLAN' : 'BRIDGE TO SERVER')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 relative z-10">
                        {/* Status Area */}
                        <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-3xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{activeProvider === 'google' ? 'Google Drive' : 'WebDAV Server'}</span>
                                    <span className="px-2 py-0.5 bg-zinc-900 text-zinc-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-white/5">PROTOCOL E2EE v4</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={14} className="text-blue-500" />
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Bridged & Secured</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleSync('push')}
                                disabled={isSyncing}
                                className="group relative py-6 bg-white text-black rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] overflow-hidden shadow-2xl transition-all active:scale-95"
                            >
                                <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                <span className="relative z-10 group-hover:text-white flex items-center justify-center gap-3">
                                    {isSyncing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                    {t('sync_now')}
                                </span>
                            </button>

                            <button
                                onClick={() => handleSync('pull')}
                                disabled={isSyncing}
                                className="group relative py-6 bg-black/40 border border-white/5 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] overflow-hidden shadow-xl transition-all active:scale-95"
                            >
                                <div className="absolute inset-0 bg-zinc-800 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {isSyncing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                                    {t('pull_from_cloud')}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500">
                            <AlertTriangle size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-8 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 text-emerald-500">
                            <CheckCircle2 size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{success}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Info Box */}
            <div className="p-8 bg-zinc-900/50 border border-white/5 rounded-[2.5rem] flex gap-6 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                    <Database size={80} />
                </div>
                <div className="p-4 bg-white/5 text-blue-500 h-fit rounded-2xl shadow-inner">
                    <Database size={24} />
                </div>
                <div className="space-y-3 relative z-10">
                    <h4 className="text-[12px] font-black text-white uppercase tracking-[0.2em]">{lang === 'tr' ? 'NEDEN KENDİ BULUTUNUZ?' : 'WHY YOUR OWN CLOUD?'}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase leading-relaxed tracking-wider">
                        {lang === 'tr'
                            ? "AEGIS VAULT VERİLERİNİZE ASLA DOKUNMAZ. VERİLERİNİZ SİZİN KONTROLÜNÜZDEKİ ALANLARDA UÇTAN UCA ŞİFRELENMİŞ OLARAK SAKLANIR. BU SAYEDE BULUT ŞİRKETİ BİLE VERİLERİNİZİ OKUYAMAZ."
                            : "AEGIS VAULT NEVER TOUCHES YOUR DATA. YOUR ASSETS ARE STORED END-TO-END ENCRYPTED WITHIN THE STORAGE PROVIDERS YOU CONTROL. NOT EVEN THE CLOUD COMPANY CAN READ YOUR SECRETS."}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CloudBridgeView;
