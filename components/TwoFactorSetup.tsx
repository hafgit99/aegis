import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Shield, CheckCircle2, Copy, Check,
  ChevronRight, RefreshCw, Key, AlertCircle, Loader2
} from 'lucide-react';
import QRCode from 'qrcode';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { TwoFactorService } from '../services/twoFactorService';
import { CryptoService } from '../services/cryptoService';

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
      setError("Verification error");
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

  return (
    <div className="glass border border-white/5 rounded-[3rem] p-12 w-full max-w-xl shadow-2xl relative overflow-hidden">
      <div className="absolute top-8 right-8 z-20">
        <button onClick={onClose} className="p-3 text-zinc-500 hover:text-white transition-all bg-white/5 rounded-2xl">
          <X size={24} />
        </button>
      </div>

      {/* QR kodu oluşturmak için gizli canvas - ARTIK GEREK YOK, qrcode kütüphanesi kullanılıyor */}
      {/* <canvas ref={qrCanvasRef} style={{ display: 'none' }} /> */}

      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center py-6">
            <div className="w-24 h-24 bg-blue-600/10 rounded-[2rem] flex items-center justify-center mx-auto mb-10 border border-blue-500/20 shadow-2xl shadow-blue-600/10">
              <Shield size={48} className="text-blue-500" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">{t('setup_2fa')}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-12 max-w-xs mx-auto font-medium">
              {t('two_factor_desc')}
            </p>
            <button
              onClick={() => setStep('scan')}
              className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-blue-600/20"
            >
              {lang === 'tr' ? 'BAŞLAT' : 'GET STARTED'} <ChevronRight size={18} />
            </button>
          </motion.div>
        )}

        {step === 'scan' && (
          <motion.div key="scan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center py-4">
            <h3 className="text-2xl font-black text-white uppercase mb-8 tracking-tight">{t('scan_qr')}</h3>
            <div className="bg-white p-6 rounded-[2.5rem] inline-block mb-10 shadow-2xl border-4 border-blue-600/10">
              {qrUrl ? (
                <img src={qrUrl} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-zinc-100">
                  <RefreshCw className="animate-spin text-zinc-300" size={32} />
                </div>
              )}
            </div>
            <div className="p-6 bg-black/40 rounded-2xl border border-white/5 mb-10 text-left">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">{t('manual_secret')}</label>
              <div className="flex items-center justify-between font-mono text-xs text-blue-400 break-all select-all">
                {secret}
                <button onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="ml-4 p-2 text-zinc-500 hover:text-white bg-white/5 rounded-lg">
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
            <button
              onClick={() => setStep('verify')}
              className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-2xl"
            >
              {t('qr_scanned_next')}
            </button>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div key="verify" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
            <h3 className="text-2xl font-black text-white uppercase mb-6 tracking-tight">{t('verify_2fa')}</h3>
            <p className="text-xs text-zinc-500 mb-12 font-bold uppercase tracking-widest">{t('enter_code')}</p>
            <form onSubmit={handleVerify} className="space-y-8">
              <input
                autoFocus
                type="text"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-6 py-7 bg-black/40 border border-white/5 rounded-[2rem] text-center text-5xl font-mono tracking-[0.4em] text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-800"
                placeholder="000000"
                required
              />
              {error && <div className="flex items-center justify-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest">
                <AlertCircle size={14} /> {error}
              </div>}
              <button
                type="submit"
                disabled={isVerifying || verifyCode.length < 6}
                className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[10px] shadow-2xl"
              >
                {isVerifying ? <Loader2 className="animate-spin" size={24} /> : t('verify')}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'recovery' && (
          <motion.div key="recovery" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4">
            <h3 className="text-2xl font-black text-white uppercase mb-4 tracking-tight">{t('recovery_codes')}</h3>
            <p className="text-xs text-zinc-500 mb-10 leading-relaxed font-bold uppercase tracking-widest px-4">{t('recovery_desc')}</p>
            <div className="grid grid-cols-2 gap-4 mb-12">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-zinc-300 font-mono text-xs select-all text-center tracking-widest">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button
                onClick={copyCodes}
                className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />} {t('copy_all')}
              </button>
              <button
                onClick={() => setStep('success')}
                className="flex-1 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-600/10"
              >
                {t('i_saved_them')}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-10">
            <div className="w-28 h-28 bg-emerald-500/20 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
              <CheckCircle2 size={56} />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-4">{t('setup_complete')}</h3>
            <p className="text-xs text-zinc-500 mb-12 uppercase tracking-[0.2em] font-bold">{t('vault_protected_2fa')}</p>
            <button
              onClick={() => { onComplete(); onComplete(); }}
              className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-blue-600/20"
            >
              {t('finish')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TwoFactorSetup;
