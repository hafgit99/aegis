import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { motion } from 'framer-motion';

interface QRScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        scannerRef.current = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );

        scannerRef.current.render((decodedText: string) => {
            onScan(decodedText);
            scannerRef.current?.clear().then(onClose);
        }, () => {
            // Ignore errors
        });

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
            }
        };
    }, [onScan, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
            <div className="relative w-full max-w-md bg-navy-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Camera className="text-indigo-400" size={18} />
                        <span className="text-sm font-bold text-white">QR Kod Tara</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div id="qr-reader" className="overflow-hidden rounded-xl border border-white/10 bg-black/40"></div>
                    <p className="mt-4 text-center text-[11px] text-white/30 italic">
                        Kamerayı QR koda doğrultun. Tarama otomatik olarak yapılacaktır.
                    </p>
                </div>
            </div>
        </motion.div>
    );
};
