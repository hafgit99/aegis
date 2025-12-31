
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Added Loader2 to the imports from lucide-react
import { X, Crown, ShieldCheck, Key, Copy, Check, Award, Cpu, Smartphone, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LicensingService } from '../services/licensingService';

const LicensingView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, lang } = useLanguage();
  const [deviceId, setDeviceId] = useState('...');
  const [licenseKey, setLicenseKey] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  
  useEffect(() => {
    LicensingService.getDeviceId().then(setDeviceId);
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(deviceId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleActivate = async () => {
    setStatus('verifying');
    await new Promise(r => setTimeout(r, 1500)); // Simüle edilen doğrulama
    const success = await LicensingService.activateLicense(licenseKey);
    if (success) {
      setStatus('success');
      setTimeout(onClose, 2000);
    } else {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      className="glass p-12 rounded-[3.5rem] border border-amber-500/20 w-full max-w-xl text-center shadow-[0_0_100px_rgba(245,158,11,0.1)] relative"
    >
      <button onClick={onClose} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors">
        <X size={24} />
      </button>

      <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-500/10">
        <Award size={40} />
      </div>

      <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">{t('pro_upgrade_title')}</h2>
      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-10 px-12 leading-relaxed">
        {t('pro_upgrade_desc')}
      </p>

      <div className="space-y-6">
        {/* Device ID Box */}
        <div className="p-6 bg-black/40 border border-white/5 rounded-[2rem] text-left">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
              <Cpu size={12} /> {t('device_id_label')}
            </label>
            <button onClick={handleCopyId} className="text-zinc-500 hover:text-amber-500 transition-colors flex items-center gap-1 text-[9px] font-black uppercase">
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
              {isCopied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          <div className="font-mono text-xs text-zinc-400 break-all bg-black/20 p-3 rounded-xl border border-white/5">
            {deviceId}
          </div>
        </div>

        {/* License Entry */}
        <div className="space-y-3 text-left">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">{t('license_key_label')}</label>
          <input 
            type="text" 
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value)}
            className="w-full px-6 py-5 bg-black/60 border border-amber-500/10 rounded-[1.5rem] text-amber-500 outline-none focus:border-amber-500/40 font-mono transition-all placeholder:text-zinc-800" 
            placeholder="XXXX-XXXX-XXXX-XXXX"
          />
        </div>

        {status === 'error' && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
            <AlertTriangle size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('license_invalid')}</span>
          </div>
        )}

        {status === 'success' && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500">
            <ShieldCheck size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('license_success')}</span>
          </div>
        )}

        <button 
          onClick={handleActivate}
          disabled={status === 'verifying' || !licenseKey}
          className="w-full py-5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-black uppercase tracking-[0.3em] text-[11px] rounded-[1.5rem] shadow-2xl shadow-amber-600/20 transition-all flex items-center justify-center gap-3"
        >
          {status === 'verifying' ? <Loader2 className="animate-spin" size={18} /> : <Award size={18} />}
          {t('activate_btn')}
        </button>
      </div>

      <div className="mt-8">
        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Aegis Licensing Server v4.2 • Secured with ECDSA-P256</p>
      </div>
    </motion.div>
  );
};

export default LicensingView;
