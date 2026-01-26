
import React, { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar: React.FC = () => {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        const check = () => {
            const hasAPI = !!(window as any).electronAPI;
            if (hasAPI) {
                setIsElectron(true);
                return true;
            }
            return false;
        };

        check();
        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    }, []);

    const callAPI = (method: string) => {
        const api = (window as any).electronAPI;
        if (api && api[method]) {
            console.log(`[TitleBar] Executing IPC: ${method}`);
            api[method]();
        } else {
            console.warn(`[TitleBar] electronAPI.${method} not found`);
        }
    };

    // Browser ortamında boşluk bırakmamak için null döner, ama Electron'da mutlaka render edilir
    if (!isElectron && !process.env.NODE_ENV) return null;

    return (
        <div className="h-10 bg-[#060606] border-b border-white/[0.03] flex items-center select-none relative z-[10000] w-full flex-shrink-0 overflow-hidden">

            {/* 1. Logo Bölgesi - SÜRÜKLENEMEZ (no-drag) */}
            <div
                className="flex items-center gap-3 px-5 h-full relative z-20"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <div className="w-5 h-5 bg-blue-600/10 rounded-md flex items-center justify-center border border-blue-500/10">
                    <img src="./icon1.png" alt="A" className="w-3 h-3 object-contain opacity-90" />
                </div>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                    Aegis Vault
                </span>
            </div>

            {/* 2. ANA SÜRÜKLEME ALANI - Sadece ortadaki boşluk (drag) */}
            {/* Bu div flex-1 ile tüm boşluğu kaplar ama butonların üzerine binemez */}
            <div
                className="flex-1 h-full cursor-default relative z-10"
                style={{ WebkitAppRegion: 'drag' } as any}
            />

            {/* 3. Butonlar Bölgesi - SÜRÜKLENEMEZ (no-drag) */}
            <div
                className="flex h-full items-center relative z-20 bg-[#060606]"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                {/* Minimize */}
                <button
                    onClick={() => callAPI('minimize')}
                    className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                    <Minus size={14} />
                </button>

                {/* Maximize */}
                <button
                    onClick={() => callAPI('maximize')}
                    className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                    <Square size={12} strokeWidth={2} />
                </button>

                {/* Close */}
                <button
                    onClick={() => callAPI('close')}
                    className="w-14 h-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-600 transition-all cursor-pointer"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
