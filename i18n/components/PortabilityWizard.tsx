import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Download, FileJson, FileSpreadsheet, X, CheckCircle2,
  AlertTriangle, ArrowRight, Loader2, ShieldCheck, Database, Printer,
  Shield, Lock, FileCode, Check, ChevronLeft, Filter, History, Trash2,
  Eye, FileText, Info, Key, Server, CreditCard, Wallet
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useVault } from '../../hooks/useVault';
import { ExportService, ExportFormat } from '../../services/exportService';
import { ImportService, ImportConflict } from '../../services/importService';
import { VaultService } from '../../services/vaultService';
import { VaultEntry, SensitiveData, Category } from '../../types';

type WizardTab = 'import' | 'export';
type WizardStep = 'select' | 'processing' | 'preview' | 'conflicts' | 'success' | 'backup_password';

const CATEGORY_ICONS: Record<string, any> = {
  [Category.LOGIN]: Key,
  [Category.CARD]: CreditCard,
  [Category.NOTE]: FileText,
  [Category.FILE]: Shield,
  [Category.CRYPTO]: Wallet
};

const PortabilityWizard: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t, lang } = useLanguage();
  const { masterKey } = useAuth();
  const { entries, loadEntries } = useVault();

  // Navigation State
  const [activeTab, setActiveTab] = useState<WizardTab>('import');
  const [step, setStep] = useState<WizardStep>('select');

  // Data State
  const [importData, setImportData] = useState<(Partial<VaultEntry> & { sensitive: SensitiveData })[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Settings State
  const [backupPassword, setBackupPassword] = useState('');
  const [customExportPassword, setCustomExportPassword] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('aegis');
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([...Object.values(Category)]);
  const [isDragging, setIsDragging] = useState(false);

  // Memoized Counts
  const importSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    importData.forEach(item => {
      const cat = item.category || Category.LOGIN;
      summary[cat] = (summary[cat] || 0) + 1;
    });
    return summary;
  }, [importData]);

  const filteredExportEntries = useMemo(() => {
    return entries.filter(e => selectedCategories.includes(e.category));
  }, [entries, selectedCategories]);

  // Handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    if (!masterKey) return;
    setStep('processing');
    setError(null);
    setProgress(10);
    setPendingFile(file);

    try {
      let rawEntries: (Partial<VaultEntry> & { sensitive: SensitiveData })[] = [];

      if (file.name.endsWith('.aegis')) {
        try {
          rawEntries = await ImportService.decryptBackup(file, masterKey);
        } catch (e: any) {
          if (e.message === "AUTH_FAILED") {
            setStep('backup_password');
            return;
          }
          throw e;
        }
      } else if (file.name.endsWith('.csv')) {
        rawEntries = await ImportService.parseCSV(file);
      } else if (file.name.endsWith('.json')) {
        rawEntries = await ImportService.parseJSON(file);
      } else {
        throw new Error(lang === 'tr' ? "Desteklenmeyen dosya formatı" : "Unsupported file format");
      }

      const cleanEntries = ImportService.deduplicateIncoming(rawEntries) as any;
      setImportData(cleanEntries);
      setProgress(50);
      setStep('preview');
    } catch (err: any) {
      console.error("Import error:", err);
      let msg = err.message;
      if (err.message === "AUTH_FAILED") msg = t('wrong_password_backup') || t('wrong_password');
      else if (err.message === "INVALID_FORMAT") msg = lang === 'tr' ? "Geçersiz Aegis yedek formatı." : "Invalid Aegis backup format.";
      setError(msg);
      setStep('select');
    }
  };

  const handleBackupUnlock = async () => {
    if (!pendingFile || !backupPassword) return;
    setStep('processing');
    setError(null);
    setProgress(30);

    try {
      let rawEntries = await ImportService.decryptBackupWithPassword(pendingFile, backupPassword);
      setBackupPassword('');
      const cleanEntries = ImportService.deduplicateIncoming(rawEntries) as any;
      setImportData(cleanEntries);
      setProgress(50);
      setStep('preview');
    } catch (err: any) {
      console.error("Backup unlock error:", err);
      setError(t('wrong_password_backup') || t('wrong_password'));
      setStep('select');
    }
  };

  const startImport = async () => {
    setProgress(60);
    const foundConflicts = await ImportService.findConflicts(importData, entries);
    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts);
      setStep('conflicts');
    } else {
      await finalizeImport(importData);
    }
  };

  const finalizeImport = async (data: (Partial<VaultEntry> & { sensitive: SensitiveData })[]) => {
    if (!masterKey) return;
    setStep('processing');
    setProgress(80);

    try {
      await VaultService.bulkImport(data, masterKey);
      await loadEntries();
      await VaultService.deduplicateVault(masterKey);
      await loadEntries();
      setProgress(100);
      setStep('success');
    } catch (err: any) {
      setError(lang === 'tr' ? "İçe aktarma sırasında bir hata oluştu." : "Error during import process.");
      setStep('select');
    }
  };

  const handleExport = async () => {
    if (!masterKey) return;
    setStep('processing');
    setProgress(30);

    try {
      await ExportService.exportVault(masterKey, exportFormat, isEncrypted, customExportPassword, filteredExportEntries);
      setCustomExportPassword('');
      setProgress(100);
      setStep('success');
    } catch (e) {
      setError(lang === 'tr' ? "Dışa aktarma hatası" : "Export error");
      setStep('select');
    }
  };

  const toggleCategory = (cat: Category) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="glass border border-white/5 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col h-[600px]">
      {/* Background decoration */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="px-8 pt-8 z-20 flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-2xl">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">{t('data_tab')}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="p-1 bg-blue-500 rounded-full animate-pulse" />
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Protocol v4.2 Active</p>
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setStep('select');
            if (onClose) onClose();
          }}
          className="p-3 text-zinc-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-2xl cursor-pointer relative z-30"
          title={lang === 'tr' ? 'Kapat' : 'Close'}
        >
          <X size={20} />
        </motion.button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar z-10">
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Tab Selector */}
              <div className="flex p-1.5 bg-black/40 border border-white/5 rounded-2xl">
                {(['import', 'export'] as const).map((tab, idx) => (
                  <button
                    key={`wizard-tab-${tab}-${idx}`}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-400'
                      }`}
                  >
                    {activeTab === tab && (
                      <motion.div layoutId="activeTab" className="absolute inset-0 bg-white/5 rounded-xl border border-white/10" />
                    )}
                    <span className="relative z-10">{t(tab === 'import' ? 'import_vault' : 'export_vault')}</span>
                  </button>
                ))}
              </div>

              {activeTab === 'import' ? (
                <div className="space-y-6">
                  <motion.div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    className={`relative group h-64 border-2 border-dashed rounded-[2.5rem] transition-all flex flex-col items-center justify-center p-8 text-center cursor-pointer ${isDragging
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : 'border-white/5 bg-black/20 hover:border-white/10 hover:bg-black/30'
                      }`}
                  >
                    <input type="file" onChange={handleFileSelect} accept=".aegis,.csv,.json" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className={`p-6 bg-blue-500/10 text-blue-500 rounded-3xl mb-6 group-hover:scale-110 transition-transform ${isDragging ? 'scale-110 rotate-12' : ''}`}>
                      <Upload size={40} />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{t('drag_drop_hint')}</h3>
                    <p className="text-[10px] text-zinc-500 mt-2 font-bold uppercase tracking-widest">.aegis, .csv, .json (max 50MB)</p>
                  </motion.div>

                  <div className="p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-4">
                    <Info className="text-blue-500 flex-shrink-0" size={18} />
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {lang === 'tr'
                        ? "Diğer platformlardan veri taşırken CSV veya JSON kullanabilirsiniz. .aegis dosyaları en yüksek güvenliği sağlar."
                        : "Use CSV or JSON for migration from other platforms. .aegis files provide the highest security level."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Export Config Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{t('export_format_label')}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'aegis', icon: Shield, color: 'text-blue-500' },
                          { id: 'csv', icon: FileSpreadsheet, color: 'text-emerald-500' },
                          { id: 'json', icon: FileCode, color: 'text-amber-500' }
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => { setExportFormat(f.id as any); if (f.id === 'aegis') setIsEncrypted(true); }}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${exportFormat === f.id ? 'bg-white/5 border-white/20' : 'bg-black/20 border-white/5 text-zinc-600 grayscale opacity-60'
                              }`}
                          >
                            <f.icon className={exportFormat === f.id ? f.color : 'text-zinc-600'} size={16} />
                            <span className="text-[8px] font-black uppercase tracking-tight">{f.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{t('export_security_label')}</label>
                      <div className="flex gap-2 h-[52px]">
                        <button
                          onClick={() => setIsEncrypted(true)}
                          className={`flex-1 rounded-xl border flex items-center justify-center gap-3 transition-all ${isEncrypted ? 'bg-blue-600/10 border-blue-500/30 text-blue-500' : 'bg-black/20 border-white/5 text-zinc-700'
                            }`}
                        >
                          <Lock size={16} /><span className="text-[8px] font-black uppercase tracking-widest">SECURE</span>
                        </button>
                        <button
                          onClick={() => setIsEncrypted(false)}
                          disabled={exportFormat === 'aegis'}
                          className={`flex-1 rounded-xl border flex items-center justify-center gap-3 transition-all ${!isEncrypted ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-black/20 border-white/5 text-zinc-700'
                            }`}
                        >
                          <AlertTriangle size={16} /><span className="text-[8px] font-black uppercase tracking-widest">PLAIN</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('select_categories')}</label>
                      <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                        {filteredExportEntries.length} / {entries.length} {t('found_items').split(' ')[1]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(Category).map((cat, idx) => {
                        const Icon = CATEGORY_ICONS[cat] || Key;
                        const isSelected = selectedCategories.includes(cat);
                        const count = entries.filter(e => e.category === cat).length;
                        if (count === 0) return null;

                        return (
                          <button
                            key={`cat-filter-${cat}-${idx}`}
                            onClick={() => toggleCategory(cat)}
                            className={`px-4 py-2.5 rounded-xl border flex items-center gap-3 transition-all ${isSelected
                              ? 'bg-white/10 border-white/20 text-white'
                              : 'bg-black/20 border-white/5 text-zinc-600 hover:text-zinc-500'
                              }`}
                          >
                            <Icon size={14} className={isSelected ? 'text-blue-500' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{t(`cat_${cat.toLowerCase()}` as any) || cat}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/10 text-white' : 'bg-black/20'}`}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isEncrypted && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{t('custom_backup_password')}</label>
                      <div className="relative">
                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700" size={18} />
                        <input
                          type="password"
                          value={customExportPassword}
                          onChange={(e) => setCustomExportPassword(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-zinc-800 outline-none focus:border-blue-500/50 transition-all font-mono text-sm"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleExport}
                    disabled={filteredExportEntries.length === 0}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <Download size={18} />
                    {t('start_export_btn')}
                  </button>
                </div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                  <AlertTriangle size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <button onClick={() => setStep('select')} className="p-2.5 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                <div>
                  <h3 className="text-xl font-black text-white uppercase">{t('preview_data')}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t('import_preview_desc')}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">{t('total_entries').split(' ')[0]}</p>
                  <span className="text-3xl font-black text-white">{importData.length}</span>
                </div>
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">{t('backup_size')}</p>
                  <span className="text-3xl font-black text-white">{pendingFile ? (pendingFile.size / 1024).toFixed(1) : 0} KB</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{t('entries_categorized')}</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(importSummary).map(([cat, count]) => {
                    const Icon = CATEGORY_ICONS[cat as Category] || Key;
                    return (
                      <div key={cat} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/5 rounded-lg text-zinc-500"><Icon size={16} /></div>
                          <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">{t(`cat_${cat.toLowerCase()}` as any) || cat}</span>
                        </div>
                        <span className="text-xs font-black text-white">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sample Data Preview (First 3) */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">{lang === 'tr' ? 'Örnek İçerik' : 'Sample Content'}</label>
                <div className="space-y-2">
                  {importData.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 bg-white/[0.01] border border-white/5 rounded-xl opacity-60">
                      <span className="text-[10px] font-mono text-zinc-700">0{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-zinc-400 truncate uppercase">{item.title}</p>
                        <p className="text-[9px] font-bold text-zinc-600 truncate">{item.username || 'No Identity'}</p>
                      </div>
                    </div>
                  ))}
                  {importData.length > 3 && (
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center py-2">+ {importData.length - 3} {t('more_items')}</p>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <button onClick={startImport} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-emerald-900/10 transition-all flex items-center justify-center gap-3">
                  <CheckCircle2 size={18} />
                  {t('initialize')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 flex flex-col items-center">
              <div className="relative w-32 h-32 mb-12">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full" />
                <motion.div animate={{ rotate: -360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute inset-4 border-[2px] border-emerald-500/20 border-t-emerald-500 rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {activeTab === 'import' ? <Upload className="text-blue-500" size={32} /> : <Download className="text-emerald-500" size={32} />}
                </div>
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-[0.4em] mb-4">{progress === 100 ? (lang === 'tr' ? 'MÜKEMMEL' : 'EXCELLENT') : t('processing')}</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mb-8">{lang === 'tr' ? 'VERİLER KRİPTOGRAFİK OLARAK İŞLENİYOR' : 'PROCESSING CRYPTOGRAPHIC ASSETS'}</p>

              <div className="w-64 h-2 bg-black/40 border border-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className={`h-full ${activeTab === 'import' ? 'bg-blue-600' : 'bg-emerald-600'}`}
                />
              </div>
            </motion.div>
          )}

          {step === 'conflicts' && (
            <motion.div key="conflicts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl"><AlertTriangle size={24} /></div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase">{t('conflict_found')}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{lang === 'tr' ? `${conflicts.length} veri zaten mevcut` : `${conflicts.length} entries already exist`}</p>
                </div>
              </div>

              <div className="max-h-[280px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {conflicts.map((conflict, i) => (
                  <div key={i} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-black/40 rounded-lg text-zinc-700 group-hover:text-blue-500 transition-colors">
                        {React.createElement(CATEGORY_ICONS[conflict.existing.category] || Key, { size: 16 })}
                      </div>
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-tight">{conflict.existing.title}</span>
                        <p className="text-[10px] text-zinc-500 font-bold">{conflict.existing.username || 'No Identity'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updatedIncoming = { ...conflict.incoming, id: conflict.existing.id };
                          setImportData(prev => prev.map(item => (item.title === conflict.incoming.title && item.username === conflict.incoming.username) ? updatedIncoming : item));
                          setConflicts(prev => prev.filter((_, idx) => idx !== i));
                          if (conflicts.length === 1) finalizeImport(importData);
                        }}
                        className="px-3 py-2 bg-blue-600/10 text-[9px] font-black text-blue-400 rounded-xl uppercase hover:bg-blue-600 hover:text-white transition-all"
                      >
                        {t('overwrite')}
                      </button>
                      <button
                        onClick={() => {
                          setImportData(prev => prev.filter(item => !(item.title === conflict.incoming.title && item.username === conflict.incoming.username)));
                          setConflicts(prev => prev.filter((_, idx) => idx !== i));
                          if (conflicts.length === 1) finalizeImport(importData);
                        }}
                        className="px-3 py-2 bg-white/5 text-[9px] font-black text-zinc-500 rounded-xl uppercase hover:bg-white/10 hover:text-zinc-300 transition-all"
                      >
                        {t('skip')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button
                  onClick={() => {
                    const conflictKeys = new Set(conflicts.map(c => `${c.incoming.title}|${c.incoming.username}`));
                    const filtered = importData.filter(item => !conflictKeys.has(`${item.title}|${item.username}`));
                    if (filtered.length > 0) finalizeImport(filtered);
                    else setStep('select');
                  }}
                  className="py-4 bg-zinc-900 text-zinc-500 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-zinc-800 transition-all"
                >
                  {t('confirm_all_skip')}
                </button>
                <button
                  onClick={() => {
                    const norm = (s: string) => (s || '').toLowerCase().trim();
                    const updatedData = importData.map(item => {
                      const conflict = conflicts.find(c =>
                        norm(c.incoming.title) === norm(item.title) &&
                        norm(c.incoming.username) === norm(item.username)
                      );
                      return conflict ? { ...item, id: conflict.existing.id } : item;
                    });
                    finalizeImport(updatedData);
                  }}
                  className="py-4 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/20 hover:bg-blue-500 transition-all"
                >
                  {t('overwrite_all')}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-16 flex flex-col items-center text-center">
              <div className="relative mb-12">
                <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse" />
                <div className="relative w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center border border-emerald-500/20 shadow-inner">
                  <CheckCircle2 size={48} />
                </div>
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4">{activeTab === 'import' ? t('import_success') : (lang === 'tr' ? 'DIŞA AKTARMA BAŞARILI' : 'EXPORT SUCCESSFUL')}</h3>
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed max-w-xs">
                {activeTab === 'import'
                  ? t('import_success_desc')
                  : (lang === 'tr' ? 'Veritabanınız güvenli bir şekilde yedeklendi.' : 'Your database assets have been securely backed up.')}
              </p>

              <div className="mt-8 w-full max-w-xs mx-auto">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setStep('select');
                    if (onClose) onClose();
                  }}
                  className="w-full py-5 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl transition-all cursor-pointer relative z-30 shadow-lg shadow-black/20"
                >
                  {t('complete_btn')}
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'backup_password' && (
            <motion.div key="backup_password" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-[1.5rem] flex items-center justify-center mx-auto border border-amber-500/20">
                  <Lock size={40} />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('backup_password_required')}</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{lang === 'tr' ? 'BU YEDEKLEME ŞİFRELENMİŞTİR' : 'THIS BACKUP IS ENCRYPTED'}</p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700" size={20} />
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBackupUnlock()}
                    className="w-full bg-black/40 border border-white/5 rounded-[1.5rem] pl-16 pr-6 py-6 text-white placeholder-zinc-800 outline-none focus:border-blue-500/50 transition-all font-mono"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep('select')} className="flex-1 py-5 bg-white/5 text-zinc-500 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:text-zinc-400 transition-all">{t('cancel')}</button>
                  <button
                    onClick={handleBackupUnlock}
                    disabled={!backupPassword}
                    className="flex-[2] py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/20 transition-all"
                  >
                    {t('unlock_backup')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="px-8 py-4 bg-black/40 border-t border-white/5 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <ShieldCheck size={12} className="text-emerald-500" />
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">End-to-End Encrypted Handshake</span>
        </div>
        <div className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">
          {activeTab.toUpperCase()} PROTOCOL
        </div>
      </div>
    </div>
  );
};

export default PortabilityWizard;