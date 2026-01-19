/**
 * Aegis Vault - Import Shared Entry Modal Component
 * Modal for confirming and importing a shared password entry
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, QrCode, Shield, Lock, Eye, EyeOff, AlertCircle, Check, Loader2, Clock,
  Globe, CreditCard, FileText, Wallet, Fingerprint
} from 'lucide-react';
import {
  QRSharePayload,
  DecryptedShareEntry,
  Category,
  VaultEntry,
  SensitiveData
} from '../types';
import { ShareService } from '../services/shareService';
import { VaultService } from '../services/vaultService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../hooks/useVault';

interface ImportSharedEntryModalProps {
  payload: QRSharePayload;
  onClose: () => void;
  onImportSuccess?: () => void;
}

const ImportSharedEntryModal: React.FC<ImportSharedEntryModalProps> = ({
  payload,
  onClose,
  onImportSuccess
}) => {
  const { t, lang } = useLanguage();
  const { masterKey } = useAuth();
  const { addEntry } = useVault();

  const [step, setStep] = useState<'password' | 'preview' | 'importing'>('password');
  const [sharePassword, setSharePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [decryptedData, setDecryptedData] = useState<DecryptedShareEntry | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // Decrypt with share password
  const handleDecrypt = async () => {
    setError('');
    setIsImporting(true);

    try {
      const result = await ShareService.decryptSharePayload(
        payload,
        sharePassword,
        lang as 'tr' | 'en'
      );

      if (result.error) {
        setError(ShareService.getErrorMessage(result.error, lang as 'tr' | 'en'));
        setIsImporting(false);
        return;
      }

      if (result.data) {
        setDecryptedData(result.data);
        setStep('preview');
      }
    } catch (err) {
      console.error('Decrypt error:', err);
      setError(lang === 'tr' ? 'Şifre çözme hatası' : 'Decryption error');
    } finally {
      setIsImporting(false);
    }
  };

  // Import to vault
  const handleImport = async () => {
    if (!decryptedData || !masterKey) return;

    setIsImporting(true);
    setError('');

    try {
      // Check for duplicate
      const existingEntries = await VaultService.loadAllFromSQLite?.() || [];
      const isDuplicate = existingEntries.some((e: VaultEntry) =>
        e.title === decryptedData.title && e.username === decryptedData.username
      );

      if (isDuplicate) {
        setError(lang === 'tr'
          ? 'Bu vault\'unuzda zaten mevcut.'
          : 'This entry already exists in your vault.');
        setIsImporting(false);
        return;
      }

      // Import using VaultService
      await VaultService.saveEntry(
        {
          title: decryptedData.title,
          username: decryptedData.username,
          category: decryptedData.category,
          sensitive: decryptedData.sensitive,
          folderId: decryptedData.folderId,
          isFavorite: decryptedData.isFavorite
        },
        masterKey
      );

      setImportSuccess(true);
      setTimeout(() => {
        onImportSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Import error:', err);
      setError(lang === 'tr' ? 'İçe aktarma hatası' : 'Import error');
    } finally {
      setIsImporting(false);
    }
  };

  // Get category icon
  const getCategoryIcon = () => {
    switch (payload.metadata.category) {
      case Category.CARD: return <CreditCard size={24} />;
      case Category.NOTE: return <FileText size={24} />;
      case Category.FILE: return <FileText size={24} />;
      case Category.CRYPTO: return <Wallet size={24} />;
      case Category.PASSKEY: return <Fingerprint size={24} />;
      default: return <Globe size={24} />;
    }
  };

  // Get remaining time
  const remainingTime = ShareService.getRemainingTime(payload);

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
              {importSuccess ? <Check size={28} /> : <QrCode size={28} />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                {importSuccess
                  ? (lang === 'tr' ? 'İçe Aktarıldı' : 'Imported')
                  : (lang === 'tr' ? 'Şifreli Paylaşım' : 'Encrypted Share')
                }
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {importSuccess
                  ? (lang === 'tr' ? 'Başarılı' : 'Success')
                  : (lang === 'tr' ? 'QR ile Alınan' : 'Received via QR')
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
            disabled={importSuccess || isImporting}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {importSuccess ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-600/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={40} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                {lang === 'tr' ? 'Başarıyla İçe Aktarıldı' : 'Successfully Imported'}
              </h3>
              <p className="text-sm text-zinc-500">
                {decryptedData?.title}
              </p>
            </div>
          ) : step === 'password' && (
            <div className="space-y-6">
              {/* Share Info */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex gap-3">
                <Shield className="text-emerald-500 flex-shrink-0" size={20} />
                <div className="text-sm text-zinc-400">
                  {lang === 'tr' ? (
                    <>
                      <span className="font-bold text-white">Şifre Korumalı:</span> Bu paylaşımı
                      açmak için gönderen kişinin verdiği <span className="text-emerald-400">paylaşım şifresini</span> girin.
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-white">Password Protected:</span> Enter the
                      <span className="text-emerald-400"> sharing password</span> from the sender to unlock this share.
                    </>
                  )}
                </div>
              </div>

              {/* Entry Preview (Masked) */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600/10 text-emerald-500 rounded-xl flex items-center justify-center">
                    {getCategoryIcon()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">
                      {payload.metadata.titleHint}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
                      {payload.metadata.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
                    <Clock size={12} />
                    {remainingTime.hours}h {remainingTime.minutes}m
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest block pl-2">
                  {lang === 'tr' ? 'PAYLAŞIM ŞİFRESİ' : 'SHARING PASSWORD'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sharePassword.length >= 12 && handleDecrypt()}
                    placeholder={lang === 'tr' ? 'Paylaşım şifresini girin...' : 'Enter sharing password...'}
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-all pr-10"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* Decrypt Button */}
              <button
                onClick={handleDecrypt}
                disabled={isImporting || sharePassword.length < 12}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_20px_40px_rgba(16,185,129,0.3)] disabled:shadow-none flex items-center justify-center gap-3"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {lang === 'tr' ? 'ÇÖZÜLÜYOR...' : 'DECRYPTING...'}
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    {lang === 'tr' ? 'PAYLAŞIMI AÇ' : 'UNLOCK SHARE'}
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'preview' && decryptedData && (
            <div className="space-y-6">
              {/* Full Entry Preview */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-emerald-600/10 text-emerald-500 rounded-xl flex items-center justify-center">
                    {getCategoryIcon()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">
                      {decryptedData.title}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {decryptedData.username || (lang === 'tr' ? 'Kullanıcı adı yok' : 'No username')}
                    </div>
                  </div>
                </div>

                {/* Sensitive data preview */}
                {decryptedData.sensitive.password && (
                  <div className="space-y-2">
                    <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                      {lang === 'tr' ? 'ŞİFRE' : 'PASSWORD'}
                    </label>
                    <div className="px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl font-mono text-sm text-emerald-400 break-all">
                      {'•'.repeat(Math.min(decryptedData.sensitive.password.length, 20))}
                    </div>
                  </div>
                )}

                {decryptedData.sensitive.url && (
                  <div className="mt-3">
                    <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                      {lang === 'tr' ? 'URL' : 'URL'}
                    </label>
                    <div className="text-xs text-zinc-400 truncate">
                      {decryptedData.sensitive.url}
                    </div>
                  </div>
                )}
              </div>

              {/* Import Confirmation */}
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-3">
                <Shield className="text-blue-500 flex-shrink-0" size={20} />
                <div className="text-sm text-zinc-400">
                  {lang === 'tr' ? (
                    <>
                      Bu girdiyi kendi vault'unuza eklemek üzeresiniz.
                      Şifre <span className="text-blue-400">master key'inizle</span> şifrelenecek.
                    </>
                  ) : (
                    <>
                      You are about to add this entry to your vault.
                      It will be encrypted with your <span className="text-blue-400">master key</span>.
                    </>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setStep('password');
                    setDecryptedData(null);
                    setError('');
                  }}
                  disabled={isImporting}
                  className="py-3 bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  {lang === 'tr' ? 'İPTAL' : 'CANCEL'}
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {lang === 'tr' ? 'EKLENİYOR...' : 'ADDING...'}
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      {lang === 'tr' ? 'İÇE AKTAR' : 'IMPORT'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ImportSharedEntryModal;
