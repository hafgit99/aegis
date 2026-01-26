/**
 * Aegis Vault - Share Modal Component
 * Modal for generating QR codes to share passwords
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, QrCode, Download, Shield, Clock, AlertCircle, Check, Lock, Eye, EyeOff, Loader2, Copy
} from 'lucide-react';
import { VaultEntry, SensitiveData, QRSharePayload } from '../../types';
import { ShareService } from '../../services/shareService';
import { useLanguage } from '../../contexts/LanguageContext';

interface ShareModalProps {
  entry: VaultEntry;
  decryptedData: SensitiveData;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ entry, decryptedData, onClose }) => {
  const { t, lang } = useLanguage();
  const [step, setStep] = useState<'password' | 'qrcode'>('password');
  const [sharePassword, setSharePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qrPayload, setQrPayload] = useState<QRSharePayload | null>(null);
  const [qrCodes, setQrCodes] = useState<string[]>([]);
  const [currentQrIndex, setCurrentQrIndex] = useState(0);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate a strong random password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const password = Array.from({ length: 16 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    setGeneratedPassword(password);
    setSharePassword(password);
    setConfirmPassword(password);
    setError('');
  };

  // Validate password and generate QR codes
  const handleGenerateQR = async () => {
    setError('');

    // Validation
    const validation = ShareService.validatePassword(sharePassword);
    if (!validation.valid) {
      setError(ShareService.getErrorMessage(validation.error!, lang as 'tr' | 'en'));
      return;
    }

    if (sharePassword !== confirmPassword) {
      setError(lang === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Generate encrypted payload
      const result = await ShareService.generateSharePayload(
        entry,
        decryptedData,
        sharePassword,
        lang as 'tr' | 'en'
      );

      if (result.error || !result.payload) {
        setError(result.error || (lang === 'tr' ? 'Hata oluştu' : 'An error occurred'));
        setIsLoading(false);
        return;
      }

      setQrPayload(result.payload);

      // Generate QR codes
      const qrDataUrls = await ShareService.generateQRCodes(result.payload);
      setQrCodes(qrDataUrls);
      setStep('qrcode');
    } catch (err) {
      console.error('Generate QR error:', err);
      setError(lang === 'tr' ? 'QR oluşturulamadı' : 'Failed to generate QR codes');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy password to clipboard
  const handleCopyPassword = () => {
    navigator.clipboard.writeText(sharePassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download current QR code
  const handleDownloadQR = () => {
    if (qrCodes[currentQrIndex]) {
      const link = document.createElement('a');
      link.href = qrCodes[currentQrIndex];
      link.download = `aegis-share-${entry.title?.replace(/[^a-z0-9]/gi, '-')}-${currentQrIndex + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Download all QR codes
  const handleDownloadAll = () => {
    ShareService.downloadQRCodes(qrCodes, entry.title || 'entry');
  };

  // Get remaining time
  const getRemainingTime = () => {
    if (!qrPayload) return null;
    const remaining = ShareService.getRemainingTime(qrPayload);
    return remaining;
  };

  const remainingTime = getRemainingTime();

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
        className="w-full max-w-md bg-[#0a0a0b] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-8 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center">
              <QrCode size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                {lang === 'tr' ? 'QR İle Paylaş' : 'Share via QR'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {lang === 'tr' ? 'Güvenli Offline Paylaşım' : 'Secure Offline Sharing'}
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
          {step === 'password' && (
            <div className="space-y-6">
              {/* Info */}
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-3">
                <Shield className="text-blue-500 flex-shrink-0" size={20} />
                <div className="text-sm text-zinc-400">
                  {lang === 'tr' ? (
                    <>
                      <span className="font-bold text-white">Güvenlik Notu:</span> Bu paylaşım 24 saat geçerli olacak ve
                      sadece <span className="text-blue-400">paylaşım şifresi</span> olan kişiler tarafından açılabilecek.
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-white">Security Note:</span> This share expires in 24 hours and can only
                      be opened by anyone with the <span className="text-blue-400">sharing password</span>.
                    </>
                  )}
                </div>
              </div>

              {/* Entry Preview */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-2">
                  {lang === 'tr' ? 'PAYLAŞILACAK' : 'SHARING'}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center">
                    <Lock size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{entry.title}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{entry.username}</div>
                  </div>
                </div>
              </div>

              {/* Share Password Input */}
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block pl-2">
                  {lang === 'tr' ? 'PAYLAŞIM ŞİFRESİ (ZORUNLU)' : 'SHARING PASSWORD (REQUIRED)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder={lang === 'tr' ? 'En az 12 karakter...' : 'At least 12 characters...'}
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all pr-24"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={generateStrongPassword}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      {lang === 'tr' ? 'ÜRET' : 'GEN'}
                    </button>
                  </div>
                </div>
                {sharePassword.length > 0 && sharePassword.length < 12 && (
                  <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold px-2">
                    <AlertCircle size={12} />
                    {lang === 'tr' ? 'En az 12 karakter gerekli' : 'At least 12 characters required'}
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              {sharePassword.length >= 12 && (
                <div className="space-y-2">
                  <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block pl-2">
                    {lang === 'tr' ? 'ŞİFREYİ DOĞRULA' : 'CONFIRM PASSWORD'}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={lang === 'tr' ? 'Tekrar girin...' : 'Confirm password...'}
                      className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all pr-10"
                    />
                    <button
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && sharePassword !== confirmPassword && (
                    <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold px-2">
                      <AlertCircle size={12} />
                      {lang === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match'}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateQR}
                disabled={isLoading || sharePassword.length < 12 || sharePassword !== confirmPassword}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_20px_40px_rgba(37,99,235,0.3)] disabled:shadow-none flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {lang === 'tr' ? 'QR OLUŞTURULUYOR...' : 'GENERATING QR...'}
                  </>
                ) : (
                  <>
                    <QrCode size={18} />
                    {lang === 'tr' ? 'QR OLUŞTUR' : 'GENERATE QR'}
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'qrcode' && qrPayload && qrCodes.length > 0 && (
            <div className="space-y-6">
              {/* QR Code Display */}
              <div className="bg-white rounded-3xl p-6 flex items-center justify-center">
                <img
                  src={qrCodes[currentQrIndex]}
                  alt="QR Code"
                  className="w-full max-w-[280px] h-auto"
                />
              </div>

              {/* Multiple QR Codes Info */}
              {qrCodes.length > 1 && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 text-center">
                  <div className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mb-1">
                    {lang === 'tr' ? 'ÇOKLU QR KODU' : 'MULTIPLE QR CODES'}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {lang === 'tr'
                      ? `QR kod ${currentQrIndex + 1} / ${qrCodes.length}`
                      : `QR code ${currentQrIndex + 1} / ${qrCodes.length}`}
                  </div>
                  <div className="flex justify-center gap-2 mt-3">
                    {qrCodes.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentQrIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentQrIndex ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Expiration Info */}
              {remainingTime && (
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex items-center gap-3">
                  <Clock className="text-blue-500 flex-shrink-0" size={20} />
                  <div className="text-sm">
                    <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                      {lang === 'tr' ? 'GEÇERLİLİK SÜRESİ' : 'VALID UNTIL'}
                    </div>
                    <div className="text-white font-bold">
                      {remainingTime.hours}h {remainingTime.minutes}m
                    </div>
                  </div>
                </div>
              )}

              {/* Share Password Display */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                    {lang === 'tr' ? 'PAYLAŞIM ŞİFRESİ' : 'SHARING PASSWORD'}
                  </label>
                  <button
                    onClick={handleCopyPassword}
                    className="text-[10px] text-blue-400 font-bold uppercase tracking-wider hover:text-blue-300 transition-all flex items-center gap-1"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? (lang === 'tr' ? 'KOPYALANDI' : 'COPIED') : (lang === 'tr' ? 'KOPYALA' : 'COPY')}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-2 bg-white/5 rounded-xl font-mono text-sm text-blue-400 break-all select-all">
                    {sharePassword}
                  </div>
                </div>
                <div className="text-[9px] text-zinc-600 mt-2 text-center">
                  {lang === 'tr'
                    ? 'Bu şifreyi güvenli bir şekilde alıcıya iletin'
                    : 'Share this password securely with the recipient'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDownloadQR}
                  className="py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-white/5 flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  {lang === 'tr' ? 'İNDİR' : 'DOWNLOAD'}
                </button>
                {qrCodes.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    {lang === 'tr' ? 'TÜMÜNÜ İNDİR' : 'DOWNLOAD ALL'}
                  </button>
                )}
              </div>

              {/* Back Button */}
              <button
                onClick={() => {
                  setStep('password');
                  setQrCodes([]);
                  setQrPayload(null);
                  setCurrentQrIndex(0);
                }}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
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

export default ShareModal;
