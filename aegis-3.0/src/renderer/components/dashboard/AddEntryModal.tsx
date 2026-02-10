import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../ui/Modal';
import { useVaultStore, EntryType } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
    Shield,
    Globe,
    User,
    Lock,
    Tag,
    FileText,
    Wallet,
    StickyNote,
    Upload,
    File,
    X,
    Key,
    CreditCard,
    Contact,
    Terminal,
    Award,
    Zap,
    Camera,
    QrCode
} from 'lucide-react';
import { QRScanner } from '../ui/QRScanner';

interface AddEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { saveEntry, editingEntry, setEditingEntry } = useVaultStore();
    const [type, setType] = useState<EntryType>('login');
    const [file, setFile] = useState<File | null>(null);
    const [showScanner, setShowScanner] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        title: '',
        website: '',
        username: '',
        password: '',
        notes: '',
        walletAddress: '',
        seedPhrase: '',
        cardNumber: '',
        cardHolder: '',
        expiryDate: '',
        cvv: '',
        idNumber: '',
        fullName: '',
        licenseKey: '',
        version: '',
        privateKey: '',
        publicKey: '',
        passphrase: '',
        totpSecret: '',
        category: t('entry.categories.general'),
    });

    // Populate form if editing
    React.useEffect(() => {
        if (editingEntry) {
            setType(editingEntry.type);
            setFormData({
                title: editingEntry.title || '',
                website: editingEntry.website || '',
                username: editingEntry.username || '',
                password: editingEntry.password || '',
                notes: editingEntry.notes || '',
                walletAddress: editingEntry.walletAddress || '',
                seedPhrase: editingEntry.seedPhrase || '',
                cardNumber: editingEntry.cardNumber || '',
                cardHolder: editingEntry.cardHolder || '',
                expiryDate: editingEntry.expiryDate || '',
                cvv: editingEntry.cvv || '',
                idNumber: editingEntry.idNumber || '',
                fullName: editingEntry.fullName || '',
                licenseKey: editingEntry.licenseKey || '',
                version: editingEntry.version || '',
                privateKey: editingEntry.privateKey || '',
                publicKey: editingEntry.publicKey || '',
                passphrase: editingEntry.passphrase || '',
                totpSecret: editingEntry.totpSecret || '',
                category: editingEntry.category || t('entry.categories.general'),
            });
        } else {
            resetForm();
        }
    }, [editingEntry]);


    const resetForm = () => {
        setFormData({
            title: '',
            website: '',
            username: '',
            password: '',
            notes: '',
            walletAddress: '',
            seedPhrase: '',
            cardNumber: '',
            cardHolder: '',
            expiryDate: '',
            cvv: '',
            idNumber: '',
            fullName: '',
            licenseKey: '',
            version: '',
            privateKey: '',
            publicKey: '',
            passphrase: '',
            totpSecret: '',
            category: t('entry.categories.general'),
        });

        setFile(null);
        setType('login');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        if (selectedFile.size > 50 * 1024 * 1024) {
            alert(t('entry.fileSizeLimit'));
            return;
        }
        setFile(selectedFile);
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let entryData: any = {
                id: editingEntry ? editingEntry.id : crypto.randomUUID(),
                type,
                title: formData.title || (type === 'file' ? file?.name : t('entry.types.entry')),
                category: formData.category,
                lastUsed: new Date().toISOString(),
                strength: 'Strong'
            };

            // INPUT VALIDATION (Validation improvement)
            if (formData.title && formData.title.length < 3) {
                alert('Başlık en az 3 karakter olmalıdır.');
                return;
            }

            if (type === 'login' && formData.password.length < 8) {
                alert('Şifre en az 8 karakter olmalıdır.');
                return;
            }

            // Mapping form data based on type
            if (type === 'login') {
                entryData = { ...entryData, website: formData.website, username: formData.username, password: formData.password, totpSecret: formData.totpSecret };
            } else if (type === 'note') {
                entryData = { ...entryData, notes: formData.notes };
            } else if (type === 'wallet') {
                entryData = { ...entryData, walletAddress: formData.walletAddress, seedPhrase: formData.seedPhrase };
            } else if (type === 'card') {
                entryData = { ...entryData, cardNumber: formData.cardNumber, cardHolder: formData.cardHolder, expiryDate: formData.expiryDate, cvv: formData.cvv };
            } else if (type === 'identity') {
                entryData = { ...entryData, idNumber: formData.idNumber, fullName: formData.fullName };
            } else if (type === 'license') {
                entryData = { ...entryData, licenseKey: formData.licenseKey, version: formData.version };
            } else if (type === 'ssh') {
                entryData = { ...entryData, privateKey: formData.privateKey, publicKey: formData.publicKey, passphrase: formData.passphrase };
            } else if (type === 'file' && file) {
                const base64 = await fileToBase64(file);
                entryData = {
                    ...entryData,
                    fileData: base64,
                    fileName: file.name,
                    fileSize: file.size
                };
            }

            await saveEntry(entryData);
            setEditingEntry(null);
            onClose();
            resetForm();
        } catch (error) {
            console.error('Kaydetme hatası:', error);
            alert(t('vault.deleteFailed')); // Reusing for generic error
        }
    };

    const typeButtons = [
        { id: 'login', label: t('entry.types.login'), icon: <Lock size={18} /> },
        { id: 'card', label: t('entry.types.card'), icon: <CreditCard size={18} /> },
        { id: 'identity', label: t('entry.types.identity'), icon: <Contact size={18} /> },
        { id: 'note', label: t('entry.types.note'), icon: <StickyNote size={18} /> },
        { id: 'wallet', label: t('entry.types.wallet'), icon: <Wallet size={18} /> },
        { id: 'license', label: t('entry.types.license'), icon: <Award size={18} /> },
        { id: 'ssh', label: t('entry.types.ssh'), icon: <Terminal size={18} /> },
        { id: 'file', label: t('entry.types.file'), icon: <FileText size={18} /> },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingEntry ? t('dashboard.editEntry') : t('dashboard.addEntry')}>
            <div className="space-y-6">
                {/* Type Selector */}
                <div className="grid grid-cols-4 gap-2 p-1 bg-navy-950/50 rounded-2xl border border-white/5 overflow-x-auto">
                    {typeButtons.map((btn) => (
                        <button
                            key={btn.id}
                            type="button"
                            onClick={() => setType(btn.id as EntryType)}
                            className={`
                                flex flex-col items-center gap-2 py-3 rounded-xl transition-all min-w-[70px]
                                ${type === btn.id
                                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'}
                            `}
                        >
                            {btn.icon}
                            <span className="text-[9px] font-bold uppercase tracking-wider text-center">{btn.label}</span>
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                    {/* Common Title */}
                    {type !== 'file' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                <Tag className="w-4 h-4" /> {t('entry.title')}
                            </label>
                            <input
                                required
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder={t('entry.titlePlaceholder')}
                                className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                        </div>
                    )}

                    {/* Login Specific */}
                    {type === 'login' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Globe className="w-4 h-4" /> {t('entry.website')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                    placeholder="https://google.com"
                                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                        <User className="w-4 h-4" /> {t('entry.username')}
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                            <Lock className="w-4 h-4" /> {t('entry.password')}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const pwd = await window.aegis.crypto.generatePassword({ length: 16 });
                                                setFormData({ ...formData, password: pwd });
                                            }}
                                            className="text-[10px] uppercase tracking-widest font-black text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            {t('dashboard.generate')}
                                        </button>
                                    </div>
                                    <input
                                        required
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <QrCode className="w-4 h-4" /> TOTP Secret (2FA)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.totpSecret}
                                        onChange={(e) => setFormData({ ...formData, totpSecret: e.target.value })}
                                        placeholder="JBSWY3DPEHPK3PXP"
                                        className="flex-1 bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowScanner(true)}
                                        className="px-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/60 hover:text-white transition-all flex items-center gap-2 text-xs font-bold"
                                    >
                                        <Camera className="w-4 h-4" /> Tara
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <AnimatePresence>
                        {showScanner && (
                            <QRScanner
                                onScan={(data) => {
                                    if (data.startsWith('otpauth://')) {
                                        try {
                                            const url = new URL(data);
                                            const secret = url.searchParams.get('secret');
                                            if (secret) {
                                                setFormData({ ...formData, totpSecret: secret });
                                            }
                                        } catch (e) {
                                            setFormData({ ...formData, totpSecret: data });
                                        }
                                    } else {
                                        setFormData({ ...formData, totpSecret: data });
                                    }
                                    setShowScanner(false);
                                }}
                                onClose={() => setShowScanner(false)}
                            />
                        )}
                    </AnimatePresence>

                    {/* Card Specific */}
                    {type === 'card' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" /> {t('entry.cardNumber')}
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.cardNumber}
                                    onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                                    placeholder="0000 0000 0000 0000"
                                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <User className="w-4 h-4" /> {t('entry.cardHolder')}
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.cardHolder}
                                    onChange={(e) => setFormData({ ...formData, cardHolder: e.target.value })}
                                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                        <Shield className="w-4 h-4" /> {t('entry.expiryDate')}
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="MM/YY"
                                        value={formData.expiryDate}
                                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                        className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                        <Lock className="w-4 h-4" /> {t('entry.cvv')}
                                    </label>
                                    <input
                                        required
                                        type="password"
                                        maxLength={4}
                                        value={formData.cvv}
                                        onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
                                        className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Identity Specific */}
                    {type === 'identity' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <User className="w-4 h-4" /> {t('entry.fullName')}
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Contact className="w-4 h-4" /> {t('entry.idNumber')}
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.idNumber}
                                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                        </>
                    )}

                    {/* Node Specific */}
                    {type === 'note' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                <StickyNote className="w-4 h-4" /> {t('entry.notes')}
                            </label>
                            <textarea
                                required
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder={t('entry.notesPlaceholder')}
                                rows={6}
                                className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                            />
                        </div>
                    )}

                    {/* License Specific */}
                    {type === 'license' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Award className="w-4 h-4" /> {t('entry.licenseKey')}
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.licenseKey}
                                    onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> {t('entry.version')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    placeholder="1.0.0"
                                    className="w-full bg-navy-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                        </>
                    )}

                    {/* SSH Specific */}
                    {type === 'ssh' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Terminal className="w-4 h-4" /> {t('entry.privateKey')}
                                </label>
                                <textarea
                                    required
                                    value={formData.privateKey}
                                    onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                                    rows={4}
                                    className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-[10px] focus:outline-none focus:border-indigo-500/50 resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Key className="w-4 h-4" /> {t('entry.passphrase')}
                                </label>
                                <input
                                    type="password"
                                    value={formData.passphrase}
                                    onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                                    className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                        </div>
                    )}

                    {/* Wallet Specific */}
                    {type === 'wallet' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Wallet className="w-4 h-4" /> {t('entry.walletAddress')}
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={formData.walletAddress}
                                    onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                                    placeholder="0x..."
                                    className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                                    <Key className="w-4 h-4" /> {t('entry.seedPhrase')}
                                </label>
                                <textarea
                                    required
                                    value={formData.seedPhrase}
                                    onChange={(e) => setFormData({ ...formData, seedPhrase: e.target.value })}
                                    placeholder={t('entry.seedPhrase')}
                                    rows={3}
                                    className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500/50 resize-none"
                                />
                            </div>
                        </>
                    )}

                    {/* File Specific */}
                    {type === 'file' && (
                        <div className="space-y-4">
                            {!file ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center gap-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all cursor-pointer group"
                                >
                                    <div className="p-4 bg-navy-900 rounded-2xl group-hover:scale-110 transition-transform">
                                        <Upload className="w-8 h-8 text-indigo-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-white font-medium">{t('entry.selectFile')}</p>
                                        <p className="text-white/20 text-xs mt-1">{t('entry.fileSizeLimit')}</p>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <File className="text-indigo-400" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate max-w-[200px]">{file.name}</p>
                                            <p className="text-[10px] text-white/40">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFile(null)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Shield className="w-5 h-5" />
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default AddEntryModal;
