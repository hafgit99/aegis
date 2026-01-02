
import React, { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar: React.FC = () => {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        // Check if electronAPI is available
        const hasAPI = !!(window as any).electronAPI;
        console.log('[TitleBar] electronAPI available:', hasAPI);
        setIsElectron(hasAPI);
    }, []);

    const handleMinimize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Minimize clicked', (window as any).electronAPI);
        try {
            if ((window as any).electronAPI?.minimize) {
                (window as any).electronAPI.minimize();
            } else {
                console.error('electronAPI.minimize not available');
            }
        } catch (err) {
            console.error('Minimize error:', err);
        }
    };

    const handleMaximize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Maximize clicked', (window as any).electronAPI);
        try {
            if ((window as any).electronAPI?.maximize) {
                (window as any).electronAPI.maximize();
            } else {
                console.error('electronAPI.maximize not available');
            }
        } catch (err) {
            console.error('Maximize error:', err);
        }
    };

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Close clicked', (window as any).electronAPI);
        try {
            if ((window as any).electronAPI?.close) {
                (window as any).electronAPI.close();
            } else {
                console.error('electronAPI.close not available');
            }
        } catch (err) {
            console.error('Close error:', err);
        }
    };

    return (
        <div className="h-8 bg-black/60 backdrop-blur-md border-b border-white/10 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-[9999]" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center gap-3 px-4 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <img src="./icon1.png" alt="Logo" className="w-4 h-4 object-contain opacity-80" />
                <span className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest whitespace-nowrap">
                    {isElectron ? '✓ Aegis Vault' : '○ Aegis Vault'}
                </span>
            </div>

            <div className="flex h-full items-center gap-0 ml-auto flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onMouseDown={handleMinimize}
                    onClick={handleMinimize}
                    className="w-10 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors duration-150 cursor-pointer"
                    title="Minimize"
                    aria-label="Minimize window"
                    disabled={!isElectron}
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <Minus size={16} strokeWidth={2.5} />
                </button>
                <button
                    onMouseDown={handleMaximize}
                    onClick={handleMaximize}
                    className="w-10 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                    title="Maximize/Restore"
                    aria-label="Maximize window"
                    disabled={!isElectron}
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <Square size={14} strokeWidth={2.5} />
                </button>
                <button
                    onMouseDown={handleClose}
                    onClick={handleClose}
                    className="w-10 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-600/80 active:bg-red-700 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                    title="Close"
                    aria-label="Close window"
                    disabled={!isElectron}
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <X size={16} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
