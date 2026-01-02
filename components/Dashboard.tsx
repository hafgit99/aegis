import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Star, ShieldAlert, Settings, LogOut,
  Menu, ChevronLeft, Search, Plus,
  Lock, AlertTriangle, X,
  Trash2, Globe, CheckCircle2,
  Smartphone, Key, Zap, Languages, Database, CreditCard, FileText, Download, Fingerprint, Moon, Sun,
  ChevronUp, SortAsc, SortDesc, Filter, CheckSquare, Square, Check, Copy, Loader2, ShieldCheck,
  RotateCcw, Flame, Clock, Calendar, ShieldX, Crown, Gem, Award, ChevronRight, Eye, MoreVertical, SlidersHorizontal, RefreshCw, Folder, BookOpen, Hourglass
} from 'lucide-react';
import { VaultEntry, SensitiveData, Category } from '../types.ts';
import { AutoLockStatus } from '../hooks/useAutoLock.ts';
import ImageBrandIcon from './ImageBrandIcon.tsx';
import EntryForm from './EntryForm.tsx';
import SecurityAudit from './SecurityAudit.tsx';
import TwoFactorSetup from './TwoFactorSetup.tsx';
import PortabilityWizard from './PortabilityWizard.tsx';
import PasswordGenerator from './PasswordGenerator.tsx';
import PasswordCard from './PasswordCard.tsx';
import SkeletonCard from './SkeletonCard.tsx';
import LicensingView from './LicensingView.tsx';
import ChangeMasterKeyModal from './ChangeMasterKeyModal.tsx';
import LegalModal from './LegalModal.tsx';
import UserGuideModal from './UserGuideModal.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { useVault } from '../hooks/useVault.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import { LicensingService } from '../services/licensingService.ts';
import { BiometricService } from '../services/biometricService.ts';
import { RecoveryService } from '../services/recoveryService.ts';
import { useTheme } from '../contexts/ThemeContext.tsx';

type SortOrder = 'title_asc' | 'title_desc' | 'recent';

const RecoveryWordsView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, lang } = useLanguage();
  const { masterKey, withMasterKeyRaw } = useAuth();
  const [words, setWords] = useState<string[]>([]);
  const [pin, setPin] = useState<string>('');
  const [checksum, setChecksum] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [stage, setStage] = useState<'setup' | 'verify' | 'complete'>('setup');
  const [pinProtection, setPinProtection] = useState(false);
  const [userWords, setUserWords] = useState<string[]>(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);

  const handleGenerate = async () => {
    if (!masterKey) return;
    setIsGenerating(true);
    setError('');
    try {
      // SECURITY: Access raw key safely for temporary extraction during setup
      await withMasterKeyRaw(async (rawKey) => {
        const result = await RecoveryService.setupRecovery(rawKey, pinProtection);
        setWords(result.words);
        setPin(result.pin || '');
        setChecksum(result.checksum);
        setStage('verify');
      });
    } catch (err: any) {
      setError(err.message || (lang === 'tr' ? "Anahtar oluşturma başarısız." : "Failed to generate key."));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyAll = () => {
    if (words.length > 0) {
      navigator.clipboard.writeText(words.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyPin = () => {
    if (pin) {
      navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerifyWords = async () => {
    const validation = RecoveryService.validateRecoveryWords(userWords);
    if (!validation.valid) {
      setError(validation.errors.join('; '));
      return;
    }

    setError('');
    setStage('complete');
  };

  const handleExportRecovery = () => {
    try {
      const jsonData = RecoveryService.exportRecoveryAsJSON();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aegis-recovery-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportAsPDF = () => {
    try {
      const date = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US');
      const time = new Date().toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US');

      // Create HTML content for PDF
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Aegis Vault - Kurtarma Kelimeleri</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { text-align: center; color: #333; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; color: #856404; }
    .words-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 30px 0; }
    .word-item { background: #f8f9fa; padding: 15px; border: 1px solid #dee2e6; border-radius: 5px; font-family: monospace; text-align: center; }
    .word-number { color: #666; font-size: 12px; margin-bottom: 5px; }
    .word-text { font-size: 18px; font-weight: bold; color: #333; }
    .checksum-box { background: #e3f2fd; border: 1px solid #2196f3; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .checksum-label { color: #1976d2; font-weight: bold; margin-bottom: 5px; }
    .checksum-value { font-family: monospace; color: #333; word-break: break-all; }
    .instructions { background: #f0f7f4; border: 1px solid #4caf50; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .instructions h3 { color: #2e7d32; margin-top: 0; }
    .instructions ol { margin-left: 20px; }
    .instructions li { margin: 8px 0; }
    .footer { text-align: center; color: #999; margin-top: 30px; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
    .date-time { text-align: right; color: #666; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Aegis Vault - Kurtarma Kelimeleri</h1>
    <div class="subtitle">Aegis Vault Password Manager - Recovery Words Backup</div>
    <div class="date-time">${lang === 'tr' ? 'Oluşturulma Tarihi' : 'Created'}: ${date} ${time}</div>
    
    <div class="warning">
      <strong>⚠️ ${lang === 'tr' ? 'ÖNEMLİ' : 'IMPORTANT'}:</strong> ${lang === 'tr'
          ? 'Bu sayfayı GÜVENLİ BİR YERDE SAKLAYIN. Bu 16 kelime, master şifrenizi unuttuğunuzda kasanızı kurtarmanın TEK yoludur.'
          : 'KEEP THIS DOCUMENT IN A SAFE PLACE. These 16 words are the ONLY way to recover your vault if you forget your master password.'}
    </div>

    <h2 style="color: #333; text-align: center;">${lang === 'tr' ? 'Kurtarma Kelimeleri (16 Sözcük)' : 'Recovery Words (16 Words)'}</h2>
    <div class="words-grid">
      ${words.map((word, i) => `
        <div class="word-item">
          <div class="word-number">${i + 1}.</div>
          <div class="word-text">${word}</div>
        </div>
      `).join('')}
    </div>

    <div class="checksum-box">
      <div class="checksum-label">${lang === 'tr' ? 'Doğrulama Sağlama Toplamı (Verification Checksum)' : 'Verification Checksum'}:</div>
      <div class="checksum-value">${checksum}</div>
      <div style="font-size: 12px; color: #666; margin-top: 10px;">${lang === 'tr'
          ? 'Kelimelerinizi doğrulamak için bu sağlama toplamını kullanın.'
          : 'Use this checksum to verify your words.'}</div>
    </div>

    <div class="instructions">
      <h3>${lang === 'tr' ? '📝 Talimatlar' : '📝 Instructions'}</h3>
      <ol>
        <li>${lang === 'tr'
          ? 'Bu sayfayı YAZDIRIN ve güvenli bir yerde saklayın (kasa, safe vb.)'
          : 'PRINT this document and keep it in a safe place (safe, safety deposit box, etc.)'}</li>
        <li>${lang === 'tr'
          ? 'Veya: Bu belgeyi şifrelenmiş bir dosya olarak kaydedin ve offline yedekleyin'
          : 'Or: Save this document as an encrypted file and back up offline'}</li>
        <li>${lang === 'tr'
          ? 'Kelimelerin sırasını KESINLIKLE değiştirmeyin'
          : 'DO NOT change the order of the words'}</li>
        <li>${lang === 'tr'
          ? 'Master şifrenizi unuttuğunuzda, bu kelimeleri kullanarak kasanızı kurtarabilirsiniz'
          : 'If you forget your master password, use these words to recover your vault'}</li>
        <li>${lang === 'tr'
          ? 'Bu belgeyi ASLA e-mail veya bulut depolamada saklamayın'
          : 'NEVER store this document in email or cloud storage'}</li>
      </ol>
    </div>

    <div class="footer">
      <p>Aegis Vault ${lang === 'tr' ? 'Kurtarma Kelimesi Yedeklemesi' : 'Recovery Words Backup'}</p>
      <p>${lang === 'tr'
          ? 'Bu belge önemli bilgiler içermektedir. Lütfen güvenli bir yerde saklayınız.'
          : 'This document contains important information. Please keep it in a safe place.'}</p>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      window.print();
    });
  </script>
</body>
</html>
      `;

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aegis-recovery-words-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass p-12 rounded-[3.5rem] border border-amber-500/20 max-w-2xl w-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/10">
            <Key size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{t('recovery_words')}</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">v4.0 - Enhanced Recovery</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 mb-6"
        >
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>
        </motion.div>
      )}

      {stage === 'setup' && (
        <div className="space-y-6">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
            {lang === 'tr'
              ? "Kurtarma kelimeleri, master şifrenizi unuttuğunuz durumda kasanızı geri yüklemek için kullanılır. Lütfen bu kelimeleri güvenli bir yerde saklayın."
              : "Recovery words are used to restore your vault if you forget your master password. Please store them in a safe place."}
          </p>

          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl cursor-pointer hover:bg-blue-500/20 transition-all">
              <input
                type="checkbox"
                checked={pinProtection}
                onChange={(e) => setPinProtection(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                {lang === 'tr' ? 'PIN Koruması Ekle (4-6 Rakam)' : 'Add PIN Protection (4-6 Digits)'}
              </span>
            </label>

            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest px-2">
              {lang === 'tr'
                ? 'PIN koruması kurtarma anahtarlarını ek bir koruma katmanı ile şifreler.'
                : 'PIN protection adds an extra layer of security to your recovery keys.'}
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
          >
            {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Key size={16} />}
            {lang === 'tr' ? 'KURTARMAKeliMELERİ OLUŞTUR' : 'GENERATE RECOVERY WORDS'}
          </button>
        </div>
      )}

      {stage === 'verify' && words.length > 0 && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mb-4">
              {lang === 'tr' ? '⚠️ ÖNEMLİ - BU KELİMELERİ YAZIN VE GÜVENLİ BİR YERDE SAKLAYIN' : '⚠️ IMPORTANT - WRITE DOWN AND SAVE THESE WORDS'}
            </p>

            <div className="grid grid-cols-4 gap-2 mb-6">
              {words.map((w, i) => (
                <div key={i} className="p-3 bg-black/40 border border-white/5 rounded-xl font-mono text-xs text-zinc-300 flex items-center justify-between">
                  <span>{i + 1}.</span>
                  <span className="font-bold">{w}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={handleCopyAll}
                className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                  }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {lang === 'tr' ? 'Tümünü Kopyala' : 'Copy All'}
              </button>
              <button
                onClick={handleExportAsPDF}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Download size={14} />
                {lang === 'tr' ? 'PDF/Yazıyla İndir' : 'Export as PDF'}
              </button>
              <button
                onClick={handleExportRecovery}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Download size={14} />
                {lang === 'tr' ? 'Yedek (JSON)' : 'Backup (JSON)'}
              </button>
            </div>

            <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Checksum (Verification):</p>
              <p className="font-mono text-[11px] text-blue-400">{checksum}</p>
            </div>

            {pin && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mb-2">PIN Koruması Aktif</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pin}
                    readOnly
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/5 rounded-xl font-mono text-sm text-white"
                  />
                  <button
                    onClick={handleCopyPin}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition-all"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleVerifyWords}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-600/20"
          >
            {lang === 'tr' ? 'Kelimeleri Doğrula' : 'Verify Words'}
          </button>
        </div>
      )}

      {stage === 'complete' && (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
            <CheckCircle2 size={48} />
          </div>
          <div>
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
              {lang === 'tr' ? 'Başarılı!' : 'Success!'}
            </h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              {lang === 'tr'
                ? 'Kurtarma anahtarlarınız güvenli bir şekilde ayarlandı. Kelimeleri güvenli bir yerde saklayın.'
                : 'Your recovery keys have been set up successfully. Keep the words in a safe place.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-600/20"
          >
            {lang === 'tr' ? 'Kapat' : 'Close'}
          </button>
        </div>
      )}
    </motion.div>
  );
};

const Dashboard: React.FC<{ onLogout: () => void; lockStatus?: AutoLockStatus; }> = ({ onLogout, lockStatus }) => {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { entries, folders, saveEntry, deleteEntry, restoreEntry, permanentDelete, decryptData, loadEntries, toggleFavorite } = useVault();
  const { masterKey } = useAuth();

  const [activeTab, setActiveTab] = useState<'vault' | 'favorites' | 'audit' | 'generator' | 'settings' | 'trash'>('vault');
  const [activeCat, setActiveCat] = useState<Category | 'All'>('All');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'security' | 'data'>('general');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ entry: VaultEntry; sensitive: SensitiveData } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showPortability, setShowPortability] = useState(false);
  const [showLicensing, setShowLicensing] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showChangeMasterKey, setShowChangeMasterKey] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [legalDocType, setLegalDocType] = useState<'terms' | 'privacy'>('terms');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);

  const [showResetConfirm, setShowResetConfirm] = useState<{ type: 'vault' | 'settings' | 'factory', confirmText: string } | null>(null);

  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBioEnabled, setIsBioEnabled] = useState(BiometricService.isEnabled());
  const [isLocking, setIsLocking] = useState(false);

  const handleLogout = async () => {
    setIsLocking(true);
    try {
      await onLogout();
    } catch (e) {
      setIsLocking(false);
    }
  };
  const [lockOnBg, setLockOnBg] = useState(localStorage.getItem('aegis_lock_on_bg') === 'true');
  const [autoLockDuration, setAutoLockDuration] = useState(parseInt(localStorage.getItem('aegis_autolock_ms') || '900000'));

  const isPro = LicensingService.isPro();
  const isExpired = LicensingService.isTrialExpired();
  const remainingDays = LicensingService.getRemainingTrialDays();

  // Sekme değiştirildiğinde tüm engelleyici arayüz elemanlarını temizle
  useEffect(() => {
    setIsAdding(false);
    setShowLicensing(false);
    setShowPortability(false);
    setShow2FASetup(false);
    setShowRecovery(false);
    setIsFilterOpen(false);
    setEditingEntry(null);
    setShowResetConfirm(null);
    setCurrentFolderId(null);
  }, [activeTab]);

  // Yeni sekme seçildiğinde sayfayı en yukarı kaydır
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  useEffect(() => {
    loadEntries().then(() => setIsLoading(false));
    BiometricService.isSupported().then(setIsBiometricAvailable);
  }, [loadEntries]);

  const toggleBiometrics = async () => {
    if (!masterKey) return;
    try {
      if (isBioEnabled) {
        BiometricService.disable();
        setIsBioEnabled(false);
      } else {
        await BiometricService.enableBiometrics(masterKey);
        setIsBioEnabled(true);
      }
    } catch (e) {
      alert(t('biometric_policy_error'));
    }
  };

  const handleAutoLockChange = (ms: number) => {
    setAutoLockDuration(ms);
    localStorage.setItem('aegis_autolock_ms', ms.toString());
  };

  const toggleLockOnBg = () => {
    const next = !lockOnBg;
    setLockOnBg(next);
    localStorage.setItem('aegis_lock_on_bg', next.toString());
  };

  const { resetVault } = useVault();

  const triggerPanic = useCallback(() => {
    try {
      navigator.clipboard.writeText('');
    } catch (e) { }
    onLogout();
  }, [onLogout]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Daha sağlam kontrol: Ctrl+Shift+X veya F12
      const isCtrlShiftX = e.ctrlKey && e.shiftKey && (e.key === 'x' || e.key === 'X' || e.code === 'KeyX');
      const isF12 = e.key === 'F12';

      if (isCtrlShiftX || isF12) {
        e.preventDefault();
        e.stopPropagation();
        triggerPanic();
      }
    };
    // Capture phase (true) kullanarak diğer bileşenlerin engellemesini önleyelim
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [triggerPanic]);

  const performReset = async () => {
    if (!showResetConfirm) return;

    const requiredText = lang === 'tr' ? 'SIFIRLA' : 'RESET';
    if (showResetConfirm.confirmText !== requiredText) {
      alert(t('invalid_confirm'));
      setShowResetConfirm(null);
      return;
    }

    if (showResetConfirm.type === 'vault') {
      await resetVault();
    } else if (showResetConfirm.type === 'settings') {
      const keysToKeep = ['aegis_license_data', 'aegis_install_date', 'aegis_vault_initialized'];
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('aegis_') && !keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      window.location.reload();
    } else if (showResetConfirm.type === 'factory') {
      await resetVault();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('aegis_')) {
          localStorage.removeItem(key);
        }
      });
      window.location.reload();
    }

    setShowResetConfirm(null);
  };

  const handleEditEntry = useCallback(async (entry: VaultEntry) => {
    if (isExpired && !isPro) return;
    try {
      const sensitive = await decryptData(entry);
      setEditingEntry({ entry, sensitive });
      setIsAdding(true);
    } catch (e) { console.error(e); }
  }, [decryptData, isExpired, isPro]);

  const relevantFolders = useMemo(() => {
    if (activeTab !== 'favorites' && activeTab !== 'vault') return [];

    if (activeTab === 'favorites') {
      const favFolderIds = new Set(entries.filter(e => e.isFavorite && !e.deletedAt).map(e => e.folderId).filter(Boolean));
      return folders.filter(f => favFolderIds.has(f.id));
    }

    return folders;
  }, [folders, entries, activeTab]);

  const processedEntries = useMemo(() => {
    let list = [...entries].filter(e => activeTab === 'trash' ? e.deletedAt !== undefined : e.deletedAt === undefined);

    if (activeTab === 'favorites') {
      list = list.filter(e => e.isFavorite);
    }

    if (activeTab === 'vault' && activeCat !== 'All') {
      list = list.filter(e => e.category === activeCat);
    }

    // Klasör Filtreleme
    if (currentFolderId) {
      list = list.filter(e => e.folderId === currentFolderId);
    } else if (activeTab === 'vault' || activeTab === 'favorites') {
      // Ana görünümde sadece klasörsüzleri veya klasörleri göster (klasörler ayrı render edilecek)
      list = list.filter(e => !e.folderId);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || e.username.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortOrder === 'title_asc') return a.title.localeCompare(b.title);
      if (sortOrder === 'title_desc') return b.title.localeCompare(a.title);
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [entries, activeTab, activeCat, currentFolderId, searchQuery, sortOrder]);

  const [visibleCount, setVisibleCount] = useState(24);
  const observerTarget = React.useRef(null);

  // Lazy loading observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 24);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [processedEntries]);

  // Reset pagination on tab/filter/category changes
  useEffect(() => {
    setVisibleCount(24);
  }, [activeTab, searchQuery, activeCat, sortOrder]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-main text-main transition-colors duration-500">
      <motion.aside animate={{ width: isSidebarCollapsed ? 80 : 280 }} className="h-full border-r border-main bg-sidebar flex flex-col z-20 shadow-2xl relative">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-4">
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2">
                <ImageBrandIcon size={32} />
                <div className="flex flex-col">
                  <span className="font-black text-lg text-main tracking-tighter leading-none">AEGIS</span>
                  {isPro && <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">PRO EDITION</span>}
                </div>
              </div>
            )}
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 rounded-xl hover:bg-zinc-800/10 text-zinc-500 mx-auto transition-colors">
              {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <button onClick={() => setShowLicensing(true)} className={`p-4 rounded-2xl border transition-all text-left group overflow-hidden relative ${isPro ? 'bg-amber-500/5 border-amber-500/20' : isExpired ? 'bg-red-500/5 border-red-500/20' : 'bg-blue-600/5 border-blue-500/10'}`}>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isPro ? 'text-amber-500' : isExpired ? 'text-red-500' : 'text-blue-500'}`}>
                    {isPro ? 'PRO AKTİF' : isExpired ? t('trial_expired_title') : t('trial_status_days').replace('{count}', remainingDays.toString())}
                  </span>
                  {isPro ? <Award size={12} className="text-amber-500" /> : <Crown size={12} className={isExpired ? 'text-red-500' : 'text-blue-500'} />}
                </div>
                <p className="text-[8px] font-bold text-dim uppercase">{isPro ? 'ÖMÜR BOYU GÜVENLİK' : isExpired ? 'SADECE YEDEKLEME MODU' : 'PRO SÜRÜME GEÇ'}</p>
              </div>
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <button onClick={() => { setActiveTab('vault'); setActiveCat('All'); }} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'vault' ? 'bg-zinc-900/10 text-main shadow-lg' : 'text-zinc-500 hover:text-main'}`}>
            <Shield size={20} className={activeTab === 'vault' ? 'text-blue-500' : ''} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">{t('vault')}</span>}
          </button>

          <AnimatePresence>
            {activeTab === 'vault' && !isSidebarCollapsed && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pl-10 space-y-1 overflow-hidden flex flex-col gap-1 pb-4">
                <button onClick={() => setActiveCat('All')} className={`w-full text-left py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeCat === 'All' ? 'text-blue-500 bg-blue-500/5' : 'text-zinc-600 hover:text-zinc-400'}`}>
                  {t('filter_all')}
                </button>
                {[
                  { id: Category.LOGIN, icon: Globe, label: t('cat_login') },
                  { id: Category.CARD, icon: CreditCard, label: t('cat_card') },
                  { id: Category.NOTE, icon: FileText, label: t('cat_note') },
                  { id: Category.FILE, icon: Download, label: t('cat_file') }
                ].map(cat => (
                  <button key={cat.id} onClick={() => setActiveCat(cat.id)} className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeCat === cat.id ? 'text-blue-500 bg-blue-500/5' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    <cat.icon size={14} />
                    <span>{cat.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={() => setActiveTab('favorites')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'favorites' ? 'bg-zinc-900/10 text-main shadow-lg' : 'text-zinc-500 hover:text-main'}`}>
            <Star size={20} className={activeTab === 'favorites' ? 'text-amber-500' : ''} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">{t('favorites')}</span>}
          </button>
          <button onClick={() => setActiveTab('audit')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'audit' ? 'bg-zinc-900/10 text-main shadow-lg' : 'text-zinc-500 hover:text-main'}`}>
            <ShieldAlert size={20} className={activeTab === 'audit' ? 'text-blue-500' : ''} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">{t('audit')}</span>}
          </button>
          <button onClick={() => setActiveTab('generator')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'generator' ? 'bg-zinc-900/10 text-main shadow-lg' : 'text-zinc-500 hover:text-main'}`}>
            <Zap size={20} className={activeTab === 'generator' ? 'text-blue-500' : ''} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">{t('generator')}</span>}
          </button>

          <div className="pt-6 pb-2 px-4 text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t('settings')}</div>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-zinc-900/10 text-main shadow-lg' : 'text-zinc-500 hover:text-main'}`}>
            <Settings size={20} className={activeTab === 'settings' ? 'text-blue-500' : ''} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">{t('settings')}</span>}
          </button>
          <button onClick={() => setActiveTab('trash')} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${activeTab === 'trash' ? 'bg-zinc-900/10 text-main shadow-lg' : 'text-zinc-500 hover:text-main'}`}>
            <Trash2 size={20} className={activeTab === 'trash' ? 'text-red-500' : ''} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">{t('trash')}</span>}
          </button>
        </nav>

        <div className="p-6 border-t border-main">
          <button
            onClick={handleLogout}
            disabled={isLocking}
            title={t('lock_vault')}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
          >
            {isLocking ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />}
            {!isSidebarCollapsed && <span className="text-sm font-bold uppercase tracking-tighter">{isLocking ? t('processing') : t('lock_vault')}</span>}
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col bg-main relative overflow-hidden">
        <header className="h-20 border-b border-main flex items-center justify-between px-8 glass sticky top-0 z-30 shadow-sm">
          <div className="flex-1 max-w-2xl flex items-center gap-4 relative">
            <div className="flex-1 relative group">
              <Search className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder={t('search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-input-bg border border-main rounded-2xl text-sm text-main outline-none focus:border-blue-500/50 shadow-inner transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-3 rounded-2xl border transition-all ${isFilterOpen ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-black/20 border-main text-zinc-500 hover:text-main'}`}
              >
                <SlidersHorizontal size={18} />
              </button>
              <button
                onClick={() => { if (isExpired && !isPro) return; setIsAdding(true); setEditingEntry(null); }}
                className={`px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded-2xl shadow-xl flex items-center gap-2 tracking-[0.2em] uppercase transition-all ${isExpired && !isPro ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                <Plus size={16} strokeWidth={3} /> {t('new_secret')}
              </button>
            </div>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-[calc(100%+12px)] left-0 right-0 glass border border-white/5 rounded-[2.5rem] shadow-2xl p-8 z-50 grid grid-cols-2 gap-10"
                >
                  <div>
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 ml-2">Sıralama Seçenekleri</h4>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'recent', label: t('sort_recent'), icon: Clock },
                        { id: 'title_asc', label: t('sort_title_asc'), icon: SortAsc },
                        { id: 'title_desc', label: t('sort_title_desc'), icon: SortDesc }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => { setSortOrder(opt.id as any); setIsFilterOpen(false); }}
                          className={`flex items-center justify-between px-5 py-3 rounded-xl transition-all ${sortOrder === opt.id ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
                        >
                          <div className="flex items-center gap-3">
                            <opt.icon size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">{opt.label}</span>
                          </div>
                          {sortOrder === opt.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 ml-2">Güvenlik Durumu</h4>
                    <div className="grid grid-cols-1 gap-2">
                      <button className="flex items-center gap-3 px-5 py-3 rounded-xl hover:bg-white/5 text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                        <ShieldCheck size={14} className="text-emerald-500" /> {t('filter_secure')}
                      </button>
                      <button className="flex items-center gap-3 px-5 py-3 rounded-xl hover:bg-white/5 text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                        <AlertTriangle size={14} className="text-red-500" /> {t('filter_critical')}
                      </button>
                      <button className="flex items-center gap-3 px-5 py-3 rounded-xl hover:bg-white/5 text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
                        <Clock size={14} className="text-amber-500" /> {t('last_30_days')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <section ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Session timeout warning - shown when < 1 minute remaining */}
          <AnimatePresence>
            {lockStatus?.isWarning && !lockStatus.isLocked && lockStatus.remainingSeconds > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="sticky top-0 z-50 mx-4 mt-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Hourglass size={18} className="text-red-500 animate-spin" />
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-bold text-red-500 uppercase tracking-wider">
                        {lang === 'tr' ? 'OTURUM SONA ERMEK ÜZERE' : 'SESSION EXPIRING SOON'}
                      </p>
                      <p className="text-[11px] text-red-400 font-semibold">
                        {lang === 'tr'
                          ? `Kalan zaman: ${lockStatus.remainingSeconds} saniye`
                          : `Time remaining: ${lockStatus.remainingSeconds} seconds`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-red-500 tabular-nums">
                      {lockStatus.remainingSeconds}
                    </div>
                    <div className="text-[9px] text-red-400 font-bold uppercase tracking-widest">
                      {lang === 'tr' ? 'Saniye' : 'SEC'}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 bg-red-500/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${lockStatus.percentRemaining}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="p-4"
            >
              {activeTab === 'generator' && (
                <div className="max-w-2xl mx-auto py-2">
                  <PasswordGenerator onClose={() => setActiveTab('vault')} />
                </div>
              )}

              {activeTab === 'audit' && (
                <SecurityAudit entries={entries} onEditEntry={handleEditEntry} />
              )}

              {activeTab === 'trash' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-xl font-black text-main uppercase tracking-tighter mb-2">{t('trash')}</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('trash_desc')}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 pb-32">
                    {processedEntries.map(entry => (
                      <PasswordCard
                        key={entry.id}
                        entry={entry}
                        onEdit={() => { }}
                        onDelete={() => { }}
                        onRestore={() => restoreEntry(entry.id)}
                        onPermanentDelete={() => permanentDelete(entry.id)}
                        onToggleFavorite={() => toggleFavorite(entry.id)}
                        onDecrypt={() => decryptData(entry)}
                      />
                    ))}
                    {processedEntries.length === 0 && (
                      <div className="col-span-full py-48 text-center opacity-30 font-black uppercase tracking-[1em] text-[10px] ml-[1em]">{t('no_assets')}</div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-4xl mx-auto space-y-4 pb-20">
                  <div className="flex gap-2 p-1.5 bg-black/40 rounded-[1.5rem] border border-white/5 w-fit mx-auto mb-4">
                    {(['general', 'security', 'data'] as const).map(tab => (
                      <button key={tab} onClick={() => setSettingsTab(tab)} className={`px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab === tab ? 'bg-blue-600 text-white shadow-xl' : 'text-zinc-600 hover:text-white'}`}>
                        {t(`${tab}_tab` as any)}
                      </button>
                    ))}
                  </div>

                  {settingsTab === 'general' && (
                    <div className="space-y-6">
                      <div className="glass p-10 rounded-[3rem] border border-amber-500/10 bg-amber-500/[0.02] flex items-center justify-between shadow-lg relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="flex items-center gap-8 relative z-10">
                          <div className="p-5 bg-amber-500/10 text-amber-500 rounded-[2rem] shadow-inner"><Award size={32} /></div>
                          <div>
                            <h3 className="text-lg font-black text-main uppercase tracking-tighter">{isPro ? 'Aegis Pro Edition' : 'Aegis Ücretsiz Deneme'}</h3>
                            <p className="text-[11px] text-dim font-bold uppercase mt-1 tracking-widest">{isPro ? 'ÖMÜR BOYU ERİŞİM ETKİN' : t('trial_status_days').replace('{count}', remainingDays.toString())}</p>
                          </div>
                        </div>
                        <button onClick={() => setShowLicensing(true)} className="relative z-10 px-8 py-4 bg-amber-600 hover:bg-amber-500 text-black text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-amber-600/20 active:scale-95">
                          {isPro ? 'LİSANSI GÖRÜNTÜLE' : 'PRO SÜRÜME GEÇ'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="glass p-10 rounded-[3rem] border border-main space-y-8">
                          <div className="flex items-center gap-4"><Moon size={20} className="text-blue-500" /> <h4 className="text-xs font-black uppercase tracking-widest">{t('theme')}</h4></div>
                          <div className="flex gap-2 bg-black/20 p-1.5 rounded-2xl">
                            <button onClick={() => setTheme('dark')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-white'}`}>{t('theme_dark')}</button>
                            <button onClick={() => setTheme('light')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-zinc-100 text-black shadow-lg' : 'text-zinc-600 hover:text-black'}`}>{t('theme_light')}</button>
                          </div>
                        </div>
                        <div className="glass p-10 rounded-[3rem] border border-main space-y-8">
                          <div className="flex items-center gap-4"><Languages size={20} className="text-blue-500" /> <h4 className="text-xs font-black uppercase tracking-widest">{t('lang_select_title')}</h4></div>
                          <div className="flex gap-2 bg-black/20 p-1.5 rounded-2xl">
                            <button onClick={() => setLang('en')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${lang === 'en' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-white'}`}>English</button>
                            <button onClick={() => setLang('tr')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${lang === 'tr' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-white'}`}>Türkçe</button>
                          </div>
                        </div>
                      </div>

                      {/* Legal Documents Section */}
                      <div className="grid grid-cols-2 gap-8 mt-6">
                        <button
                          onClick={() => { setLegalDocType('terms'); setShowLegalModal(true); }}
                          className="glass p-8 rounded-[2rem] border border-purple-500/20 hover:border-purple-500/50 bg-purple-500/[0.02] transition-all group shadow-lg"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <FileText size={20} className="text-purple-500 group-hover:scale-110 transition-transform" />
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-white group-hover:text-purple-300">{lang === 'en' ? t('legal_terms_title') : t('legal_terms_title_tr')}</h5>
                          </div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase leading-relaxed">Yasal şartlar ve koşullar</p>
                        </button>

                        <button
                          onClick={() => { setLegalDocType('privacy'); setShowLegalModal(true); }}
                          className="glass p-8 rounded-[2rem] border border-green-500/20 hover:border-green-500/50 bg-green-500/[0.02] transition-all group shadow-lg"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <Shield size={20} className="text-green-500 group-hover:scale-110 transition-transform" />
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-white group-hover:text-green-300">{lang === 'en' ? t('legal_privacy_title') : t('legal_privacy_title_tr')}</h5>
                          </div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase leading-relaxed">Veri gizliliği ve koruma</p>
                        </button>
                      </div>

                      {/* User Guide Section */}
                      <div className="mt-6">
                        <button
                          onClick={() => setShowUserGuide(true)}
                          className="w-full glass p-10 rounded-[2rem] border border-blue-500/30 hover:border-blue-500/60 bg-blue-500/[0.03] transition-all group shadow-lg"
                        >
                          <div className="flex items-center gap-6">
                            <div className="p-4 bg-blue-600/20 rounded-xl group-hover:scale-110 transition-transform">
                              <BookOpen size={28} className="text-blue-400" />
                            </div>
                            <div className="text-left flex-1">
                              <h4 className="text-lg font-black text-white uppercase tracking-tight">{lang === 'en' ? 'Complete User Guide' : 'Tam Kullanıcı Kılavuzu'}</h4>
                              <p className="text-xs text-zinc-400 mt-2 uppercase tracking-widest">{lang === 'en' ? 'Learn how to use all features • Getting started • Troubleshooting' : 'Tüm özellikleri nasıl kullanacağınızı öğrenin • Başlarken • Sorun Giderme'}</p>
                            </div>
                            <div className="text-blue-500 group-hover:translate-x-1 transition-transform">
                              <ChevronRight size={24} />
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'security' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <button onClick={() => setShow2FASetup(true)} className="glass p-10 rounded-[3rem] border border-main text-left hover:border-blue-500/30 transition-all flex items-center justify-between group shadow-lg">
                        <div className="flex items-center gap-8">
                          <div className="p-5 bg-blue-600/10 text-blue-500 rounded-[2rem] shadow-inner group-hover:scale-110 transition-transform"><Key size={32} /></div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-widest">{t('setup_2fa')}</h4>
                            <p className={`text-[10px] font-black uppercase mt-1 tracking-widest ${localStorage.getItem('aegis_2fa_config') ? 'text-emerald-500' : 'text-zinc-500'}`}>
                              {localStorage.getItem('aegis_2fa_config') ? t('status_protected') : t('two_factor_status_off')}
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={24} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
                      </button>

                      <button onClick={toggleBiometrics} disabled={!isBiometricAvailable} className={`glass p-10 rounded-[3rem] border border-main text-left hover:border-blue-500/30 transition-all flex items-center justify-between group shadow-lg ${!isBiometricAvailable ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex items-center gap-8">
                          <div className={`p-5 rounded-[2rem] shadow-inner group-hover:scale-110 transition-transform ${isBioEnabled ? 'bg-emerald-600/10 text-emerald-500' : 'bg-zinc-600/10 text-zinc-500'}`}><Fingerprint size={32} /></div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-widest">{t('biometric_lock')}</h4>
                            <p className={`text-[10px] font-black uppercase mt-1 tracking-widest ${isBioEnabled ? 'text-emerald-500' : 'text-red-500'}`}>
                              {isBioEnabled ? t('status_enabled') : t('status_disabled')}
                            </p>
                          </div>
                        </div>
                        <div className={`w-14 h-7 rounded-full relative transition-colors ${isBioEnabled ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-zinc-800'}`}>
                          <motion.div animate={{ x: isBioEnabled ? 28 : 4 }} className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg" />
                        </div>
                      </button>

                      <button onClick={() => setShowRecovery(true)} className="glass p-10 rounded-[3rem] border border-main text-left hover:border-blue-500/30 transition-all flex items-center justify-between group shadow-lg">
                        <div className="flex items-center gap-8">
                          <div className="p-5 bg-amber-600/10 text-amber-500 rounded-[2rem] shadow-inner group-hover:scale-110 transition-transform"><Eye size={32} /></div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-widest">{t('recovery_words')}</h4>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-widest">Acil Durum Protokolü</p>
                          </div>
                        </div>
                        <ChevronRight size={24} className="text-zinc-700 group-hover:text-amber-500 transition-colors" />
                      </button>

                      <div className="glass p-10 rounded-[3rem] border border-main space-y-8 shadow-lg">
                        <div className="flex items-center gap-4"><Clock size={20} className="text-blue-500" /> <h4 className="text-xs font-black uppercase tracking-widest">{t('auto_lock_timer')}</h4></div>
                        <div className="grid grid-cols-3 gap-3">
                          {[60000, 300000, 900000, 3600000].map(ms => (
                            <button key={ms} onClick={() => handleAutoLockChange(ms)} className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${autoLockDuration === ms ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-black/20 text-zinc-500 hover:text-zinc-300'}`}>
                              {ms === 60000 ? '1dk' : ms === 300000 ? '5dk' : ms === 900000 ? '15dk' : '1sa'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button onClick={toggleLockOnBg} className="glass p-10 rounded-[3rem] border border-main text-left hover:border-blue-500/30 transition-all flex items-center justify-between group shadow-lg">
                        <div className="flex items-center gap-8">
                          <div className="p-5 bg-indigo-600/10 text-indigo-500 rounded-[2rem] shadow-inner group-hover:scale-110 transition-transform"><Smartphone size={32} /></div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-widest">{t('lock_on_background')}</h4>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-widest">Anında Koruma</p>
                          </div>
                        </div>
                        <div className={`w-14 h-7 rounded-full relative transition-colors ${lockOnBg ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-zinc-800'}`}>
                          <motion.div animate={{ x: lockOnBg ? 28 : 4 }} className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg" />
                        </div>
                      </button>

                      <button onClick={() => setShowChangeMasterKey(true)} className="glass p-10 rounded-[3rem] border border-main text-left hover:border-blue-500/30 transition-all flex items-center justify-between group shadow-lg">
                        <div className="flex items-center gap-8">
                          <div className="p-5 bg-blue-600/10 text-blue-500 rounded-[2rem] shadow-inner group-hover:scale-110 transition-transform"><Lock size={32} /></div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-widest">{t('change_master_key') || 'Change Master Password'}</h4>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-widest">Güvenli anahtar güncelleme</p>
                          </div>
                        </div>
                        <ChevronRight size={24} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
                      </button>

                      <button onClick={triggerPanic} className="glass p-10 rounded-[3rem] border border-main col-span-1 md:col-span-2 flex items-center gap-10 shadow-lg group hover:border-red-500/30 transition-all text-left w-full">
                        <div className="p-5 bg-red-600/10 text-red-500 rounded-[2rem] shadow-inner group-hover:scale-110 transition-transform"><Flame size={32} /></div>
                        <div className="flex-1">
                          <h4 className="text-sm font-black uppercase tracking-widest">{t('panic_button')}</h4>
                          <p className="text-[11px] text-zinc-500 font-bold uppercase mt-1 leading-loose tracking-widest opacity-80">{t('panic_button_desc')}</p>
                        </div>
                        <div className="px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-600/20 group-hover:scale-105 transition-all">
                          {t('activate_panic_btn')}
                        </div>
                      </button>
                    </div>
                  )}

                  {settingsTab === 'data' && (
                    <div className="space-y-8">
                      <div className="glass p-16 rounded-[4rem] border border-main text-center space-y-10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-24 h-24 bg-blue-600/10 text-blue-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-600/10"><Database size={48} /></div>
                        <div className="relative z-10">
                          <h4 className="text-2xl font-black uppercase tracking-tighter text-white">{t('portability_title')}</h4>
                          <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] mt-3 max-w-md mx-auto leading-relaxed">{t('portability_desc')}</p>
                        </div>
                        <button onClick={() => setShowPortability(true)} className="relative z-10 px-12 py-6 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-[0.4em] rounded-2xl shadow-2xl shadow-blue-600/20 active:scale-95 transition-all">
                          {t('open_wizard')}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass p-8 rounded-[2.5rem] border border-main flex flex-col items-center text-center gap-6 group hover:border-amber-500/30 transition-all">
                          <div className="p-4 bg-amber-500/10 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform"><RotateCcw size={24} /></div>
                          <div>
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-white mb-2">{t('reset_settings')}</h5>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase leading-relaxed">{t('reset_settings_desc')}</p>
                          </div>
                          <button onClick={() => setShowResetConfirm({ type: 'settings', confirmText: '' })} className="mt-auto px-6 py-3 border border-zinc-800 hover:bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                            {t('initialize')}
                          </button>
                        </div>

                        <div className="glass p-8 rounded-[2.5rem] border border-main flex flex-col items-center text-center gap-6 group hover:border-red-500/30 transition-all">
                          <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl group-hover:scale-110 transition-transform"><ShieldX size={24} /></div>
                          <div>
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-white mb-2">{t('reset_vault')}</h5>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase leading-relaxed">{t('reset_vault_desc')}</p>
                          </div>
                          <button onClick={() => setShowResetConfirm({ type: 'vault', confirmText: '' })} className="mt-auto px-6 py-3 border border-red-500/20 hover:bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                            {t('permanent_delete')}
                          </button>
                        </div>

                        <div className="glass p-8 rounded-[2.5rem] border border-main flex flex-col items-center text-center gap-6 group hover:border-red-500 transition-all bg-red-500/[0.02]">
                          <div className="p-4 bg-red-600 text-white rounded-2xl shadow-xl shadow-red-600/20 group-hover:scale-110 transition-transform"><Flame size={24} /></div>
                          <div>
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-white mb-2">{t('factory_reset')}</h5>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase leading-relaxed">{t('factory_reset_desc')}</p>
                          </div>
                          <button onClick={() => setShowResetConfirm({ type: 'factory', confirmText: '' })} className="mt-auto px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-600/20 transition-all">
                            {t('factory_reset')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'vault' || activeTab === 'favorites') && (
                <div className="space-y-8 pb-32">
                  {currentFolderId && (
                    <button
                      onClick={() => setCurrentFolderId(null)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors mb-6 group"
                    >
                      <div className="p-2 bg-white/5 rounded-lg group-hover:bg-blue-600/20 group-hover:text-blue-500 transition-all">
                        <ChevronLeft size={16} />
                      </div>
                      {t('back')}
                    </button>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8">
                    {!isLoading && !currentFolderId && relevantFolders.map(folder => (
                      <motion.div
                        key={folder.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -5 }}
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="glass p-6 rounded-[2.5rem] border border-main cursor-pointer hover:border-blue-500/30 transition-all group flex flex-col items-center text-center gap-4 shadow-xl"
                      >
                        <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner relative">
                          <Folder size={32} />
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-[#050505]">
                            {entries.filter(e => e.folderId === folder.id && !e.deletedAt && (activeTab === 'favorites' ? e.isFavorite : true)).length}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-white leading-tight">{folder.name}</h4>
                          <p className="text-[8px] text-zinc-500 font-bold uppercase mt-1 tracking-widest opacity-60">Collection</p>
                        </div>
                      </motion.div>
                    ))}

                    {isLoading ? Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />) : processedEntries.slice(0, visibleCount).map(entry => (
                      <PasswordCard key={entry.id} entry={entry} onEdit={() => handleEditEntry(entry)} onDelete={() => deleteEntry(entry.id)} onToggleFavorite={() => toggleFavorite(entry.id)} onDecrypt={() => decryptData(entry)} />
                    ))}

                    {processedEntries.length > visibleCount && (
                      <div ref={observerTarget} className="col-span-full h-10 flex items-center justify-center">
                        <Loader2 className="animate-spin text-zinc-700" size={24} />
                      </div>
                    )}

                    {!isLoading && processedEntries.length === 0 && relevantFolders.length === 0 && (
                      <div className="col-span-full py-48 text-center opacity-30 font-black uppercase tracking-[1em] text-[10px] ml-[1em]">{t('no_assets')}</div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <AnimatePresence>
          {showLicensing && <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl"><LicensingView onClose={() => setShowLicensing(false)} /></div>}
          {showPortability && <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl"><PortabilityWizard onClose={() => setShowPortability(false)} /></div>}
          {show2FASetup && <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl"><TwoFactorSetup onClose={() => setShow2FASetup(false)} onComplete={() => setShow2FASetup(false)} /></div>}
          {showRecovery && <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl"><RecoveryWordsView onClose={() => setShowRecovery(false)} /></div>}
          {showChangeMasterKey && <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl"><ChangeMasterKeyModal onClose={() => setShowChangeMasterKey(false)} masterKey={masterKey} onSuccess={() => setShowChangeMasterKey(false)} /></div>}
          {showResetConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass p-12 rounded-[3.5rem] border border-red-500/20 max-w-md w-full text-center space-y-8">
                <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-red-500/10"><AlertTriangle size={40} /></div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{t('confirm_reset_title')}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">{t('confirm_reset_desc')}</p>
                </div>
                <input
                  type="text"
                  autoFocus
                  placeholder={lang === 'tr' ? 'SIFIRLA' : 'RESET'}
                  value={showResetConfirm.confirmText}
                  onChange={(e) => setShowResetConfirm({ ...showResetConfirm, confirmText: e.target.value.toUpperCase() })}
                  className="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-center text-sm font-black tracking-[0.3em] uppercase text-red-500 outline-none focus:border-red-500/30 transition-all"
                />
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowResetConfirm(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all">{t('abort')}</button>
                  <button
                    onClick={performReset}
                    disabled={showResetConfirm.confirmText !== (lang === 'tr' ? 'SIFIRLA' : 'RESET')}
                    className="flex-1 py-4 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:grayscale text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-red-600/20"
                  >
                    {t('commit')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {isAdding && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
              <div className="w-full max-w-4xl"><EntryForm entry={editingEntry?.entry} sensitive={editingEntry?.sensitive} onSave={async (p) => { await saveEntry(p); setIsAdding(false); }} onClose={() => setIsAdding(false)} /></div>
            </div>
          )}
          <LegalModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} docType={legalDocType} />
          <UserGuideModal isOpen={showUserGuide} onClose={() => setShowUserGuide(false)} />
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Dashboard;