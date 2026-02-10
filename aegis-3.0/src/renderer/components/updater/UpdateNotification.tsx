import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface UpdateStatus {
    status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';
    info?: any;
    error?: string;
}

interface Progress {
    bytesPerSecond: number;
    percent: number;
    transferred: number;
    total: number;
}

export const UpdateNotification: React.FC = () => {
    const [status, setStatus] = useState<UpdateStatus | null>(null);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        window.aegis.update.onStatus((newStatus: UpdateStatus) => {
            console.log('Update status:', newStatus);
            setStatus(newStatus);
            if (newStatus.status === 'available' || newStatus.status === 'downloaded' || newStatus.status === 'error') {
                setIsVisible(true);
            }
        });

        window.aegis.update.onProgress((newProgress: Progress) => {
            setProgress(newProgress);
        });
    }, []);

    const handleInstall = async () => {
        await window.aegis.update.quitAndInstall();
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible || !status) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-4 right-4 z-[9999] w-80 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-4 text-white"
            >
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 font-semibold">
                        {status.status === 'checking' && <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />}
                        {status.status === 'available' && <Download className="w-4 h-4 text-blue-400" />}
                        {status.status === 'downloaded' && <CheckCircle className="w-4 h-4 text-green-400" />}
                        {status.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}

                        <span>
                            {status.status === 'checking' && 'Update Checking...'}
                            {status.status === 'available' && 'Update Available'}
                            {status.status === 'downloaded' && 'Update Ready'}
                            {status.status === 'error' && 'Update Error'}
                        </span>
                    </div>
                    <button onClick={handleDismiss} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="text-sm text-slate-300 mb-3">
                    {status.status === 'available' && (
                        <p>Version {status.info?.version} is available. Downloading automatically...</p>
                    )}
                    {status.status === 'downloaded' && (
                        <p>Update downloaded. Restart now to install.</p>
                    )}
                    {status.status === 'error' && (
                        <p>{status.error || 'Unknown error occurred.'}</p>
                    )}
                </div>

                {status.status === 'available' && progress && (
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-1">
                        <div
                            className="bg-blue-500 h-full transition-all duration-300 ease-out"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                )}

                {status.status === 'downloaded' && (
                    <button
                        onClick={handleInstall}
                        className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Restart & Install
                    </button>
                )}
            </motion.div>
        </AnimatePresence>
    );
};
