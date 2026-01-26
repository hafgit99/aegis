
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Mail, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useLanguage } from '../../contexts/LanguageContext';
import { CRYPTO_COINS, PAYMENT_EMAIL, PAYMENT_PRICE_EUR } from '../../utils/cryptoCoins';

interface CryptoPaymentModalProps {
    onClose: () => void;
    deviceId: string;
}

const CryptoPaymentModal: React.FC<CryptoPaymentModalProps> = ({ onClose, deviceId }) => {
    const { t, lang } = useLanguage();
    const [selectedCoin, setSelectedCoin] = useState(CRYPTO_COINS[0]);
    const [isCopied, setIsCopied] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    // Generate QR code when coin changes
    React.useEffect(() => {
        QRCode.toDataURL(selectedCoin.address, {
            width: 256,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        }).then(setQrDataUrl).catch(console.error);
    }, [selectedCoin]);

    const handleCopyAddress = () => {
        navigator.clipboard.writeText(selectedCoin.address);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleNotifyPayment = () => {
        const subject = t('crypto_email_subject');
        const body = t('crypto_email_body').replace('{deviceId}', deviceId);
        const mailtoLink = `mailto:${PAYMENT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoLink, '_blank');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="glass p-6 md:p-8 rounded-[2.5rem] border border-amber-500/20 w-full max-w-[98vw] xl:max-w-[1200px] shadow-[0_0_100px_rgba(245,158,11,0.15)] relative"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors z-10"
                >
                    <X size={24} />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-amber-500/10">
                        <QrCode size={28} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase mb-2">
                        {t('crypto_payment_title')}
                    </h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        {t('crypto_payment_desc')}
                    </p>
                </div>

                {/* Coin Selector */}
                <div className="mb-6">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4 mb-3 block">
                        {t('crypto_select_coin')}
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {CRYPTO_COINS.map((coin) => (
                            <button
                                key={coin.id}
                                onClick={() => setSelectedCoin(coin)}
                                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedCoin.id === coin.id
                                    ? 'border-amber-500 bg-amber-500/10 scale-105'
                                    : 'border-white/5 bg-black/20 hover:border-white/10 hover:scale-105'
                                    }`}
                                style={{
                                    color: selectedCoin.id === coin.id ? coin.color : '#71717a'
                                }}
                            >
                                <div className="text-xl md:text-2xl font-black mb-1">{coin.icon}</div>
                                <div className="text-[9px] font-bold text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full px-1">{coin.id}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Selected Coin Details */}
                <div className="p-6 bg-black/40 border border-white/5 rounded-[2rem] mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-6 items-center">
                        {/* QR Code */}
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                            {qrDataUrl && (
                                <div className="w-32 h-32 md:w-full md:aspect-square bg-white p-2 rounded-xl shadow-lg">
                                    <img src={qrDataUrl} alt="QR Code" className="w-full h-full" />
                                </div>
                            )}
                        </div>

                        {/* Coin Info */}
                        <div className="flex-1 min-w-0 overflow-hidden w-full">
                            <div className="flex items-center gap-4 mb-4 justify-center md:justify-start">
                                <div
                                    className="text-3xl md:text-4xl font-black"
                                    style={{ color: selectedCoin.color }}
                                >
                                    {selectedCoin.icon}
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="text-xl md:text-2xl font-black text-white mb-1 leading-none">{selectedCoin.name}</div>
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                                        {selectedCoin.network}
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="mb-4">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2 block text-center md:text-left">
                                    {t('crypto_address_label')}
                                </label>
                                <div className="font-mono text-sm md:text-lg text-zinc-200 bg-black/60 p-4 rounded-xl border border-white/5 whitespace-nowrap overflow-x-auto scrollbar-hide text-center md:text-left">
                                    {selectedCoin.address}
                                </div>
                            </div>

                            {/* Copy Button */}
                            <button
                                onClick={handleCopyAddress}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border-2 border-white/10 hover:border-white/20 rounded-xl text-white font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-2"
                            >
                                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                {isCopied ? t('crypto_copied') : t('crypto_copy_address')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Instructions & Button Row */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
                    {/* Instructions */}
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                        <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-widest text-center md:text-left">
                            {t('crypto_instructions')}
                        </p>
                    </div>

                    {/* Notify Payment Button */}
                    <button
                        onClick={handleNotifyPayment}
                        className="w-full md:w-auto px-8 py-4 bg-amber-600 hover:bg-amber-500 text-black font-black uppercase tracking-[0.3em] text-[11px] rounded-xl shadow-2xl shadow-amber-600/20 transition-all flex items-center justify-center gap-3 whitespace-nowrap"
                    >
                        <Mail size={18} />
                        {t('crypto_notify_payment')}
                    </button>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                        {PAYMENT_EMAIL} • {t('secure_payment_gateway')}
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default CryptoPaymentModal;
