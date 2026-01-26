import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Shield, CheckCircle2, Copy, Check,
  ChevronRight, RefreshCw, Key, AlertCircle, Loader2
} from 'lucide-react';
import QRCode from 'qrcode';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { TwoFactorService } from '../../services/twoFactorService';
import { CryptoService } from '../../services/cryptoService';

interface TwoFactorSetupProps {
  onClose: () => void;
  onComplete: () => void;
}

type SetupStep = 'intro' | 'scan' | 'verify' | 'recovery' | 'success';

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onClose, onComplete }) => {
  const { t, lang } = useLanguage();
  const { masterKey } = useAuth();

  const [step, setStep] = useState<SetupStep>('intro');
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAlreadyEnabled, setIsAlreadyEnabled] = useState(false);

  useEffect(() => {
    setIsAlreadyEnabled(!!localStorage.getItem('aegis_2fa_config'));
  }, []);

  useEffect(() => {
    if (step === 'scan' && !secret) {
      const generate = async () => {
        try {
          const newSecret = TwoFactorService.generateSecret();
          const codes = TwoFactorService.generateRecoveryCodes();
          setSecret(newSecret);
          setRecoveryCodes(codes);

          const issuer = "Aegis Vault";
          const account = "User"; // Bu dinamik olabilir, örneğin kullanıcı adı varsa
          // otpauth URL formatı önemli: otpauth://totp/Issuer:Account?secret=...&issuer=Issuer
          // Boşlukları ve özel karakterleri encodeURIComponent ile kaçırmalıyız ama 'label' kısmı (Issuer:Account) bazen düz de çalışır. Standarda uyalım.
          const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
          const url = `otpauth://totp/${label}?secret=${newSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

          // QR kodunu oluştur
          const qrDataUrl = await QRCode.toDataURL(url, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 256,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          setQrUrl(qrDataUrl);
        } catch (err) {
          console.error("QR Code generation failed", err);
          setError("QR Code generation failed");
        }
      };

      generate();
    }
  }, [step, secret]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError(null);

    try {
      const isValid = await TwoFactorService.verifyToken(secret, verifyCode);
      if (isValid && masterKey) {
        const config = {
          secret,
          recoveryCodes,
          createdAt: Date.now()
        };
        const configJson = JSON.stringify(config);
        const { ciphertext, iv, tag } = await CryptoService.encrypt(configJson, masterKey);

        const storagePayload = {
          payload: CryptoService.arrayBufferToBase64(ciphertext.buffer),
          iv: CryptoService.arrayBufferToBase64(iv.buffer),
          tag: CryptoService.arrayBufferToBase64(tag.buffer)
        };

        localStorage.setItem('aegis_2fa_config', JSON.stringify(storagePayload));

        // Sync to SQLite database for CLI access
        if ((window as any).electronAPI?.db) {
          try {
            await (window as any).electronAPI.db.setConfig('aegis_2fa_config', JSON.stringify(storagePayload));
            console.log('[Security] 2FA config synced to SQLite');
          } catch (e) {
            console.error('[Security] Failed to sync 2FA to SQLite:', e);
          }
        }

        // Check for clock drift warning and display it if necessary
        const clockWarning = TwoFactorService.getClockDriftWarning();
        if (clockWarning) {
          console.warn('Clock Drift Warning:', clockWarning);
          // Warning is logged, user can see it in development tools or via future alert mechanism
        }

        setStep('recovery');
      } else {
        setError(t('invalid_code'));
      }
    } catch (err) {
      setError(t('verification_error') || "Verification error");
    } finally {
      setIsVerifying(false);
    }
  };

  const copyCodes = () => {
    const text = recoveryCodes.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    onClose();
    setStep('intro');
  };

  const handleComplete = () => {
    setIsAlreadyEnabled(true);
    onComplete();
    setStep('intro');
  };

  const handleDisable = () => {
    if (confirm(t('disable_2fa_confirm'))) {
      localStorage.removeItem('aegis_2fa_config');
      setIsAlreadyEnabled(false);
      // onComplete tetiklendiğinde modal kapanır (Usage 2) veya embedded ise (Usage 1) intro ekranı güncellenir
      onComplete();
    }
  };

  return (
    <div className="glass p-12 rounded-[3.5rem] border border-blue-500/20 max-w-xl w-full relative overflow-visible shadow-2xl">
      <div className="absolute top-8 right-8 z-[150]">
        <button
          onClick={handleClose}
          className="p-3 text-zinc-500 hover:text-white hover:bg-white/10 rounded-2xl transition-all cursor-pointer pointer-events-auto"
          title={t('close')}
        >
          <X size={24} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center py-6">
            <div className="w-16 h-16 bg-blue-600/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
              <Shield size={32} className="text-blue-500" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-3">{t('setup_2fa')}</h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto font-medium">
              {t('two_factor_desc')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep('scan')}
                className={`w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-blue-600/20 ${isAlreadyEnabled ? '' : 'order-1'}`}
              >
                {isAlreadyEnabled ? t('reconfigure') || 'Yeniden Yapılandır' : t('initialize') || 'Başlat'} <ChevronRight size={16} />
              </button>

              {isAlreadyEnabled && (
                <button
                  onClick={handleDisable}
                  className="w-full py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[9px] border border-red-500/20"
                >
                  {t('disable_btn') || 'Devre Dışı Bırak'}
                </button>
              )}

              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-zinc-500 font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[9px]"
              >
                {t('abort') || 'İptal'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'scan' && (
          <motion.div key="scan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center py-4">
            <h3 className="text-xl font-black text-white uppercase mb-6 tracking-tight">{t('scan_qr')}</h3>
            <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-xl border-2 border-blue-600/10">
              {qrUrl ? (
                <img src={qrUrl} alt="QR Code" className="w-56 h-56" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center bg-zinc-100">
                  <RefreshCw className="animate-spin text-zinc-400" size={28} />
                </div>
              )}
            </div>
            <div className="p-3 bg-black/30 rounded-lg border border-white/5 mb-6 text-left">
              <label className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2 block">{t('manual_secret') || 'Manuel Anahtar'}</label>
              <div className="flex items-center justify-between font-mono text-xs text-blue-400 break-all select-all bg-black/50 rounded-md px-3 py-2">
                {secret}
                <button
                  onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="p-1.5 text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-all"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('intro')}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-500 font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[9px]"
              >
                {t('back') || (lang === 'tr' ? 'GERİ' : 'BACK')}
              </button>
              <button
                onClick={() => setStep('verify')}
                className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-blue-600/20"
              >
                {t('qr_scanned_next') || 'Devam Et'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div key="verify" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
            <h3 className="text-xl font-black text-white uppercase mb-4 tracking-tight">{t('verify_2fa')}</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-8">{t('enter_code')}</p>
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                autoFocus
                type="text"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-5 py-4 bg-black/30 border border-white/5 rounded-lg text-center text-4xl font-mono tracking-[0.3em] text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700 uppercase tracking-widest"
                placeholder="000000"
                required
              />
              {error && <div className="flex items-center justify-center gap-2 text-red-500 text-[9px] font-black uppercase tracking-widest">
                <AlertCircle size={14} /> {error}
              </div>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('scan')}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-500 font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[9px]"
                >
                  {t('back') || 'GERİ'}
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || verifyCode.length < 6}
                  className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  {isVerifying ? <Loader2 className="animate-spin" size={18} /> : t('verify') || 'Doğrula'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'recovery' && (
          <motion.div key="recovery" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4">
            <h3 className="text-xl font-black text-white uppercase mb-4 tracking-tight">{t('recovery_codes')}</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-6 px-4">{t('recovery_desc')}</p>
            <div className="grid grid-cols-4 gap-2 mb-8">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg text-zinc-300 font-mono text-xs text-center select-all">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyCodes}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[9px] flex items-center justify-center gap-2"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {t('copy_all') || 'Tümünü Kopyala'}
              </button>
              <button
                onClick={() => setStep('success')}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-all uppercase tracking-[0.15em] text-[9px] shadow-lg shadow-emerald-600/20"
              >
                {t('i_saved_them') || 'Kaydettim'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">{t('setup_complete')}</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('vault_protected_2fa')}</p>
            <button
              onClick={handleComplete}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-600/20 cursor-pointer relative z-50 pointer-events-auto"
            >
              {t('finish') || 'Bitir'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TwoFactorSetup;
