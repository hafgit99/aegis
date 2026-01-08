
import React, { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar: React.FC = () => {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        // API'yi sürekli kontrol et (Gecikmeli yüklemeler için)
        const check = () => {
            const hasAPI = !!(window as any).electronAPI;
            if (hasAPI) {
                setIsElectron(true);
                return true;
            }
            return false;
        };

        check();
        const interval = setInterval(check, 500);
        return () => clearInterval(interval);
    }, []);

    const callAPI = (method: string) => {
        const api = (window as any).electronAPI;
        if (api && api[method]) {
            api[method]();
        } else {
            console.error(`electronAPI.${method} not found`);
        }
    };

    return (
        <div
            className="h-8 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between select-none relative z-[9999] w-full"
            style={{ WebkitAppRegion: 'drag' } as any}
        >
            <div
                className="flex items-center gap-3 px-4"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <img src="./icon1.png" alt="Logo" className="w-4 h-4 object-contain opacity-80" />
                <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-[0.2em]">
                    AEGIS VAULT
                </span>
            </div>

            <div
                className="flex h-full items-center ml-auto"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                {/* Minimize */}
                <button
                    onClick={() => callAPI('minimize')}
                    className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-colors pointer-events-auto"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title="Minimize"
                >
                    <span className="text-lg leading-none" style={{ marginTop: '-8px' }}>_</span>
                </button>

                {/* Maximize */}
                <button
                    onClick={() => callAPI('maximize')}
                    className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-colors pointer-events-auto"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title="Maximize"
                >
                    <span className="text-sm border border-current w-3 h-3 block opacity-60" />
                </button>

                {/* Close */}
                <button
                    onClick={() => callAPI('close')}
                    className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-600/90 transition-colors pointer-events-auto"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title="Close"
                >
                    <span className="text-xl leading-none">&times;</span>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
