import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VaultEntry, Category, SensitiveData, CustomField, Folder } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePasswordGenerator } from '../../hooks/usePasswordGenerator';
import { PasskeyService } from '../../services/passkeyService';
import { TagService } from '../../services/tagService';
// Added Check icon to imports from lucide-react
import { FileUp, File, X, AlertCircle, Loader2, Plus, Trash2, Eye, EyeOff, Lock, Globe, CreditCard, FileText, Download, ChevronRight, Wand2, Check, Wallet, Fingerprint, Hash } from 'lucide-react';

interface EntryFormProps {
  entry?: VaultEntry;
  sensitive?: SensitiveData;
  onSave: (payload: Partial<VaultEntry> & { sensitive: SensitiveData }) => void;
  onClose: () => void;
}

const EntryForm: React.FC<EntryFormProps> = ({ entry, sensitive, onSave, onClose }) => {
  const { t, lang } = useLanguage();
  const { masterKey } = useAuth();
  const { generate } = usePasswordGenerator();
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    title: entry?.title || '',
    username: entry?.username || '',
    category: entry?.category || Category.LOGIN,
    isFavorite: entry?.isFavorite || false,
    fileSize: entry?.fileSize || 0,
    tags: entry?.tags || []
  });

  const [tagInput, setTagInput] = useState('');

  // Etiket ekleme (Enter tuşu veya buton ile)
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData({ ...formData, tags: [...formData.tags, trimmedTag] });
      setTagInput('');
    }
  };

  // Etiket kaldırma
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagToRemove) });
  };

  // Etiket input'unda Enter tuşuna basıldığında
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
      // Backspace ile son etiketi kaldır
      handleRemoveTag(formData.tags[formData.tags.length - 1]);
    }
  };

  const [sensitiveData, setSensitiveData] = useState<SensitiveData>(sensitive || {
    password: '',
    notes: '',
    url: '',
    customFields: [],
    cardDetails: { number: '', expiry: '', cvv: '', holder: '' },
    cryptoDetails: { walletName: '', network: '', address: '', seed: '', privateKey: '' },
    passkeyDetails: { credentialId: '', publicKey: '', signCount: 0, rpId: '', displayName: '', createdAt: Date.now() }
  });

  const handleQuickGenerate = () => {
    const pass = generate();
    setSensitiveData({ ...sensitiveData, password: pass });
    setShowPassword(true);
  };

  const addCustomField = () => {
    setSensitiveData({
      ...sensitiveData,
      customFields: [
        ...(sensitiveData.customFields || []),
        { id: crypto.randomUUID(), label: '', value: '', isSecret: false }
      ]
    });
  };

  const removeCustomField = (id: string) => {
    setSensitiveData({
      ...sensitiveData,
      customFields: (sensitiveData.customFields || []).filter(f => f.id !== id)
    });
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setSensitiveData({
      ...sensitiveData,
      customFields: (sensitiveData.customFields || []).map(f => f.id === id ? { ...f, ...updates } : f)
    });
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.substring(0, 16);
    const masked = value.replace(/(.{4})/g, '$1 ').trim();

    setSensitiveData({
      ...sensitiveData,
      cardDetails: { ...sensitiveData.cardDetails!, number: masked }
    });
  };

  const handleRegisterPasskey = async () => {
    try {
      const rpId = sensitiveData.passkeyDetails?.rpId || formData.url.replace(/^https?:\/\//, '').split('/')[0] || 'localhost';
      const displayName = sensitiveData.passkeyDetails?.displayName || formData.username || 'Aegis User';

      const credential = await PasskeyService.createCredential(rpId, displayName);

      setSensitiveData({
        ...sensitiveData,
        passkeyDetails: credential
      });

      if (!formData.title) {
        setFormData({ ...formData, title: `Passkey: ${rpId} ` });
      }
    } catch (e) {
      console.error("Passkey registration failed", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !masterKey) return;

    // Performance Guard: Max 100MB for IndexedDB storage (was 5MB)
    if (file.size > 100 * 1024 * 1024) {
      setFileError("File too large (>100MB)");
      return;
    }

    setIsProcessingFile(true);
    setFileError(null);
    try {
      const buffer = await file.arrayBuffer();
      const binary = new Uint8Array(buffer);

      setFormData(p => ({ ...p, category: Category.FILE, fileSize: file.size, title: p.title || file.name }));
      setSensitiveData(p => ({ ...p, fileBlob: binary, fileName: file.name, fileMime: file.type }));
    } catch (err) {
      setFileError("Upload Error");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="bg-[#0c0c0e] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
      <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20">
            <Plus className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase leading-none">{entry ? t('synced') : t('new_secret')}</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t('vault_write_msg')}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 text-zinc-500 hover:text-white transition-all bg-white/5 rounded-2xl"><X size={24} /></button>
      </div>

      <form className="p-10 space-y-8" onSubmit={async (e) => {
        e.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        try {
          await onSave({
            ...formData,
            id: entry?.id,
            tags: formData.tags,
            sensitive: sensitiveData
          });
        } catch (err) {
          console.error("Save failed:", err);
          alert(lang === 'tr' ? "Kaydetme hatası: " + (err as Error).message : "Save failed: " + (err as Error).message);
          setIsSaving(false);
        }
      }}>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3 col-span-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('asset_name')}</label>
            <input required autoFocus value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 transition-all font-bold select-text" placeholder={t('placeholder_title')} />
          </div>

          <div className="space-y-3 col-span-2 md:col-span-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('category')}</label>
            <div className="relative">
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as Category })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white appearance-none outline-none focus:border-blue-500/50 font-bold">
                <option value={Category.LOGIN}>{t('cat_login')}</option>
                <option value={Category.CARD}>{t('cat_card')}</option>
                <option value={Category.NOTE}>{t('cat_note')}</option>
                <option value={Category.FILE}>{t('cat_file')}</option>
                <option value={Category.CRYPTO}>{t('cat_crypto')}</option>
                <option value={Category.PASSKEY}>{t('cat_passkey')}</option>
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-zinc-600 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="space-y-3 col-span-2 md:col-span-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('tags')}</label>
            <div className="w-full px-4 py-3 bg-black/60 border border-white/5 rounded-[1.5rem] focus-within:border-blue-500/50 transition-all">
              {/* Tag Chips */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <AnimatePresence mode="popLayout">
                    {formData.tags.filter(tag => tag && tag.trim()).map((tag, index) => {
                      const colorClass = TagService.getTagColor(tag);
                      return (
                        <motion.span
                          key={`form-tag-${tag}-${index}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}
                        >
                          <Hash size={10} />
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:opacity-70 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </motion.span>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
              {/* Tag Input */}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
                className="w-full bg-transparent text-white outline-none font-bold select-text placeholder:text-zinc-600"
                placeholder={formData.tags.length === 0 ? t('placeholder_tags') : t('tag_add_hint')}
              />
            </div>
          </div>

          {formData.category === Category.LOGIN && (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 grid grid-cols-2 gap-8">
                <div className="space-y-3 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('identity')}</label>
                  <input value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono select-text" placeholder={t('placeholder_username')} />
                </div>
                <div className="space-y-3 col-span-2 md:col-span-1">
                  <div className="flex justify-between items-center pr-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('secret_token')}</label>
                    <button type="button" onClick={handleQuickGenerate} className="flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors">
                      <Wand2 size={12} /> {t('generate_password')}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={sensitiveData.password}
                      onChange={e => setSensitiveData({ ...sensitiveData, password: e.target.value })}
                      className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono pr-14 select-text"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('portal_url')}</label>
                  <input type="url" value={sensitiveData.url} onChange={e => setSensitiveData({ ...sensitiveData, url: e.target.value })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono select-text" placeholder={t('placeholder_url')} />
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {formData.category === Category.CRYPTO && (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 grid grid-cols-2 gap-8">
                <div className="space-y-3 col-span-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('crypto_network')}</label>
                  <input
                    value={sensitiveData.cryptoDetails?.network || ''}
                    onChange={e => setSensitiveData({ ...sensitiveData, cryptoDetails: { ...sensitiveData.cryptoDetails!, network: e.target.value, walletName: formData.title, address: sensitiveData.cryptoDetails?.address || '', seed: sensitiveData.cryptoDetails?.seed || '' } })}
                    className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-bold select-text"
                    placeholder={t('crypto_network_placeholder')}
                  />
                </div>
                <div className="space-y-3 col-span-1">
                </div>

                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('crypto_address')}</label>
                  <input
                    value={sensitiveData.cryptoDetails?.address || ''}
                    onChange={e => setSensitiveData({ ...sensitiveData, cryptoDetails: { ...sensitiveData.cryptoDetails!, address: e.target.value, walletName: formData.title, network: sensitiveData.cryptoDetails?.network || '', seed: sensitiveData.cryptoDetails?.seed || '' } })}
                    className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono text-xs select-text"
                    placeholder={t('crypto_address_placeholder')}
                  />
                </div>

                <div className="space-y-3 col-span-2">
                  <div className="flex justify-between items-center pr-2">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block pl-1">{t('crypto_seed')}</label>
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-zinc-500 hover:text-white transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={sensitiveData.cryptoDetails?.seed || ''}
                    onChange={e => setSensitiveData({ ...sensitiveData, cryptoDetails: { ...sensitiveData.cryptoDetails!, seed: e.target.value, walletName: formData.title, network: sensitiveData.cryptoDetails?.network || '', address: sensitiveData.cryptoDetails?.address || '' } })}
                    className={`w-full px-6 py-5 bg-black/60 border border-amber-500/20 rounded-[1.5rem] text-white outline-none focus:border-amber-500/50 font-mono text-sm resize-none select-text ${!showPassword ? 'text-security-disc' : ''}`}
                    placeholder={showPassword ? t('crypto_seed_placeholder_shown') : t('crypto_seed_placeholder_hidden')}
                    style={!showPassword ? { WebkitTextSecurity: 'disc' } : {}}
                  />
                </div>

                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block pl-1">{t('crypto_private_key')}</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={sensitiveData.cryptoDetails?.privateKey || ''}
                    onChange={e => setSensitiveData({ ...sensitiveData, cryptoDetails: { ...sensitiveData.cryptoDetails!, privateKey: e.target.value, seed: sensitiveData.cryptoDetails?.seed || '', walletName: formData.title, network: sensitiveData.cryptoDetails?.network || '', address: sensitiveData.cryptoDetails?.address || '' } })}
                    className="w-full px-6 py-5 bg-black/60 border border-rose-500/20 rounded-[1.5rem] text-white outline-none focus:border-rose-500/50 font-mono text-xs select-text"
                    placeholder={t('crypto_pk_placeholder')}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {formData.category === Category.CARD && (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 grid grid-cols-2 gap-8">
                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('card_number')}</label>
                  <input value={sensitiveData.cardDetails?.number} onChange={handleCardNumberChange} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono tracking-widest select-text" placeholder="0000 0000 0000 0000" />
                </div>
                <div className="space-y-3 col-span-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('expiry')}</label>
                  <input value={sensitiveData.cardDetails?.expiry} onChange={e => setSensitiveData({ ...sensitiveData, cardDetails: { ...sensitiveData.cardDetails!, expiry: e.target.value } })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 select-text" placeholder="MM/YY" />
                </div>
                <div className="space-y-3 col-span-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('cvv')}</label>
                  <input type="password" maxLength={4} value={sensitiveData.cardDetails?.cvv} onChange={e => setSensitiveData({ ...sensitiveData, cardDetails: { ...sensitiveData.cardDetails!, cvv: e.target.value } })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 select-text" placeholder="***" />
                </div>
                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('card_holder')}</label>
                  <input value={sensitiveData.cardDetails?.holder} onChange={e => setSensitiveData({ ...sensitiveData, cardDetails: { ...sensitiveData.cardDetails!, holder: e.target.value } })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-bold select-text" />
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {formData.category === Category.NOTE && (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 col-span-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('note_content')}</label>
                <textarea rows={8} value={sensitiveData.notes} onChange={e => setSensitiveData({ ...sensitiveData, notes: e.target.value })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 resize-none font-bold select-text" placeholder={t('placeholder_notes')} />
              </motion.div>
            </AnimatePresence>
          )}

          {formData.category === Category.PASSKEY && (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 grid grid-cols-2 gap-8">
                <div className="space-y-3 col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('passkey_rp_id')}</label>
                    <button
                      type="button"
                      onClick={handleRegisterPasskey}
                      className="px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 text-[8px] font-black uppercase tracking-widest rounded-lg border border-indigo-500/20 transition-all flex items-center gap-2"
                    >
                      <Fingerprint size={12} />
                      {lang === 'tr' ? 'ANAHTAR OLUŞTUR' : 'CREATE CREDENTIAL'}
                    </button>
                  </div>
                  <input value={sensitiveData.passkeyDetails?.rpId} onChange={e => setSensitiveData({ ...sensitiveData, passkeyDetails: { ...sensitiveData.passkeyDetails!, rpId: e.target.value } })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono select-text" placeholder="example.com" />
                </div>
                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('passkey_display_name')}</label>
                  <input value={sensitiveData.passkeyDetails?.displayName} onChange={e => setSensitiveData({ ...sensitiveData, passkeyDetails: { ...sensitiveData.passkeyDetails!, displayName: e.target.value } })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-bold select-text" />
                </div>
                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('passkey_credential_id')}</label>
                  <input value={sensitiveData.passkeyDetails?.credentialId} onChange={e => setSensitiveData({ ...sensitiveData, passkeyDetails: { ...sensitiveData.passkeyDetails!, credentialId: e.target.value } })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono text-xs select-text" />
                </div>
                <div className="space-y-3 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block pl-1">{t('passkey_public_key')}</label>
                  <textarea rows={3} value={sensitiveData.passkeyDetails?.publicKey} onChange={e => setSensitiveData({ ...sensitiveData, passkeyDetails: { ...sensitiveData.passkeyDetails!, publicKey: e.target.value } })} className="w-full px-6 py-5 bg-black/60 border border-white/5 rounded-[1.5rem] text-white outline-none focus:border-blue-500/50 font-mono text-xs resize-none select-text" />
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {formData.category === Category.FILE && (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-2">
                <div className={`relative border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center transition-all group/file ${sensitiveData.fileBlob ? 'bg-emerald-500/5 border-emerald-500/30' : 'border-white/10 hover:bg-white/[0.02] hover:border-blue-500/30'}`}>
                  <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover/file:scale-110 transition-transform ${sensitiveData.fileBlob ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-600/10 text-blue-500'}`}>
                    {isProcessingFile ? <Loader2 className="animate-spin" size={32} /> : sensitiveData.fileBlob ? <Check size={32} /> : <FileUp size={32} />}
                  </div>
                  <span className={`text-xs font-black uppercase tracking-widest ${sensitiveData.fileBlob ? 'text-emerald-500' : 'text-white'}`}>
                    {sensitiveData.fileName || t('drop_file')}
                  </span>
                  {sensitiveData.fileBlob && (
                    <span className="text-[9px] text-zinc-500 font-bold uppercase mt-2 tracking-widest">
                      {(formData.fileSize / 1024 / 1024).toFixed(2)} MB - {t('ready_to_sync')}
                    </span>
                  )}
                  {!sensitiveData.fileBlob && (
                    <span className="text-[10px] text-zinc-600 uppercase font-bold mt-2 tracking-widest">{t('file_storage_info')}</span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          <div className="col-span-2 pt-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Lock size={16} className="text-zinc-600" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">{t('custom_fields')}</h3>
              </div>
              <button type="button" onClick={addCustomField} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[10px] font-black text-blue-500 uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
                <Plus size={14} /> {t('add_field')}
              </button>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {(sensitiveData.customFields || []).map((field) => (
                  <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={field.id} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <input value={field.label} onChange={e => updateCustomField(field.id, { label: e.target.value })} placeholder={t('field_label')} className="w-full bg-black/40 border border-white/5 px-4 py-3.5 rounded-xl text-[10px] text-white font-black uppercase tracking-widest outline-none focus:border-blue-500/20 select-text" />
                    </div>
                    <div className="flex-[2] relative">
                      <input type={field.isSecret ? "password" : "text"} value={field.value} onChange={e => updateCustomField(field.id, { value: e.target.value })} placeholder={t('field_value')} className="w-full bg-black/40 border border-white/5 px-4 py-3.5 rounded-xl text-xs text-white font-mono outline-none focus:border-blue-500/20 pr-12 select-text" />
                      <button type="button" onClick={() => updateCustomField(field.id, { isSecret: !field.isSecret })} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white">
                        {field.isSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button type="button" onClick={() => removeCustomField(field.id)} className="p-3.5 text-red-500/40 hover:text-red-500 bg-red-500/5 rounded-xl transition-colors"><Trash2 size={18} /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="pt-10 flex gap-6">
          <button type="button" onClick={onClose} className="flex-1 py-5 text-zinc-500 font-black uppercase tracking-widest hover:text-white transition-colors">{t('abort')}</button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-[2] py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {lang === 'tr' ? 'KAYDEDİLİYOR...' : 'SAVING...'}
              </>
            ) : t('commit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EntryForm;
