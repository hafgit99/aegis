import React, { useState, useEffect } from 'react';

import {
    Wifi,
    WifiOff,
    RefreshCw,
    Smartphone,
    Laptop,
    Shield,
    Activity,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react';
export const P2PSyncManager: React.FC = () => {
    const [status, setStatus] = useState<{ active: boolean; status: string }>({ active: false, status: '' });
    const peers: string[] = []; // Currently no peer discovery implemented
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            const currentStatus = await window.aegis.p2p.getStatus();
            setStatus(currentStatus);
        };
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleP2P = async () => {
        setIsLoading(true);
        try {
            if (status.active) {
                await window.aegis.p2p.stop();
            } else {
                await window.aegis.p2p.start();
            }
            const newStatus = await window.aegis.p2p.getStatus();
            setStatus(newStatus);
        } catch (error) {
            console.error('P2P toggle error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wifi className="w-6 h-6 text-indigo-400" />
                        P2P Senkronizasyon
                    </h2>
                    <p className="text-sm text-white/40 mt-1">Cihazlar arasında güvenli ve merkeziyetsiz senkronizasyon.</p>
                </div>
                <button
                    onClick={toggleP2P}
                    disabled={isLoading}
                    className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${status.active
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                        : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500'
                        }`}
                >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (status.active ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />)}
                    {status.active ? 'Durdur' : 'Başlat'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Connection Status Card */}
                <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-indigo-500/10 rounded-2xl">
                            <Activity className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${status.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'
                            }`}>
                            {status.active ? 'Aktif' : 'Pasif'}
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-white">Bağlantı Durumu</h3>
                    <p className="text-sm text-white/40 mt-1">{status.status || 'Hizmet başlatılmadı'}</p>
                </div>

                {/* Security Status Card */}
                <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-2xl">
                            <Shield className="w-6 h-6 text-purple-400" />
                        </div>
                        <div className="px-3 py-1 bg-purple-500/20 rounded-full text-[10px] font-black text-purple-400 uppercase tracking-widest">
                            Noise Protocol
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-white">Güvenlik Katmanı</h3>
                    <p className="text-sm text-white/40 mt-1">Uçtan uca şifreli veri aktarımı aktif.</p>
                </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-white/[0.02]">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-white/40" />
                    Bağlı Cihazlar
                </h3>

                {status.active ? (
                    peers.length > 0 ? (
                        <div className="space-y-3">
                            {peers.map((peer, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                            <Smartphone className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{peer}</p>
                                            <p className="text-[10px] text-white/40 uppercase tracking-tighter">Mobil Cihaz • Çevrimiçi</p>
                                        </div>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <RefreshCw className="w-10 h-10 text-white/10 mx-auto mb-4 animate-spin-slow" />
                            <p className="text-sm text-white/40">Cihazlar taranıyor...</p>
                        </div>
                    )
                ) : (
                    <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                        <AlertTriangle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                        <p className="text-sm text-white/40">Cihazları görmek için P2P hizmetini başlatın.</p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4 text-amber-400">
                <Shield className="w-6 h-6 flex-shrink-0" />
                <div className="text-xs font-medium leading-relaxed">
                    P2P senkronizasyonu sadece yerel ağınızdaki (Wi-Fi) cihazlar arasında çalışır. Verileriniz hiçbir merkezi sunucuya yüklenmez.
                </div>
            </div>
        </div>
    );
};
