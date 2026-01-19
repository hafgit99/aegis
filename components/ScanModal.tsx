/**
 * Aegis Vault - Scan Modal Component
 * Modal for scanning QR codes to receive shared passwords
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, QrCode, Camera, Upload, AlertCircle, Loader2, Scan, Image as ImageIcon, StopCircle
} from 'lucide-react';
import { QRSharePayload, ShareErrorType } from '../types';
import { ShareService } from '../services/shareService';
import { CryptoService } from '../services/cryptoService';
import { useLanguage } from '../contexts/LanguageContext';
import useQRScanner from '../hooks/useQRScanner';

interface ScanModalProps {
  onClose: () => void;
  onScanComplete: (payload: QRSharePayload) => void;
}

const ScanModal: React.FC<ScanModalProps> = ({ onClose, onScanComplete }) => {
  const { t, lang } = useLanguage();
  const [scanMethod, setScanMethod] = useState<'camera' | 'upload' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const {
    isScanning,
    startScanning,
    stopScanning,
    scanImage,
    error: scannerError
  } = useQRScanner({
    onScanComplete: handleQRData,
    onError: (err) => setError(err)
  });

  // Handle QR code data (either from camera or upload)
  function handleQRData(data: string): void {
    setIsProcessing(true);

    try {
      // Decode base64 data
      const dataBytes = CryptoService.base64ToArrayBuffer(data);
      const dataJson = new TextDecoder().decode(dataBytes);
      const payload = JSON.parse(dataJson) as QRSharePayload;

      // Validate format
      if (payload.version !== "1.0" || payload.type !== "AEGIS_SHARE") {
        setError(ShareService.getErrorMessage('INVALID_SHARE_FORMAT', lang as 'tr' | 'en'));
        setIsProcessing(false);
        return;
      }

      // Check expiration
      if (ShareService.isPayloadExpired(payload)) {
        setError(ShareService.getErrorMessage('SHARE_EXPIRED', lang as 'tr' | 'en'));
        setIsProcessing(false);
        return;
      }

      // Success - pass to parent
      onScanComplete(payload);
    } catch (err) {
      console.error('Parse error:', err);
      setError(ShareService.getErrorMessage('INVALID_SHARE_FORMAT', lang as 'tr' | 'en'));
      setIsProcessing(false);
    }
  }

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError('');

    try {
      const result = await scanImage(file);
      if (result) {
        handleQRData(result);
      } else {
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(ShareService.getErrorMessage('NO_QR_FOUND', lang as 'tr' | 'en'));
      setIsProcessing(false);
    }

    // Reset file input
    setFileInputKey(prev => prev + 1);
  };

  // Start camera scanning
  const handleStartCamera = async () => {
    setError('');
    setScanMethod('camera');
    await startScanning();
  };

  // Stop camera and go back
  const handleStopCamera = () => {
    stopScanning();
    setScanMethod(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-md bg-[#0a0a0b] border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-8 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600/10 text-emerald-500 rounded-2xl flex items-center justify-center">
              <QrCode size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                {lang === 'tr' ? 'QR Tara' : 'Scan QR'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {lang === 'tr' ? 'Paylaşım Al' : 'Receive Share'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {!scanMethod ? (
            <div className="space-y-6">
              {/* Info */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex gap-3">
                <Scan className="text-emerald-500 flex-shrink-0" size={20} />
                <div className="text-sm text-zinc-400">
                  {lang === 'tr' ? (
                    <>
                      <span className="font-bold text-white">QR Kod:</span> Paylaşılan şifreyi almak için
                      gönderen kişinin QR kodunu tarayın veya görsel olarak yükleyin.
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-white">QR Code:</span> Scan or upload the QR code
                      from the sender to receive the shared password.
                    </>
                  )}
                </div>
              </div>

              {/* Scan Options */}
              <div className="grid grid-cols-2 gap-4">
                {/* Camera Scan */}
                <button
                  onClick={handleStartCamera}
                  disabled={isProcessing}
                  className="p-6 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 rounded-2xl transition-all group disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Camera size={28} />
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    {lang === 'tr' ? 'Kamera' : 'Camera'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {lang === 'tr' ? 'Canlı tarama' : 'Live scan'}
                  </div>
                </button>

                {/* Upload Image */}
                <button
                  onClick={() => {
                    setScanMethod('upload');
                    fileInputRef.current?.click();
                  }}
                  disabled={isProcessing}
                  className="p-6 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 rounded-2xl transition-all group disabled:opacity-50"
                >
                  <div className="w-14 h-14 bg-emerald-600/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <ImageIcon size={28} />
                  </div>
                  <div className="text-sm font-bold text-white mb-1">
                    {lang === 'tr' ? 'Yükle' : 'Upload'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {lang === 'tr' ? 'Görselden tara' : 'Scan from image'}
                  </div>
                </button>
              </div>

              {/* Hidden file input */}
              <input
                key={fileInputKey}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Error */}
              {(error || scannerError) && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle size={18} />
                  {error || scannerError}
                </div>
              )}

              {/* Loading */}
              {isProcessing && (
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex items-center justify-center gap-3 text-blue-400">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm font-bold">
                    {lang === 'tr' ? 'İşleniyor...' : 'Processing...'}
                  </span>
                </div>
              )}
            </div>
          ) : scanMethod === 'camera' ? (
            <div className="space-y-6">
              {/* Camera View */}
              <div
                ref={videoContainerRef}
                className="relative aspect-square bg-black rounded-3xl overflow-hidden border-2 border-white/10"
              >
                {isScanning ? (
                  <>
                    {/* Video element will be created by hook */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-64 h-64 border-4 border-emerald-500/50 rounded-3xl" />
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-emerald-400">
                          {lang === 'tr' ? 'Taranıyor...' : 'Scanning...'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={32} className="text-zinc-600 animate-spin" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="text-center text-sm text-zinc-500">
                {lang === 'tr'
                  ? 'QR kodu kare içine hizalayın'
                  : 'Align QR code within the frame'}
              </div>

              {/* Stop Button */}
              <button
                onClick={handleStopCamera}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-3"
              >
                <StopCircle size={18} />
                {lang === 'tr' ? 'DURDUR' : 'STOP'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upload View */}
              <div className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center p-8">
                <ImageIcon size={48} className="text-zinc-600 mb-4" />
                <div className="text-sm text-zinc-500 text-center">
                  {lang === 'tr'
                    ? 'QR kod içeren görseli seçin'
                    : 'Select image containing QR code'}
                </div>
              </div>

              {/* Back Button */}
              <button
                onClick={() => {
                  setScanMethod(null);
                  fileInputRef.current?.click();
                }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all border border-white/5"
              >
                {lang === 'tr' ? 'GERİ' : 'BACK'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ScanModal;
