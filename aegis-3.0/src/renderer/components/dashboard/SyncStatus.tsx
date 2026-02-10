import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, FileText, Check, AlertCircle, Smartphone, Laptop, Lock, FileJson, FileSpreadsheet } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';

type SyncMode = 'idle' | 'export-options' | 'import-options' | 'exporting' | 'importing' | 'success' | 'error';
type ExportFormat = 'json' | 'csv';

const SyncStatus: React.FC = () => {
    const { t } = useTranslation();
    const { entries } = useVaultStore();
    const [mode, setMode] = useState<SyncMode>('idle');
    const [message, setMessage] = useState<string>('');

    // Export options
    const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
    const [exportEncrypted, setExportEncrypted] = useState(false);
    const [exportPassword, setExportPassword] = useState('');

    // Import options
    const [importEncrypted, setImportEncrypted] = useState(false);
    const [importPassword, setImportPassword] = useState('');

    // Export: Yedek dosyası oluştur ve kaydet
    const handleExport = async () => {
        try {
            setMode('exporting');
            console.log('[SYNC] Starting export...', { format: exportFormat, encrypted: exportEncrypted });

            const options = {
                format: exportFormat,
                encrypted: exportEncrypted,
                password: exportEncrypted ? exportPassword : undefined
            };

            const result = await window.aegis.database.export(options);

            if (result.success) {
                const successMsg = t('sync.exportSuccess').replace('{count}', result.count.toString()) +
                    `\n\nFormat: ${result.format?.toUpperCase() || ''}\n` +
                    `${t('sync.encryptedBackup')}: ${result.encrypted ? t('common.yes') : t('common.no')}\n\n` +
                    `${t('entry.types.file')}: ${result.path}`;

                setMessage(successMsg);
                setMode('success');

                // Reset form
                setExportPassword('');

                // 4 saniye sonra idle'a dön
                setTimeout(() => setMode('idle'), 4000);
            } else if (result.cancelled) {
                setMode('idle');
            } else {
                setMessage(result.error || t('sync.exportFailed'));
                setMode('error');
            }
        } catch (error: any) {
            console.error('[SYNC] Export error:', error);
            setMessage(`${t('common.error')}: ${error.message || t('common.unknownError')}`);
            setMode('error');
        }
    };

    // Import: Yedek dosyasını seç ve içe aktar
    const handleImport = async () => {
        try {
            setMode('importing');
            console.log('[SYNC] Starting import...', { encrypted: importEncrypted });

            const options = {
                encrypted: importEncrypted,
                password: importEncrypted ? importPassword : undefined
            };

            const result = await window.aegis.database.import(options);

            if (result.success) {
                // Store'u güncelle
                await useVaultStore.getState().fetchEntries();

                setMessage(t('sync.importSuccessCount').replace('{count}', (result.count || 0).toString()));
                setMode('success');

                // Reset form
                setImportPassword('');

                // 3 saniye sonra idle'a dön
                setTimeout(() => setMode('idle'), 3000);
            } else if (result.cancelled) {
                setMode('idle');
            } else {
                setMessage(result.error || t('sync.importFailed'));
                setMode('error');
            }
        } catch (error: any) {
            console.error('[SYNC] Import error:', error);
            setMessage(`${t('common.error')}: ${error.message || t('common.unknownError')}`);
            setMode('error');
        }
    };

    return (
        <div className="glass-card-hover rounded-3xl p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-teal-400" />
                    <h3 className="text-lg font-semibold">{t('sync.title')}</h3>
                </div>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {mode === 'idle' && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col gap-4"
                    >
                        {/* Info */}
                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                            <p className="text-sm text-indigo-300 leading-relaxed">
                                <strong>{t('sync.fileSyncTitle')}</strong><br />
                                {t('sync.fileSyncDesc')}
                            </p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="text-2xl font-bold text-teal-400">
                                    {entries.filter(e => e.category !== 'Trash').length}
                                </div>
                                <div className="text-xs text-white/40 mt-1">{t('sync.activePasswords')}</div>
                            </div>
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="text-2xl font-bold text-indigo-400">
                                    {entries.length}
                                </div>
                                <div className="text-xs text-white/40 mt-1">{t('sync.totalEntries')}</div>
                            </div>
                        </div>

                        {/* How it works */}
                        <div className="flex-1 flex flex-col gap-3">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-teal-500/20 rounded-lg">
                                        <Laptop className="w-4 h-4 text-teal-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-white/80 mb-1">{t('sync.step1Title')}</p>
                                        <p className="text-[10px] text-white/50">
                                            {t('sync.step1Desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                                        <Smartphone className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-white/80 mb-1">{t('sync.step2Title')}</p>
                                        <p className="text-[10px] text-white/50">
                                            {t('sync.step2Desc')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setMode('export-options')}
                                className="w-full p-4 rounded-xl bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30 hover:border-teal-500/50 transition-all group"
                            >
                                <div className="flex items-center justify-center gap-3">
                                    <Download className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-teal-400">{t('sync.createBackup')}</span>
                                </div>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setMode('import-options')}
                                className="w-full p-4 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 hover:border-indigo-500/50 transition-all group"
                            >
                                <div className="flex items-center justify-center gap-3">
                                    <Upload className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-indigo-400">{t('sync.loadBackup')}</span>
                                </div>
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {mode === 'export-options' && (
                    <motion.div
                        key="export-options"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col gap-4"
                    >
                        <h4 className="text-sm font-bold text-teal-400">{t('sync.exportOptions')}</h4>

                        {/* Format Selection */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">{t('sync.fileFormat')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setExportFormat('json')}
                                    className={`p-3 rounded-xl border transition-all ${exportFormat === 'json'
                                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-400'
                                        : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                                        }`}
                                >
                                    <FileJson className="w-5 h-5 mx-auto mb-1" />
                                    <div className="text-xs font-bold">JSON</div>
                                </button>
                                <button
                                    onClick={() => setExportFormat('csv')}
                                    className={`p-3 rounded-xl border transition-all ${exportFormat === 'csv'
                                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-400'
                                        : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                                        }`}
                                >
                                    <FileSpreadsheet className="w-5 h-5 mx-auto mb-1" />
                                    <div className="text-xs font-bold">CSV</div>
                                </button>
                            </div>
                        </div>

                        {/* Encryption Option */}
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-orange-400" />
                                    <span className="text-sm font-bold text-white/80">{t('sync.encryptedBackup')}</span>
                                </div>
                                <button
                                    onClick={() => setExportEncrypted(!exportEncrypted)}
                                    className={`relative w-10 h-5 rounded-full transition-all ${exportEncrypted ? 'bg-orange-500/30' : 'bg-white/10'
                                        }`}
                                >
                                    <div
                                        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${exportEncrypted ? 'left-5 bg-orange-400' : 'left-0.5 bg-white/40'
                                            }`}
                                    />
                                </button>
                            </div>
                            {exportEncrypted && (
                                <input
                                    type="password"
                                    placeholder={t('sync.backupPassword')}
                                    value={exportPassword}
                                    onChange={(e) => setExportPassword(e.target.value)}
                                    className="w-full mt-2 bg-navy-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                                />
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-auto">
                            <button
                                onClick={() => setMode('idle')}
                                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 text-sm font-medium transition-all"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={exportEncrypted && !exportPassword}
                                className="flex-1 px-4 py-3 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 rounded-xl text-teal-400 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('sync.createBackup').split(' ')[0]}
                            </button>
                        </div>
                    </motion.div>
                )}

                {mode === 'import-options' && (
                    <motion.div
                        key="import-options"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 flex flex-col gap-4"
                    >
                        <h4 className="text-sm font-bold text-indigo-400">{t('sync.importOptions')}</h4>

                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                            <p className="text-xs text-indigo-300/80 leading-relaxed">
                                {t('breach.importDesc')}
                            </p>
                        </div>

                        {/* Encryption Option */}
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-orange-400" />
                                    <span className="text-sm font-bold text-white/80">{t('sync.encryptedBackup')}</span>
                                </div>
                                <button
                                    onClick={() => setImportEncrypted(!importEncrypted)}
                                    className={`relative w-10 h-5 rounded-full transition-all ${importEncrypted ? 'bg-orange-500/30' : 'bg-white/10'
                                        }`}
                                >
                                    <div
                                        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${importEncrypted ? 'left-5 bg-orange-400' : 'left-0.5 bg-white/40'
                                            }`}
                                    />
                                </button>
                            </div>
                            {importEncrypted && (
                                <input
                                    type="password"
                                    placeholder={t('sync.backupPassword')}
                                    value={importPassword}
                                    onChange={(e) => setImportPassword(e.target.value)}
                                    className="w-full mt-2 bg-navy-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                                />
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-auto">
                            <button
                                onClick={() => setMode('idle')}
                                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 text-sm font-medium transition-all"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={importEncrypted && !importPassword}
                                className="flex-1 px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-indigo-400 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('sync.loadBackup').split(' ')[0]}
                            </button>
                        </div>
                    </motion.div>
                )}

                {(mode === 'exporting' || mode === 'importing') && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex-1 flex flex-col items-center justify-center"
                    >
                        <div className="relative mb-4">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-16 h-16 border-4 border-t-teal-500 border-white/10 rounded-full"
                            />
                            {mode === 'exporting' ? (
                                <Download className="absolute inset-0 m-auto w-6 h-6 text-teal-400" />
                            ) : (
                                <Upload className="absolute inset-0 m-auto w-6 h-6 text-indigo-400" />
                            )}
                        </div>
                        <p className="text-white/60">
                            {mode === 'exporting' ? t('sync.creatingBackup') : t('sync.loadingBackup')}
                        </p>
                    </motion.div>
                )}

                {mode === 'success' && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex-1 flex flex-col items-center justify-center"
                    >
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-10 h-10 text-emerald-400" />
                        </div>
                        <p className="text-lg font-bold text-emerald-400 mb-2">{t('common.success')}</p>
                        <p className="text-sm text-white/60 text-center px-4 whitespace-pre-line">
                            {message}
                        </p>
                    </motion.div>
                )}

                {mode === 'error' && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex-1 flex flex-col items-center justify-center"
                    >
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="w-10 h-10 text-red-400" />
                        </div>
                        <p className="text-lg font-bold text-red-400 mb-2">{t('common.error')}</p>
                        <p className="text-sm text-white/60 text-center px-4">
                            {message}
                        </p>
                        <button
                            onClick={() => setMode('idle')}
                            className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                        >
                            {t('common.close')}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SyncStatus;
