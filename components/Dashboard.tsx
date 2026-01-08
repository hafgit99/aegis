import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Star, ShieldAlert, Settings, LogOut,
  Menu, ChevronLeft, Search, Plus,
  Lock, AlertTriangle, X,
  Trash2, Globe, CheckCircle2,
  Smartphone, Key, Zap, Languages, Database, CreditCard, FileText, Download, Fingerprint, Moon, Sun,
  ChevronUp, SortAsc, SortDesc, Filter, CheckSquare, Square, Check, Copy, Loader2, ShieldCheck,
  RotateCcw, Flame, Clock, Calendar, ShieldX, Crown, Gem, Award, ChevronRight, Eye, MoreVertical, SlidersHorizontal, RefreshCw, Folder, BookOpen, Hourglass, Wallet
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
import { BackupSettings } from './BackupSettings.tsx';
import { EmergencyAccess } from './EmergencyAccess.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { useVault } from '../hooks/useVault.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import { LicensingService } from '../services/licensingService.ts';
import { BiometricService } from '../services/biometricService.ts';
import { RecoveryService } from '../services/recoveryService.ts';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { db } from '../db.ts';
import { VaultService } from '../services/vaultService.ts';

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
      setError(err.message || t('failed_to_generate_key'));
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
  <title>Aegis Vault - ${t('recovery_words')}</title>
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
    .footer { text-align: center; color: #999; margin-top: 30px; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Aegis Vault - ${t('recovery_words')}</h1>
    <div class="subtitle">Aegis Vault Password Manager - Recovery Words Backup</div>
    <div class="date-time">${t('created')}: ${date} ${time}</div>
    
    <div class="warning">
      <strong>⚠️ ${t('important')}:</strong> ${t('recovery_words_pdf_warning')}
    </div>

    <h2 style="color: #333; text-align: center;">${t('recovery_words_16_words')}</h2>
    <div class="words-grid">
      ${words.map((word, i) => `<div class="word-item"><div class="word-number">${i + 1}.</div><div class="word-text">${word}</div></div>`).join('')}
    </div>

    <div class="checksum-box">
      <div class="checksum-label">${t('checksum')}:</div>
      <div class="checksum-value">${checksum}</div>
    </div>

    <div class="footer">
      <p>Aegis Vault ${t('recovery_backup')}</p>
    </div>
  </div>

  <script>window.onload = () => window.print();</script>
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
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">v4.0 - Aegis Protocol</p>
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
            {t('recovery_words_setup_desc')}
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
                {t('add_pin_protection')}
              </span>
            </label>

            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest px-2">
              {t('pin_protection_desc')}
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
          >
            {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Key size={16} />}
            {t('generate_recovery_words')}
          </button>
        </div>
      )}

      {stage === 'verify' && words.length > 0 && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mb-4 tracking-[0.2em]">
              {t('recovery_important')}
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
                {t('copy_all_words')}
              </button>
              <button
                onClick={handleExportAsPDF}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Download size={14} />
                {t('export_pdf')}
              </button>
              <button
                onClick={handleExportRecovery}
                className="flex-1 py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Download size={14} />
                {t('export_json')}
              </button>
            </div>

            <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">{t('recovery_checksum_label')}:</p>
              <p className="font-mono text-[11px] text-blue-400">{checksum}</p>
            </div>

            {pin && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-2">{t('pin_protection_active')}</p>
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
            {t('recovery_verify_words')}
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
              {t('success_title')}
            </h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
              {t('recovery_success_desc')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-600/20"
          >
            {t('close')}
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
    loadEntries().then(() => {
      setIsLoading(false);

      // Duplicate kontrolü ve temizleme
      if (masterKey) {
        VaultService.deduplicateVault(masterKey).then(result => {
          if (result.deletedCount > 0) {
            console.log(`[Dashboard] ${result.deletedCount} duplicate otomatik temizlendi`);
            loadEntries();
          }
        }).catch(err => {
          console.error("[Dashboard] Deduplication hatası:", err);
        });
      }
    });
    BiometricService.isSupported().then(setIsBiometricAvailable);
  }, [loadEntries, masterKey]);

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

  const { resetVault, deduplicateVault } = useVault();

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

  const [isCleaning, setIsCleaning] = useState(false);
  const handleDeduplicate = async () => {
    if (isCleaning) return;
    setIsCleaning(true);
    try {
      const result = await deduplicateVault();
      alert(t('cleanup_success_desc').replace('{count}', result.deletedCount.toString()));
    } catch (e) {
      console.error(e);
    } finally {
      setIsCleaning(false);
    }
  };

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

  // Performansı artırmak için arama sorgusunu ertele
  const deferredQuery = React.useDeferredValue(searchQuery);

  const processedEntries = useMemo(() => {
    // 1. Temel Filtreleme (Trash vs Active)
    let list = [...entries].filter(e => activeTab === 'trash' ? e.deletedAt !== undefined : e.deletedAt === undefined);

    // Duplicate'leri gizle (Tüm görünüm türlerinde) - Daha agresif temizlik
    const seen = new Map<string, VaultEntry>();
    for (const entry of list) {
      // Görünmez karakterleri temizle ve normalize et
      const cleanTitle = (entry.title || '').toLowerCase().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
      const cleanUser = (entry.username || '').toLowerCase().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');

      // Eğer başlık ve kullanıcı adı aynıysa, en son güncellenen kaydı tut
      const key = `${cleanTitle}|${cleanUser}`;

      if (seen.has(key)) {
        const existing = seen.get(key)!;
        // Eğer şimdiki kayıt daha yeniyse, eskisini ez
        if ((entry.updatedAt || 0) > (existing.updatedAt || 0)) {
          seen.set(key, entry);
        }
      } else {
        seen.set(key, entry);
      }
    }
    list = Array.from(seen.values());

    // 2. Arama varsa Global Arama Yap (Klasörleri yoksay)
    if (deferredQuery) {
      const q = deferredQuery.toLowerCase();
      list = list.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.username || '').toLowerCase().includes(q)
      );
    }

    // 3. Arama Yoksa: Standart Görünüm Filtreleri

    // Favori Filtresi
    if (activeTab === 'favorites') {
      list = list.filter(e => e.isFavorite);
    }

    // Kategori Filtresi (Vault sekmesinde)
    if (activeTab === 'vault' && activeCat !== 'All') {
      list = list.filter(e => e.category === activeCat);
    }

    // Klasör Filtresi
    if (currentFolderId) {
      list = list.filter(e => e.folderId === currentFolderId);
    } else if (activeTab === 'vault' || activeTab === 'favorites') {
      // Ana kök dizin (klasörü olmayanlar)
      // Ancak arama yapılıyorsa klasör yapısını yoksay (Kullanıcı aradığı şeyi her yerde bulsun)
      if (!deferredQuery) {
        list = list.filter(e => !e.folderId);
      }
    }

    // Sıralama
    list.sort((a, b) => {
      if (sortOrder === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      if (sortOrder === 'title_desc') return (b.title || '').localeCompare(a.title || '');
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return list;
  }, [entries, activeTab, activeCat, currentFolderId, deferredQuery, sortOrder]);

  const [visibleCount, setVisibleCount] = useState(24);
  const observerTarget = React.useRef(null);

  // Lazy loading observer - Tüm kategorilerde aktif
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < processedEntries.length) {
          setVisibleCount(prev => Math.min(prev + 24, processedEntries.length));
        }
      },
      { threshold: 0.3, rootMargin: '100px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [processedEntries.length, visibleCount]);

  // Reset pagination on tab/filter/category changes
  useEffect(() => {
    setVisibleCount(24);
  }, [activeTab, searchQuery, activeCat, sortOrder, currentFolderId]);

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
                    {isPro ? t('pro_active') : isExpired ? t('trial_expired_title_short') : t('trial_status_days').replace('{count}', remainingDays.toString())}
                  </span>
                  {isPro ? <Award size={12} className="text-amber-500" /> : <Crown size={12} className={isExpired ? 'text-red-500' : 'text-blue-500'} />}
                </div>
                <p className="text-[8px] font-bold text-dim uppercase">{isPro ? t('access_granted_lifetime') : isExpired ? t('backup_mode_only') : t('upgrade_to_pro')}</p>
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
                  { id: Category.FILE, icon: Download, label: t('cat_file') },
                  { id: Category.CRYPTO, icon: Wallet, label: t('cat_crypto') }
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
                className="w-full pl-11 pr-12 py-3 bg-input-bg border border-main rounded-2xl text-sm text-main outline-none focus:border-blue-500/50 shadow-inner transition-all select-text"
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
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 ml-2">{t('sort_options')}</h4>
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
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 ml-2">{t('security_status')}</h4>
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

              {activeTab === 'favorites' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-xl font-black text-main uppercase tracking-tighter mb-2">{t('favorites')}</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('found_items').replace('{count}', processedEntries.length.toString())}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 pb-32">
                    {processedEntries.map(entry => (
                      <PasswordCard
                        key={entry.id}
                        entry={entry}
                        onEdit={() => handleEditEntry(entry)}
                        onDelete={() => deleteEntry(entry.id)}
                        onToggleFavorite={() => toggleFavorite(entry.id)}
                        onDecrypt={() => decryptData(entry)}
                      />
                    ))}
                    <div ref={observerTarget} className="h-10 w-full" />
                  </div>
                </>
              )}

              {activeTab === 'vault' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-xl font-black text-main uppercase tracking-tighter mb-2">{activeCat === 'All' ? t('all_items') : t(`cat_${activeCat.toLowerCase()}` as any)}</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('found_items').replace('{count}', processedEntries.length.toString())}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 pb-32">
                    {processedEntries.slice(0, visibleCount).map(entry => (
                      <PasswordCard
                        key={entry.id}
                        entry={entry}
                        onEdit={() => handleEditEntry(entry)}
                        onDelete={() => deleteEntry(entry.id)}
                        onToggleFavorite={() => toggleFavorite(entry.id)}
                        onDecrypt={() => decryptData(entry)}
                      />
                    ))}
                    <div ref={observerTarget} className="h-10 w-full" />
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

                  <AnimatePresence mode="wait">
                    {settingsTab === 'general' && (
                      <motion.div key="general" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                        <div className="glass p-10 rounded-[3rem] border border-amber-500/10 bg-amber-500/[0.02] flex items-center justify-between shadow-lg relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          <div className="flex items-center gap-8 relative z-10">
                            <div className="p-5 bg-amber-500/10 text-amber-500 rounded-[2rem] shadow-inner"><Award size={32} /></div>
                            <div>
                              <h3 className="text-lg font-black text-main uppercase tracking-tighter">{isPro ? t('pro_edition') : t('free_trial')}</h3>
                              <p className="text-[11px] text-dim font-bold uppercase mt-1 tracking-widest">{isPro ? t('access_enabled') : t('trial_status_days').replace('{count}', (remainingDays || 0).toString())}</p>
                            </div>
                          </div>
                          <button onClick={() => setShowLicensing(true)} className="relative z-10 px-8 py-4 bg-amber-600 hover:bg-amber-500 text-black text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-amber-600/20 active:scale-95">
                            {isPro ? t('view_license') : t('upgrade_to_pro')}
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

                        <div className="grid grid-cols-2 gap-8 mt-6">
                          <button onClick={() => { setLegalDocType('terms'); setShowLegalModal(true); }} className="glass p-8 rounded-[2rem] border border-purple-500/20 hover:border-purple-500/50 bg-purple-500/[0.02] transition-all group shadow-lg">
                            <div className="flex items-center gap-4 mb-4">
                              <FileText size={20} className="text-purple-500 group-hover:scale-110 transition-transform" />
                              <h5 className="text-[11px] font-black uppercase tracking-widest text-white group-hover:text-purple-300">{t('legal_terms_title')}</h5>
                            </div>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase leading-relaxed">{t('legal_terms_desc')}</p>
                          </button>
                          <button onClick={() => { setLegalDocType('privacy'); setShowLegalModal(true); }} className="glass p-8 rounded-[2rem] border border-green-500/20 hover:border-green-500/50 bg-green-500/[0.02] transition-all group shadow-lg">
                            <div className="flex items-center gap-4 mb-4">
                              <Shield size={20} className="text-green-500 group-hover:scale-110 transition-transform" />
                              <h5 className="text-[11px] font-black uppercase tracking-widest text-white group-hover:text-green-300">{t('legal_privacy_title')}</h5>
                            </div>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase leading-relaxed">{t('legal_privacy_desc')}</p>
                          </button>
                        </div>

                        <div className="mt-6">
                          <button onClick={() => setShowUserGuide(true)} className="w-full glass p-10 rounded-[2rem] border border-blue-500/30 hover:border-blue-500/60 bg-blue-500/[0.03] transition-all group shadow-lg">
                            <div className="flex items-center gap-6">
                              <div className="p-4 bg-blue-600/20 rounded-xl group-hover:scale-110 transition-transform"><BookOpen size={28} className="text-blue-400" /></div>
                              <div className="text-left flex-1">
                                <h4 className="text-lg font-black text-white uppercase tracking-tight">{t('complete_user_guide')}</h4>
                                <p className="text-xs text-zinc-400 mt-2 uppercase tracking-widest">{t('user_guide_subtext')}</p>
                              </div>
                              <div className="text-blue-500 group-hover:translate-x-1 transition-transform"><ChevronRight size={24} /></div>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {settingsTab === 'security' && (
                      <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 pb-20">
                        {/* Section 1: Multi-Factor Authentication */}
                        <section className="glass p-6 rounded-[2rem] border border-blue-500/10 bg-blue-500/[0.02]">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-600/20">
                              <ShieldCheck size={16} />
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('two_factor_title')}</h3>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{t('two_factor_desc') || 'Extra protection for your vault'}</p>
                            </div>
                          </div>
                          <div className="max-w-2xl">
                            <TwoFactorSetup onClose={() => { }} onComplete={() => { }} />
                          </div>
                        </section>

                        {/* Section 2: Proactive Defense & Disaster Recovery */}
                        <section className="glass p-6 rounded-[2rem] border border-amber-500/10 bg-amber-500/[0.02]">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-600 text-white rounded-lg shadow-lg shadow-amber-600/20">
                              <AlertTriangle size={16} />
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('incident_response')}</h3>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{t('incident_response_desc') || 'Emergency access and panic mode'}</p>
                            </div>
                          </div>
                          <EmergencyAccess />
                        </section>

                        {/* Section 3: Device Security & Access Control */}
                        <section className="space-y-4">
                          <div className="flex items-center gap-3 px-2">
                            <div className="w-1 h-6 bg-emerald-600 rounded-full" />
                            <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('security_architecture')}</h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Biometric Toggle Card */}
                            <div className="glass p-5 rounded-[1.5rem] border border-white/5 flex items-center justify-between group hover:border-emerald-500/20 transition-all shadow-lg">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:scale-110 transition-transform">
                                  <Fingerprint size={18} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-white uppercase tracking-widest">{t('biometric_lock')}</h4>
                                  <p className="text-[8px] text-zinc-500 font-bold uppercase mt-1">{t('biometric_desc')}</p>
                                </div>
                              </div>
                              {isBiometricAvailable ? (
                                <button onClick={toggleBiometrics} className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${isBioEnabled ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-900 text-zinc-600 border border-white/5'}`}>
                                  {isBioEnabled ? t('status_enabled') : t('status_disabled')}
                                </button>
                              ) : (
                                <span className="text-[8px] text-zinc-600 font-bold uppercase">{t('status_inactive')}</span>
                              )}
                            </div>

                            {/* Auto Lock Timer Card */}
                            <div className="glass p-5 rounded-[1.5rem] border border-white/5 space-y-3 shadow-lg">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                                  <Clock size={18} />
                                </div>
                                <h4 className="text-xs font-black text-white uppercase tracking-widest">{t('auto_lock_timer')}</h4>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {[60000, 300000, 900000, 3600000].map(ms => (
                                  <button
                                    key={ms}
                                    onClick={() => handleAutoLockChange(ms)}
                                    className={`py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${autoLockDuration === ms ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}
                                  >
                                    {ms === 60000 ? t('time_1m') : ms === 300000 ? t('time_5m') : ms === 900000 ? t('time_15m') : t('time_1h')}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Recovery Words Card */}
                            <button onClick={() => setShowRecovery(true)} className="glass p-5 rounded-[1.5rem] border border-white/5 text-left hover:border-amber-500/20 transition-all flex items-center justify-between group shadow-lg">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-amber-600/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                                  <Eye size={18} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-white uppercase tracking-widest">{t('recovery_words')}</h4>
                                  <p className="text-[8px] text-zinc-500 font-bold uppercase mt-1">{t('emergency_protocol')}</p>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-zinc-700 group-hover:text-amber-500 transition-colors" />
                            </button>

                            {/* Master Key Card */}
                            <button onClick={() => setShowChangeMasterKey(true)} className="glass p-5 rounded-[1.5rem] border border-white/5 text-left hover:border-blue-500/20 transition-all flex items-center justify-between group shadow-lg">
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-600/10 text-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                                  <Key size={18} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-white uppercase tracking-widest">{t('change_master_key')}</h4>
                                  <p className="text-[8px] text-zinc-500 font-bold uppercase mt-1">{t('secure_key_update')}</p>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
                            </button>
                          </div>
                        </section>
                      </motion.div>
                    )}

                    {settingsTab === 'data' && (
                      <motion.div key="data" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 pb-20">
                        {/* Backup Settings Section */}
                        <section className="glass p-5 rounded-[1.5rem] border border-emerald-500/10 bg-emerald-500/[0.02]">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-600/20">
                              <Database size={16} />
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('backup_settings')}</h3>
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{t('backup_settings_desc') || 'Automatic backup to local or cloud storage'}</p>
                            </div>
                          </div>
                          <BackupSettings />
                        </section>

                        {/* Data Portability Section */}
                        <section className="glass p-5 rounded-[1.5rem] border border-blue-500/10 bg-blue-500/[0.02]">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-600/20">
                              <Download size={16} />
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('data_tab')}</h3>
                              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{t('import_export_desc') || 'Import and export your vault data'}</p>
                            </div>
                          </div>
                          <PortabilityWizard />
                        </section>

                        {/* Cleanup Duplicates Section */}
                        <section className="glass p-5 rounded-[1.5rem] border border-amber-500/10 bg-amber-500/[0.02]">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-amber-600 text-white rounded-lg shadow-lg shadow-amber-600/20">
                                <Zap size={20} />
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('cleanup_duplicates')}</h3>
                                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{t('cleanup_duplicates_desc')}</p>
                              </div>
                            </div>
                            <button
                              onClick={handleDeduplicate}
                              disabled={isCleaning}
                              className={`px-5 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2 ${isCleaning
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                : 'bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/5'
                                }`}
                            >
                              {isCleaning ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                              {isCleaning ? (t('processing') || 'Processing...') : (t('initialize') || 'Başlat')}
                            </button>
                          </div>
                        </section>

                        {/* Reset Options Section */}
                        <section className="space-y-4">
                          <div className="flex items-center gap-3 px-2">
                            <div className="w-1 h-6 bg-red-600 rounded-full" />
                            <h3 className="text-sm font-black text-white uppercase tracking-tighter">{t('danger_zone')}</h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Reset Settings Card */}
                            <div className="glass p-4 rounded-[1.5rem] border border-white/5 flex flex-col items-center text-center gap-3 group hover:border-amber-500/30 transition-all">
                              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform"><RotateCcw size={20} /></div>
                              <div>
                                <h5 className="text-[10px] font-black text-white uppercase tracking-widest text-center">{t('reset_settings')}</h5>
                                <p className="text-[8px] text-zinc-500 font-bold uppercase leading-relaxed">{t('reset_settings_desc')}</p>
                              </div>
                              <button onClick={() => setShowResetConfirm({ type: 'settings', confirmText: '' })} className="mt-auto px-4 py-2 border border-zinc-800 hover:bg-white/5 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all">
                                {t('initialize')}
                              </button>
                            </div>

                            {/* Reset Vault Card */}
                            <div className="glass p-4 rounded-[1.5rem] border border-white/5 flex flex flex-col items-center text-center gap-3 group hover:border-red-500/30 transition-all">
                              <div className="p-2 bg-red-500/10 text-red-500 rounded-2xl group-hover:scale-110 transition-transform"><ShieldX size={20} /></div>
                              <div>
                                <h5 className="text-[10px] font-black text-white uppercase tracking-widest text-center">{t('reset_vault')}</h5>
                                <p className="text-[8px] text-zinc-500 font-bold uppercase leading-relaxed">{t('reset_vault_desc')}</p>
                              </div>
                              <button onClick={() => setShowResetConfirm({ type: 'vault', confirmText: '' })} className="mt-auto px-4 py-2 border border-red-500/20 hover:bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all">
                                {t('permanent_delete')}
                              </button>
                            </div>

                            {/* Factory Reset Card */}
                            <div className="glass p-4 rounded-[1.5rem] border border-white/5 flex flex flex-col items-center text-center gap-3 group hover:border-red-500 transition-all bg-red-500/[0.02]">
                              <div className="p-2 bg-red-600 text-white rounded-2xl shadow-xl shadow-red-600/20 group-hover:scale-110 transition-transform"><Flame size={20} /></div>
                              <div>
                                <h5 className="text-[10px] font-black text-white uppercase tracking-widest text-center">{t('factory_reset')}</h5>
                                <p className="text-[8px] text-zinc-500 font-bold uppercase leading-relaxed">{t('factory_reset_desc')}</p>
                              </div>
                              <button onClick={() => setShowResetConfirm({ type: 'factory', confirmText: '' })} className="mt-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-red-600/20 transition-all">
                                {t('factory_reset')}
                              </button>
                            </div>
                          </div>
                        </section>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {
                (activeTab === 'vault' || activeTab === 'favorites') && (
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
                            <p className="text-[8px] text-zinc-500 font-bold uppercase mt-1 tracking-widest opacity-60">{t('collection')}</p>
                          </div>
                        </motion.div>
                      ))}

                      {isLoading ? Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />) : processedEntries.slice(0, visibleCount).map(entry => (
                        <PasswordCard key={entry.id} entry={entry} onEdit={() => handleEditEntry(entry)} onDelete={() => deleteEntry(entry.id)} onToggleFavorite={() => toggleFavorite(entry.id)} onDecrypt={() => decryptData(entry)} />
                      ))}

                      {processedEntries.length > visibleCount && (
                        <div ref={observerTarget} className="col-span-full py-12 flex flex-col items-center gap-4">
                          <Loader2 className="animate-spin text-zinc-700" size={28} />
                          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                            {processedEntries.length - visibleCount} {t('more_items') || 'daha fazla'}
                          </p>
                        </div>
                      )}

                      {!isLoading && processedEntries.length === 0 && relevantFolders.length === 0 && (
                        <div className="col-span-full py-48 text-center opacity-30 font-black uppercase tracking-[1em] text-[10px] ml-[1em]">{t('no_assets')}</div>
                      )}
                    </div>
                  </div>
                )
              }
            </motion.div >
          </AnimatePresence >
        </section >

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
      </main >
    </div >
  );
};

export default Dashboard;