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
import EmergencySheet from './EmergencySheet';

type WizardStep = 'select' | 'processing' | 'conflicts' | 'success' | 'emergency_sheet' | 'export_config';

const PortabilityWizard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, lang } = useLanguage();
  const { masterKey } = useAuth();
  const { entries, loadEntries } = useVault();

  const [step, setStep] = useState<WizardStep>('select');
  const [importData, setImportData] = useState<(Partial<VaultEntry> & { sensitive: SensitiveData })[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

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
        rawEntries = await ImportService.decryptBackup(file, masterKey);
      } else if (file.name.endsWith('.csv')) {
        rawEntries = await ImportService.parseCSV(file);
      } else if (file.name.endsWith('.json')) {
        rawEntries = await ImportService.parseJSON(file);
      } else {
        throw new Error("Unsupported file format");
      }

      setProgress(50);
      const foundConflicts = await ImportService.findConflicts(rawEntries);

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

      if (err.message === "AUTH_FAILED") msg = t('wrong_password');
      else if (err.message === "INVALID_FORMAT") msg = lang === 'tr' ? "Geçersiz Aegis yedek formatı." : "Invalid Aegis backup format.";
      else if (err.message === "USE_SECURE_IMPORT") msg = lang === 'tr' ? "Bu bir şifreli yedek dosyasıdır. Lütfen '.aegis' uzantılı olduğundan emin olun veya doğru yöntemle içeri aktarın." : "This is an encrypted backup. Please ensure it has .aegis extension.";
      else if (err.message === "INVALID_JSON_NUMBER") msg = lang === 'tr' ? "JSON dosyasında hatalı sayı biçimi tespit edildi (Line 1 Col 3 hatası giderildi)." : "Invalid number format detected in JSON.";
      else if (err.message === "JSON_PARSE_ERROR") msg = lang === 'tr' ? "JSON dosyası okunamadı, formatı kontrol edin." : "JSON file could not be parsed, check the format.";

      setError(msg);
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
      await ExportService.exportVault(masterKey, exportFormat, isEncrypted);
      setProgress(100);
      setStep('success');
    } catch (e) {
      setError(lang === 'tr' ? "Dışa aktarma hatası" : "Export error");
      setStep('select');
    }
  };

  return (
    <div className="glass border border-white/5 rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl relative overflow-hidden">
      <div className="absolute top-8 right-8 z-20">
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
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
                <div className="p-4 bg-blue-600/10 text-blue-500 rounded-3xl group-hover:scale-110 transition-transform">
                  <Download size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{t('export_vault')}</h3>
                  <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{t('export_desc')}</p>
                </div>
              </button>

              <div className="relative group p-8 glass border border-white/5 rounded-[2.5rem] hover:border-emerald-500/30 transition-all flex flex-col items-center text-center space-y-4">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".aegis,.csv,.json"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="p-4 bg-emerald-600/10 text-emerald-500 rounded-3xl group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{t('import_vault')}</h3>
                  <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{t('import_desc')}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                <AlertTriangle size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
              </div>
            )}
          </motion.div>
        )}

        {step === 'export_config' && (
          <motion.div key="export_config" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
              <button onClick={() => setStep('select')} className="p-2 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
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
                      <f.icon className={exportFormat === f.id ? f.color : 'text-zinc-700'} size={20} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">{t('export_security_label')}</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEncrypted(true)}
                    className={`flex-1 p-5 rounded-2xl border flex items-center gap-4 transition-all ${isEncrypted ? 'bg-blue-600/10 border-blue-500/30' : 'bg-black/40 border-white/5 opacity-50'}`}
                  >
                    <Lock className={isEncrypted ? 'text-blue-500' : 'text-zinc-700'} size={20} />
                    <div className="text-left">
                      <span className="text-[10px] font-black text-white uppercase block">{t('export_secure_btn')}</span>
                      <span className="text-[8px] text-zinc-500 uppercase font-bold">{t('export_secure_hint')}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setIsEncrypted(false)}
                    className={`flex-1 p-5 rounded-2xl border flex items-center gap-4 transition-all ${!isEncrypted ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.05)]' : 'bg-black/40 border-white/5'}`}
                  >
                    <AlertTriangle className={!isEncrypted ? 'text-red-500' : 'text-zinc-700'} size={20} />
                    <div className="text-left">
                      <span className="text-[10px] font-black text-white uppercase block">{t('export_plain_btn')}</span>
                      <span className="text-[8px] text-zinc-500 uppercase font-bold">{t('export_plain_hint')}</span>
                    </div>
                  </button>
                </div>
              </div>

              {!isEncrypted && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 items-center">
                  <AlertTriangle className="text-red-500 shrink-0" size={18} />
                  <p className="text-[9px] text-red-500 font-black uppercase tracking-widest leading-relaxed">
                    {t('export_warning_plain')}
                  </p>
                </div>
              )}

              <button
                onClick={handleExport}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-xl transition-all active:scale-95"
              >
                {t('start_export_btn')}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 flex flex-col items-center">
            <div className="relative w-24 h-24 mb-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Database className="text-blue-500" size={32} />
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-[0.3em]">{progress === 100 ? (lang === 'tr' ? 'BAŞARILI' : 'SUCCESS') : t('processing')}</h3>
            <div className="w-64 h-1.5 bg-zinc-900 rounded-full mt-6 overflow-hidden">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="h-full bg-blue-600"
              />
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
                    <button onClick={() => finalizeImport([conflict.incoming])} className="px-3 py-1.5 bg-zinc-800 text-[9px] font-black text-white rounded-lg uppercase">{t('overwrite')}</button>
                    <button onClick={() => setConflicts(prev => prev.filter((_, idx) => idx !== i))} className="px-3 py-1.5 bg-zinc-800 text-[9px] font-black text-zinc-500 rounded-lg uppercase">{t('skip')}</button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => finalizeImport(importData)}
              className="w-full py-5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3"
            >
              {t('confirm_all_skip')} <ArrowRight size={16} />
            </button>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-20 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-8">
              <CheckCircle2 size={48} />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-widest">{t('import_success')}</h3>
            <p className="text-xs text-zinc-500 mt-4 font-bold uppercase tracking-widest">{t('import_success_desc')}</p>

            <div className="mt-10 flex gap-4 w-full">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
              >
                {t('complete_btn')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortabilityWizard;