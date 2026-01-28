
// Fixed missing React namespace import
import React, { useState, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Trash2, Copy, Check, Eye, EyeOff, Globe, CreditCard,
  FileText, Download, CheckSquare, Square, RotateCcw, ShieldAlert, Wallet, Fingerprint, Shield, Share as ShareIcon, Hash
} from 'lucide-react';
import { VaultEntry, SensitiveData, Category } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { PasskeyService } from '../../services/passkeyService';
import { BiometricService } from '../../services/biometricService';
import { TagService } from '../../services/tagService';
import ShareModal from './ShareModal';

interface PasswordCardProps {
  entry: VaultEntry;
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onToggleFavorite: () => void;
  onDecrypt: () => Promise<SensitiveData>;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  isSelectionMode?: boolean;
}

const PasswordCard: React.FC<PasswordCardProps> = memo(({
  entry, onEdit, onDelete, onRestore, onPermanentDelete, onToggleFavorite, onDecrypt,
  isSelected, onSelect, isSelectionMode
}) => {
  const { t, lang } = useLanguage();
  const [isRevealed, setIsRevealed] = useState(false);
  const [sensitiveData, setSensitiveData] = useState<SensitiveData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSensitiveData, setShareSensitiveData] = useState<SensitiveData | null>(null);

  const isDeleted = entry.deletedAt !== undefined;

  const handleCopy = async (field: 'username' | 'password') => {
    let textToCopy = '';
    const sensitive = await onDecrypt();
    if (field === 'username') textToCopy = entry.username;
    else textToCopy = sensitive.password || '';

    if ((window as any).electronAPI) {
      (window as any).electronAPI.copyToClipboard(textToCopy, 45000);
    } else {
      navigator.clipboard.writeText(textToCopy);
    }

    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const sensitive = await onDecrypt();
      if (!sensitive.fileBlob) throw new Error("No file content");

      let blob: Blob;
      if (sensitive.fileBlob instanceof Uint8Array) {
        // New Binary Way (Efficient)
        blob = new Blob([sensitive.fileBlob], { type: sensitive.fileMime || 'application/octet-stream' });
      } else {
        // Legacy Base64 Way (Compatibility)
        const byteCharacters = atob(sensitive.fileBlob as string);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: sensitive.fileMime || 'application/octet-stream' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sensitive.fileName || `aegis_secure_file_${entry.id}.bin`;
      document.body.appendChild(a);
      a.click();

      // Cleanup with delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err: any) {
      console.error("Download failed:", err);
      alert(lang === 'tr' ? `Dosya indirme başarısız: ${err.message}` : `Download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const [isSigning, setIsSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);

  const handleSignChallenge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sensitiveData?.passkeyDetails) return;

    setIsSigning(true);
    try {
      // Require biometric approval for signing
      const isVerified = await BiometricService.verifyUser();
      if (!isVerified) {
        setIsSigning(false);
        return;
      }

      // Simulate a challenge from a server
      const challenge = new TextEncoder().encode('aegis-vault-challenge-' + Date.now()).buffer;
      const assertion = await PasskeyService.signChallenge(sensitiveData.passkeyDetails, challenge);

      console.log('[Passkey] Signed Assertion:', assertion);

      setSignSuccess(true);
      setTimeout(() => setSignSuccess(false), 3000);
    } catch (err) {
      console.error("Passkey signing failed:", err);
    } finally {
      setIsSigning(false);
    }
  };

  const toggleReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Toggle Reveal', entry.category);
    if (isRevealed) {
      setIsRevealed(false);
      setSensitiveData(null);
      setIsFlipped(false);
    } else {
      try {
        const sensitive = await onDecrypt();
        console.log('Decrypted:', sensitive);
        setSensitiveData(sensitive);
        setIsRevealed(true);
      } catch (e) {
        console.error("Failed to decrypt for reveal", e);
      }
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const sensitive = await onDecrypt();
      setShareSensitiveData(sensitive);
      setIsShareModalOpen(true);
    } catch (e) {
      console.error("Failed to decrypt for share", e);
    }
  };

  const styles = useMemo(() => {
    const isDark = !document.documentElement.classList.contains('light-mode');

    switch (entry.category) {
      case Category.CARD:
      case 'Credit Card': // Added fallback for string literal
        return {
          bg: isDark ? 'bg-gradient-to-br from-[#1e1e21] to-[#0a0a0b]' : 'bg-gradient-to-br from-zinc-50 to-white',
          border: 'border-amber-500/10 group-hover:border-amber-500/40',
          iconBg: 'bg-amber-500/10 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
          accent: 'text-amber-500'
        };
      case Category.NOTE:
        return {
          bg: isDark ? 'bg-gradient-to-br from-[#0d1e18] to-[#030712]' : 'bg-gradient-to-br from-emerald-50 to-white',
          border: 'border-emerald-500/10 group-hover:border-emerald-500/40',
          iconBg: 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
          accent: 'text-emerald-500'
        };
      case Category.FILE:
        return {
          bg: isDark ? 'bg-gradient-to-br from-[#14143a] to-[#0a0a0b]' : 'bg-gradient-to-br from-indigo-50 to-white',
          border: 'border-indigo-500/10 group-hover:border-indigo-500/40',
          iconBg: 'bg-indigo-500/10 text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
          accent: 'text-indigo-500'
        };
      case Category.CRYPTO:
        return {
          bg: isDark ? 'bg-gradient-to-br from-[#2e1065] to-[#020617]' : 'bg-gradient-to-br from-purple-50 to-white',
          border: 'border-purple-500/10 group-hover:border-purple-500/40',
          iconBg: 'bg-purple-500/10 text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.1)]',
          accent: 'text-purple-500'
        };
      case Category.PASSKEY:
        return {
          bg: isDark ? 'bg-gradient-to-br from-[#1e1b4b] to-[#020617]' : 'bg-gradient-to-br from-indigo-50 to-white',
          border: 'border-indigo-500/10 group-hover:border-indigo-500/40',
          iconBg: 'bg-indigo-500/10 text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
          accent: 'text-indigo-500'
        };
      default: // LOGIN
        return {
          bg: isDark ? 'bg-gradient-to-br from-[#0f172a] to-[#020617]' : 'bg-gradient-to-br from-blue-50 to-white',
          border: 'border-blue-500/10 group-hover:border-blue-500/40',
          iconBg: 'bg-blue-600/10 text-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.1)]',
          accent: 'text-blue-500'
        };
    }
  }, [entry.category]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group w-full h-[210px] cursor-pointer perspective-1000`}
      onClick={() => isSelectionMode ? onSelect?.(entry.id) : onEdit()}
    >
      {/* Selection Overlay */}
      {(isSelectionMode || isSelected) && (
        <div className="absolute top-4 left-4 z-20">
          {isSelected ? (
            <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-2xl border border-blue-400/20"><CheckSquare size={18} /></div>
          ) : (
            <div className="bg-black/20 backdrop-blur-md text-white/40 p-1.5 rounded-xl border border-white/10"><Square size={18} /></div>
          )}
        </div>
      )}

      {/* Main Card Surface - Removing overflow-hidden for 3D elements */}
      <div className={`w-full h-full rounded-[2.5rem] border ${styles.border} ${styles.bg} p-6 flex flex-col justify-between transition-all duration-500 shadow-xl group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] dark:group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)] group-hover:-translate-y-2 relative`}>
        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
          {/* Premium Ambient Light */}
          <div className={`absolute -right-16 -top-16 w-32 h-32 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity rounded-full ${styles.accent.replace('text-', 'bg-')}`} />
        </div>

        <div className="flex justify-between items-start z-10">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${styles.iconBg}`}>
            {entry.category === Category.LOGIN && <Globe size={22} />}
            {entry.category === Category.CARD && <CreditCard size={22} />}
            {entry.category === Category.NOTE && <FileText size={22} />}
            {entry.category === Category.FILE && <Download size={22} />}
            {entry.category === Category.CRYPTO && <Wallet size={22} />}
            {entry.category === Category.PASSKEY && <Fingerprint size={22} />}
          </div>

          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
            {!isDeleted ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className={`p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors ${entry.isFavorite ? 'text-amber-400' : 'text-zinc-500'}`}>
                  <Star size={16} fill={entry.isFavorite ? "currentColor" : "none"} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 rounded-xl bg-red-500/5 hover:bg-red-500/20 text-red-500/60 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </>
            ) : (
              <>
                <button onClick={(e) => { e.stopPropagation(); onRestore?.(); }} className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all" title={t('restore')}>
                  <RotateCcw size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onPermanentDelete?.(); }} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all" title={t('permanent_delete')}>
                  <ShieldAlert size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 z-10 flex-1 flex flex-col justify-center overflow-hidden">
          <h3 className="font-black text-sm text-main truncate tracking-tighter uppercase mb-1 transition-colors group-hover:text-white">
            {entry.title}
          </h3>
          <p className="text-[11px] text-dim truncate font-bold uppercase tracking-[0.15em] opacity-40 group-hover:opacity-80 transition-opacity">
            {entry.username || (
              entry.category === Category.LOGIN ? t('cat_login') :
                entry.category === Category.CARD ? t('cat_card') :
                  entry.category === Category.NOTE ? t('cat_note') :
                    entry.category === Category.FILE ? t('cat_file') :
                      entry.category === Category.CRYPTO ? t('cat_crypto') :
                        entry.category === Category.PASSKEY ? t('cat_passkey') : '---'
            )}
          </p>
          {/* Tags Display */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.tags.filter(tag => tag && tag.trim()).slice(0, 3).map((tag, index) => {
                const colorClass = TagService.getTagColor(tag);
                return (
                  <span
                    key={`tag-${tag}-${index}`}
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-wider border ${colorClass}`}
                  >
                    <Hash size={8} />
                    {tag}
                  </span>
                );
              })}
              {entry.tags.filter(tag => tag && tag.trim()).length > 3 && (
                <span className="text-[7px] font-bold uppercase tracking-wider text-zinc-500">
                  +{entry.tags.filter(tag => tag && tag.trim()).length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between z-10 border-t border-white/5 pt-4">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-12 bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${entry.securityScore || 50}%` }}
                className={`h-full ${styles.accent.replace('text-', 'bg-')}`}
              />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-dim">{entry.securityScore || 0}%</span>
          </div>

          {!isDeleted && (
            <div className="flex gap-3">
              {entry.category === Category.FILE && (
                <button onClick={handleDownload} className="text-zinc-500 hover:text-main transition-all hover:scale-110 active:scale-90" disabled={isDownloading}>
                  <Download size={16} className={isDownloading ? "animate-bounce text-blue-500" : ""} />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy('username'); }}
                className={`transition-all hover:scale-110 active:scale-90 ${copiedField === 'username' ? 'text-blue-400' : 'text-zinc-500 hover:text-main'}`}
                title={t('copy_username')}
              >
                {copiedField === 'username' ? <Check size={16} /> : <Copy size={16} className="opacity-50" />}
              </button>
              <button onClick={toggleReveal} className="text-zinc-500 hover:text-main transition-all hover:scale-110 active:scale-90">
                {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={handleShare} className="text-zinc-500 hover:text-main transition-all hover:scale-110 active:scale-90" title={lang === 'tr' ? 'QR ile Paylaş' : 'Share via QR'}>
                <ShareIcon size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleCopy('password'); }} className="text-zinc-500 hover:text-main transition-all hover:scale-110 active:scale-90">
                {copiedField === 'password' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* Reveal Overlay - Standard types are inline, Crypto uses a specialized Modal */}
        <AnimatePresence>
          {isRevealed && sensitiveData && (
            entry.category === Category.CRYPTO ? (
              <motion.div
                key="crypto-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
                onClick={() => setIsRevealed(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="w-full max-w-lg bg-[#0a0a0b] border border-purple-500/30 rounded-[3rem] p-8 text-left shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden my-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full" />

                  <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6 relative z-10">
                    <div className="w-14 h-14 bg-purple-600/10 text-purple-500 rounded-3xl flex items-center justify-center shadow-inner flex-shrink-0">
                      <Wallet size={28} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none truncate">{sensitiveData.cryptoDetails?.network || t('cat_crypto')}</h3>
                      <p className="text-[10px] text-purple-500 font-bold uppercase tracking-[0.2em] mt-2 opacity-80">Secure Wallet Data</p>
                    </div>
                  </div>

                  <div className="space-y-6 relative z-10 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-2">
                      <label className="text-[9px] text-zinc-600 uppercase tracking-widest font-black block pl-2">{t('crypto_address')}</label>
                      <div className="p-4 bg-black/40 rounded-2xl border border-white/5 font-mono text-[10px] text-zinc-300 break-all leading-relaxed shadow-inner group/addr">
                        {sensitiveData.cryptoDetails?.address}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] text-amber-500 uppercase tracking-widest font-black block pl-2">{t('crypto_seed')}</label>
                      <div className="p-4 bg-amber-500/[0.03] rounded-2xl border border-amber-500/10 font-mono text-xs text-amber-500/90 break-words leading-relaxed select-all shadow-inner font-bold">
                        {sensitiveData.cryptoDetails?.seed}
                      </div>
                    </div>

                    {sensitiveData.cryptoDetails?.privateKey && (
                      <div className="space-y-2">
                        <label className="text-[9px] text-rose-500 uppercase tracking-widest font-black block pl-2">{t('crypto_private_key')}</label>
                        <div className="p-4 bg-rose-500/[0.03] rounded-2xl border border-rose-500/10 font-mono text-[10px] text-rose-400 break-all select-all shadow-inner">
                          {sensitiveData.cryptoDetails.privateKey}
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setIsRevealed(false)} className="mt-8 w-full py-4 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_20px_40px_rgba(147,51,234,0.3)]">
                    {t('hide_wallet')}
                  </button>
                </motion.div>
              </motion.div>
            ) : entry.category === Category.PASSKEY ? (
              <motion.div
                key="passkey-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center text-center rounded-[2.5rem] p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-full space-y-4 text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
                      <Fingerprint size={20} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{t('cat_passkey')}</h4>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">WebAuthn Registry</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[7px] text-zinc-600 font-black uppercase tracking-widest block mb-1 pl-1">{t('passkey_rp_id')}</label>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-white font-mono break-all group/pkrp">
                        {sensitiveData.passkeyDetails?.rpId}
                      </div>
                    </div>
                    <div>
                      <label className="text-[7px] text-zinc-600 font-black uppercase tracking-widest block mb-1 pl-1">{t('passkey_display_name')}</label>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-indigo-400 font-bold uppercase tracking-tighter">
                        {sensitiveData.passkeyDetails?.displayName}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[7px] text-zinc-600 font-black uppercase tracking-widest block mb-1 pl-1">{t('passkey_sign_count')}</label>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-white font-mono">
                          {sensitiveData.passkeyDetails?.signCount}
                        </div>
                      </div>
                      <div>
                        <label className="text-[7px] text-zinc-600 font-black uppercase tracking-widest block mb-1 pl-1">{t('passkey_created_at')}</label>
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-white font-mono">
                          {new Date(sensitiveData.passkeyDetails?.createdAt || 0).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-2">
                    <button
                      onClick={handleSignChallenge}
                      disabled={isSigning}
                      className={`w-full py-3 ${signSuccess ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2`}
                    >
                      {isSigning ? <RotateCcw size={14} className="animate-spin" /> :
                        signSuccess ? <Check size={14} /> : <Shield size={14} />}
                      {signSuccess ? (lang === 'tr' ? 'DOĞRULANDI' : 'SIGNED') : (lang === 'tr' ? 'TEST İMZASI' : 'TEST SIGN')}
                    </button>
                    <button onClick={() => setIsRevealed(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-white/5">
                      {t('abort')}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="inline-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center text-center rounded-[2.5rem]"
                onClick={(e) => e.stopPropagation()}
              >
                {(entry.category === Category.CARD || entry.category === 'Credit Card') ? (
                  <div className="relative w-full h-full p-4 perspective-1000 flex flex-col">
                    <motion.div
                      className={`relative w-full flex-1 rounded-2xl shadow-xl transition-transform duration-700 ${isFlipped ? 'rotate-y-180' : ''}`}
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* Front: Reverted to old design */}
                      <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <CreditCard size={24} className="text-amber-400" />
                          <span className="text-xs font-mono text-zinc-400">{sensitiveData.cardDetails?.number?.slice(-4) || '****'}</span>
                        </div>
                        <div className="text-left">
                          <p className="text-white text-lg font-bold tracking-wider mb-1">{sensitiveData.cardDetails?.number?.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') || '**** **** **** ****'}</p>
                          <div className="flex justify-between text-zinc-400 text-xs">
                            <span>{sensitiveData.cardDetails?.holder || 'CARD HOLDER'}</span>
                            <span>{sensitiveData.cardDetails?.expiry || 'MM/YY'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Back: Reverted to old design */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
                        <div className="h-10 bg-black mt-4 rounded" />
                        <div className="flex justify-end items-center mt-4">
                          <span className="bg-zinc-700 text-white text-xs px-2 py-1 rounded">{sensitiveData.cardDetails?.cvv || '***'}</span>
                        </div>
                        <p className="text-zinc-400 text-xs text-center mt-2">
                          {t('card_security_code_info')}
                        </p>
                      </div>
                    </motion.div>
                    <div className="mt-4 flex gap-3 justify-center w-full relative z-50">
                      <button onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-[10px] font-black text-white uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg active:scale-95">
                        <RotateCcw size={14} />
                        {lang === 'tr' ? (isFlipped ? 'ÖN YÜZ' : 'ARKA YÜZ') : (isFlipped ? 'FRONT' : 'BACK')}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setIsRevealed(false); }} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-[10px] font-black text-red-400 uppercase tracking-[0.3em] rounded-xl transition-all border border-red-500/20">
                        {t('abort')}
                      </button>
                    </div>
                  </div>
                ) : entry.category === Category.NOTE ? (
                  <div className="w-full h-full p-4 flex flex-col justify-center items-center">
                    <div className="bg-black/60 border border-white/5 rounded-2xl p-4 font-bold text-sm text-zinc-300 whitespace-pre-wrap text-left flex-1 w-full overflow-y-auto custom-scrollbar leading-relaxed shadow-inner">
                      {sensitiveData.notes}
                    </div>
                    <button onClick={() => setIsRevealed(false)} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-[10px] font-black text-white uppercase tracking-[0.3em] rounded-xl transition-all">{t('abort')}</button>
                  </div>
                ) : (
                  <div className="w-full max-w-[85%] space-y-3">
                    {/* Username Section */}
                    <div className="relative group/field">
                      <label className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1 block pl-2">{t('username')}</label>
                      <div className="flex items-center gap-2 p-3 bg-white/[0.03] rounded-2xl border border-white/10 group-hover/field:border-blue-500/30 transition-all">
                        <span className="text-[11px] font-bold text-zinc-300 truncate flex-1 uppercase tracking-wider">
                          {entry.username || '---'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy('username'); }}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-blue-400 transition-all"
                        >
                          {copiedField === 'username' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Password Section */}
                    <div className="relative group/field">
                      <label className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1 block pl-2">{t('password')}</label>
                      <div className="flex items-center gap-2 p-3 bg-white/[0.03] rounded-2xl border border-white/10 group-hover/field:border-emerald-500/30 transition-all">
                        <span className="text-[11px] font-mono text-emerald-400 flex-1 truncate select-all">
                          {sensitiveData.password || '••••••••'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy('password'); }}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-emerald-400 transition-all"
                        >
                          {copiedField === 'password' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button onClick={(e) => { e.stopPropagation(); setIsRevealed(false); }} className="w-full py-3 bg-white/5 hover:bg-white/10 text-[9px] font-black text-white uppercase tracking-[0.3em] rounded-xl transition-all border border-white/5 active:scale-95">
                        {t('abort')}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* Share Modal - Rendered via Portal to bypass perspective-1000 constraint */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {isShareModalOpen && shareSensitiveData && (
              <ShareModal
                entry={entry}
                decryptedData={shareSensitiveData}
                onClose={() => {
                  setIsShareModalOpen(false);
                  setShareSensitiveData(null);
                }}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </motion.div>
  );
});

export default PasswordCard;
