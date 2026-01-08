import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Download, FileJson, FileSpreadsheet, X, CheckCircle2,
  AlertTriangle, ArrowRight, Loader2, ShieldCheck, Database, Printer,
  Shield, Lock, FileCode, Check, ChevronLeft
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useVault } from '../hooks/useVault';
import { ExportService, ExportFormat } from '../services/exportService';
import { ImportService, ImportConflict } from '../services/importService';
import { VaultService } from '../services/vaultService';
import { VaultEntry, SensitiveData } from '../types';

type WizardStep = 'select' | 'processing' | 'conflicts' | 'success' | 'export_config' | 'emergency_sheet' | 'backup_password';

const PortabilityWizard: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t, lang } = useLanguage();
  const { masterKey } = useAuth();
  const { entries, loadEntries } = useVault();

  const [step, setStep] = useState<WizardStep>('select');
  const [importData, setImportData] = useState<(Partial<VaultEntry> & { sensitive: SensitiveData })[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [backupPassword, setBackupPassword] = useState('');
  const [customExportPassword, setCustomExportPassword] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Export Settings
  const [exportFormat, setExportFormat] = useState<ExportFormat>('aegis');
  const [isEncrypted, setIsEncrypted] = useState(true);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !masterKey) return;

    setStep('processing');
    setError(null);
    setProgress(10);

    try {
      let rawEntries: (Partial<VaultEntry> & { sensitive: SensitiveData })[] = [];

      if (file.name.endsWith('.aegis')) {
        try {
          rawEntries = await ImportService.decryptBackup(file, masterKey);
        } catch (e: any) {
          if (e.message === "AUTH_FAILED") {
            setPendingFile(file);
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
        throw new Error("Unsupported file format");
      }

      rawEntries = ImportService.deduplicateIncoming(rawEntries) as any;

      setProgress(50);
      const foundConflicts = await ImportService.findConflicts(rawEntries, entries);

      if (foundConflicts.length > 0) {
        setImportData(rawEntries);
        setConflicts(foundConflicts);
        setStep('conflicts');
      } else {
        await finalizeImport(rawEntries);
      }
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
      setPendingFile(null);

      rawEntries = ImportService.deduplicateIncoming(rawEntries) as any;

      setProgress(50);
      const foundConflicts = await ImportService.findConflicts(rawEntries, entries);
      if (foundConflicts.length > 0) {
        setImportData(rawEntries);
        setConflicts(foundConflicts);
        setStep('conflicts');
      } else {
        await finalizeImport(rawEntries);
      }
    } catch (err: any) {
      console.error("Backup unlock error:", err);
      setError(t('wrong_password_backup') || t('wrong_password'));
      setStep('select');
    }
  };

  const finalizeImport = async (data: (Partial<VaultEntry> & { sensitive: SensitiveData })[]) => {
    if (!masterKey) return;
    setStep('processing');
    setProgress(70);

    try {
      await VaultService.bulkImport(data, masterKey);
      await loadEntries();

      // Duplicate kontrolü ve temizleme
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
      await ExportService.exportVault(masterKey, exportFormat, isEncrypted, customExportPassword);
      setCustomExportPassword('');
      setProgress(100);
      setStep('success');
    } catch (e) {
      setError(lang === 'tr' ? "Dışa aktarma hatası" : "Export error");
      setStep('select');
    }
  };

  const handleOverwrite = async (conflict: ImportConflict, index: number) => {
    const updatedIncoming = { ...conflict.incoming, id: conflict.existing.id };
    setImportData(prev => prev.map(item =>
      (item.title === conflict.incoming.title && item.username === conflict.incoming.username) ? updatedIncoming : item
    ));
    setConflicts(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSkip = (conflict: ImportConflict, index: number) => {
    setImportData(prev => prev.filter(item =>
      !(item.title === conflict.incoming.title && item.username === conflict.incoming.username)
    ));
    setConflicts(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSkipAllConflicts = async () => {
    const conflictTitles = new Set(conflicts.map(c => `${c.incoming.title}|${c.incoming.username}`));
    const filteredData = importData.filter(item => !conflictTitles.has(`${item.title}|${item.username}`));
    if (filteredData.length > 0) await finalizeImport(filteredData);
    else setStep('select');
  };

  return (
    <div className="glass border border-white/5 rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl relative overflow-hidden">
      <div className="absolute top-8 right-8 z-20">
        <button
          onClick={() => onClose ? onClose() : setStep('select')}
          className="p-3 text-zinc-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-2xl active:scale-95"
        >
          <X size={24} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-black text-white tracking-tight uppercase">{t('data_tab')}</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Data Portability Protocol v4.2</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => setStep('export_config')}
                className="group p-8 glass border border-white/5 rounded-[2.5rem] hover:border-blue-500/30 transition-all flex flex-col items-center text-center space-y-4"
              >
                <div className="p-4 bg-blue-600/10 text-blue-500 rounded-3xl group-hover:scale-110 transition-transform"><Download size={32} /></div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{t('export_vault')}</h3>
                  <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{t('export_desc')}</p>
                </div>
              </button>

              <div className="relative group p-8 glass border border-white/5 rounded-[2.5rem] hover:border-emerald-500/30 transition-all flex flex-col items-center text-center space-y-4">
                <input type="file" onChange={handleFileSelect} accept=".aegis,.csv,.json" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="p-4 bg-emerald-600/10 text-emerald-500 rounded-3xl group-hover:scale-110 transition-transform"><Upload size={32} /></div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{t('import_vault')}</h3>
                  <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{t('import_desc')}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                <AlertTriangle size={18} /><span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
              </div>
            )}
          </motion.div>
        )}

        {step === 'export_config' && (
          <motion.div key="export_config" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
              <button onClick={() => setStep('select')} className="p-2 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
              <div>
                <h3 className="text-xl font-black text-white uppercase">{t('export_settings_title')}</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t('export_settings_desc')}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">{t('export_format_label')}</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'aegis', label: 'AEGIS Secure', icon: Shield, color: 'text-blue-500' },
                    { id: 'csv', label: 'CSV (Universal)', icon: FileSpreadsheet, color: 'text-emerald-500' },
                    { id: 'json', label: 'JSON (Raw)', icon: FileCode, color: 'text-amber-500' }
                  ].map(f => (
                    <button key={f.id} onClick={() => { setExportFormat(f.id as any); if (f.id === 'aegis') setIsEncrypted(true); }} className={`p-4 rounded-2xl border flex flex-col items-center gap-3 transition-all ${exportFormat === f.id ? 'bg-zinc-800 border-white/20' : 'bg-black/40 border-white/5 text-zinc-600'}`}>
                      <f.icon className={exportFormat === f.id ? f.color : 'text-zinc-700'} size={20} /><span className="text-[9px] font-black uppercase tracking-widest">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">{t('export_security_label')}</label>
                <div className="flex gap-3">
                  <button onClick={() => setIsEncrypted(true)} className={`flex-1 p-5 rounded-2xl border flex items-center gap-4 transition-all ${isEncrypted ? 'bg-blue-600/10 border-blue-500/30' : 'bg-black/40 border-white/5 opacity-50'}`}><Lock className={isEncrypted ? 'text-blue-500' : 'text-zinc-700'} size={20} /><div className="text-left"><span className="text-[10px] font-black text-white uppercase block">{t('export_secure_btn')}</span></div></button>
                  <button onClick={() => setIsEncrypted(false)} className={`flex-1 p-5 rounded-2xl border flex items-center gap-4 transition-all ${!isEncrypted ? 'bg-red-500/10 border-red-500/30' : 'bg-black/40 border-white/5'}`}><AlertTriangle className={!isEncrypted ? 'text-red-500' : 'text-zinc-700'} size={20} /><div className="text-left"><span className="text-[10px] font-black text-white uppercase block">{t('export_plain_btn')}</span></div></button>
                </div>
              </div>

              {isEncrypted && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">{t('custom_backup_password')}</label>
                  <input type="password" value={customExportPassword} onChange={(e) => setCustomExportPassword(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-700 outline-none focus:border-blue-500/50 transition-all font-mono text-sm" placeholder="••••••••" />
                </div>
              )}

              <button onClick={handleExport} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-xl transition-all active:scale-95">{t('start_export_btn')}</button>
            </div>
          </motion.div>
        )}

        {step === 'backup_password' && (
          <motion.div key="backup_password" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto"><ShieldCheck size={40} /></div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('backup_password_required') || 'BACKUP PASSWORD'}</h2>
            </div>
            <div className="space-y-4">
              <input type="password" value={backupPassword} onChange={(e) => setBackupPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBackupUnlock()} className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-white placeholder-zinc-700 outline-none focus:border-blue-500/50 transition-all font-mono" placeholder="••••••••" autoFocus />
              <div className="flex gap-4">
                <button onClick={() => setStep('select')} className="flex-1 py-4 bg-zinc-900 text-zinc-400 font-black text-[10px] uppercase tracking-widest rounded-2xl">{t('cancel')}</button>
                <button onClick={handleBackupUnlock} disabled={!backupPassword} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl transition-all">{t('unlock_backup') || 'UNLOCK'}</button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 flex flex-col items-center">
            <div className="relative w-24 h-24 mb-10">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center"><Database className="text-blue-500" size={32} /></div>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-[0.3em]">{progress === 100 ? (lang === 'tr' ? 'BAŞARILI' : 'SUCCESS') : t('processing')}</h3>
            <div className="w-64 h-1.5 bg-zinc-900 rounded-full mt-6 overflow-hidden">
              <motion.div animate={{ width: `${progress}%` }} className="h-full bg-blue-600" />
            </div>
          </motion.div>
        )}

        {step === 'conflicts' && (
          <motion.div key="conflicts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
              <AlertTriangle className="text-amber-500" size={32} />
              <div>
                <h3 className="text-xl font-black text-white uppercase">{t('conflict_found')}</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{lang === 'tr' ? `${conflicts.length} kayıt bulundu` : `Found ${conflicts.length} entries`}</p>
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {conflicts.map((conflict, i) => (
                <div key={i} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-white">{conflict.existing.title}</span>
                    <p className="text-[10px] text-zinc-500 font-bold">{conflict.existing.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleOverwrite(conflict, i)} className="px-3 py-1.5 bg-blue-600/20 text-[9px] font-black text-blue-400 rounded-lg uppercase hover:bg-blue-600/40 transition-all">{t('overwrite')}</button>
                    <button onClick={() => handleSkip(conflict, i)} className="px-3 py-1.5 bg-zinc-800 text-[9px] font-black text-zinc-500 rounded-lg uppercase hover:bg-zinc-700 transition-all">{t('skip')}</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={handleSkipAllConflicts} className="py-5 bg-zinc-900 text-zinc-400 font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all">{t('confirm_all_skip')}</button>
              <button onClick={() => finalizeImport(importData)} className="py-5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20">{t('overwrite_all') || 'OVERWRITE ALL'} <ArrowRight size={16} /></button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-20 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-8"><CheckCircle2 size={48} /></div>
            <h3 className="text-2xl font-black text-white uppercase tracking-widest">{t('import_success')}</h3>
            <div className="mt-10 w-full">
              <button onClick={() => onClose ? onClose() : setStep('select')} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all">{t('complete_btn')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortabilityWizard;