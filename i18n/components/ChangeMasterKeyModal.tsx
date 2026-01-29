import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, AlertTriangle, CheckCircle2, Loader2, Eye, EyeOff, Zap, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ChangeMasterKeyService, ChangePasswordProgress } from '../../services/changeMasterKeyService';

interface ChangeMasterKeyModalProps {
  onClose: () => void;
  masterKey: CryptoKey | null;
  onSuccess: () => void;
  isRotationOnly?: boolean;
}

const ChangeMasterKeyModal: React.FC<ChangeMasterKeyModalProps> = ({ onClose, onSuccess, isRotationOnly = false }) => {
  const { t, lang } = useLanguage();
  const [stage, setStage] = useState<'input' | 'processing' | 'complete'>('input');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<ChangePasswordProgress>({
    stage: 'validating',
    progress: 0,
    totalEntries: 0,
    processedEntries: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const validateInputs = (): boolean => {
    setError('');

    if (!currentPassword) {
      setError(lang === 'tr' ? 'Mevcut şifre gereklidir' : 'Current password is required');
      return false;
    }

    if (isRotationOnly) return true;

    if (!newPassword) {
      setError(lang === 'tr' ? 'Yeni şifre gereklidir' : 'New password is required');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError(lang === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match');
      return false;
    }

    if (currentPassword === newPassword) {
      setError(lang === 'tr' ? 'Yeni şifre eski şifreden farklı olmalı' : 'New password must be different from current password');
      return false;
    }

    const validation = ChangeMasterKeyService.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      setError(validation.issues.join(', '));
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validateInputs()) return;

    setStage('processing');
    setIsProcessing(true);

    try {
      if (isRotationOnly) {
        await ChangeMasterKeyService.rotateMasterKeyWithSamePassword(
          currentPassword,
          (prog) => setProgress(prog)
        );
      } else {
        await ChangeMasterKeyService.changeMasterKey(
          currentPassword,
          newPassword,
          (prog) => {
            setProgress(prog);
          }
        );
      }

      setStage('complete');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setIsProcessing(false);
      setStage('input');

      if (err.message === 'INVALID_CURRENT_PASSWORD') {
        setError(lang === 'tr' ? 'Mevcut şifre yanlış' : 'Current password is incorrect');
      } else {
        setError(err.message || (lang === 'tr' ? 'Şifre değiştirme başarısız oldu' : 'Failed to change password'));
      }
    }
  };

  const getProgressLabel = (): string => {
    switch (progress.stage) {
      case 'validating':
        return lang === 'tr' ? 'Şifre doğrulanıyor...' : 'Validating password...';
      case 'decrypting':
        return lang === 'tr' ? `Veriler çözülüyor... (${progress.processedEntries}/${progress.totalEntries})` : `Decrypting entries... (${progress.processedEntries}/${progress.totalEntries})`;
      case 'encrypting':
        return lang === 'tr' ? `Veriler yeniden şifreleniyor... (${progress.processedEntries}/${progress.totalEntries})` : `Re-encrypting entries... (${progress.processedEntries}/${progress.totalEntries})`;
      case 'saving':
        return lang === 'tr' ? 'Değişiklikler kaydediliyor...' : 'Saving changes...';
      case 'complete':
        return lang === 'tr' ? 'Tamamlandı!' : 'Complete!';
      default:
        return '';
    }
  };

  const getPasswordStrength = () => {
    const validation = ChangeMasterKeyService.validatePasswordStrength(newPassword);
    return {
      score: validation.score,
      issues: validation.issues,
      isValid: validation.isValid,
    };
  };

  const strength = getPasswordStrength();

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="glass rounded-[3.5rem] border border-blue-500/20 max-w-2xl w-full overflow-hidden shadow-2xl"
    >
      <AnimatePresence mode="wait">
        {stage === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-12 space-y-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                  {isRotationOnly
                    ? (lang === 'tr' ? 'Anahtar Rotasyonu' : 'Key Rotation')
                    : (lang === 'tr' ? 'Master Şifre Değiştir' : 'Change Master Password')}
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  {isRotationOnly
                    ? (lang === 'tr' ? 'Mevcut şifrenizle verileri yeni anahtarlarla yeniden şifreler (Periyodik Bakım)' : 'Re-encrypts data with new keys using your current password (Periodic Maintenance)')
                    : (lang === 'tr' ? 'Tüm verileriniz güvenli bir şekilde yeniden şifrelenmektedir' : 'Your data will be securely re-encrypted')}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="p-3 hover:bg-white/10 rounded-2xl transition-all disabled:opacity-50"
              >
                <X size={20} className="text-zinc-500" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-4"
              >
                <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>
              </motion.div>
            )}

            {/* Current Password */}
            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {lang === 'tr' ? 'Master Şifre' : 'Master Password'}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isProcessing}
                  placeholder={lang === 'tr' ? 'Master şifrenizi girin' : 'Enter master password'}
                  className="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-white placeholder-zinc-600 outline-none focus:border-blue-500/30 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={isProcessing}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {!isRotationOnly && (
              <>
                {/* New Password */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {lang === 'tr' ? 'Yeni Şifre' : 'New Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isProcessing}
                      placeholder={lang === 'tr' ? 'Yeni şifrenizi girin' : 'Enter new password'}
                      className="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-white placeholder-zinc-600 outline-none focus:border-blue-500/30 transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={isProcessing}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                          <motion.div
                            animate={{ width: `${strength.score}%` }}
                            className={`h-full transition-colors ${strength.score >= 80
                              ? 'bg-emerald-500'
                              : strength.score >= 60
                                ? 'bg-blue-500'
                                : strength.score >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                          />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">
                          {strength.score}%
                        </span>
                      </div>
                      {strength.issues.length > 0 && (
                        <div className="space-y-1">
                          {strength.issues.map((issue, idx) => (
                            <p key={idx} className="text-[8px] text-red-500 font-bold uppercase tracking-widest">
                              • {issue}
                            </p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {lang === 'tr' ? 'Şifreyi Onayla' : 'Confirm Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isProcessing}
                      placeholder={lang === 'tr' ? 'Şifreyi tekrar girin' : 'Confirm password'}
                      className="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-2xl text-white placeholder-zinc-600 outline-none focus:border-blue-500/30 transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isProcessing}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[8px] text-red-500 font-bold uppercase tracking-widest">
                      {lang === 'tr' ? '✗ Şifreler eşleşmiyor' : '✗ Passwords do not match'}
                    </p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">
                      {lang === 'tr' ? '✓ Şifreler eşleşiyor' : '✓ Passwords match'}
                    </p>
                  )}
                </div>
              </>
            )}

            {isRotationOnly && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start gap-3">
                <Zap size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest leading-relaxed">
                  {lang === 'tr'
                    ? 'Bu işlem salt, iterasyon sayısı ve şifreleme anahtarlarını güncelleyerek kaba kuvvet saldırılarına karşı korumayı artırır.'
                    : 'This process updates the salt, iteration count, and encryption keys, enhancing protection against brute-force attacks.'}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50"
              >
                {lang === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={handleChangePassword}
                disabled={!currentPassword || (!isRotationOnly && (!newPassword || !confirmPassword || !strength.isValid)) || isProcessing}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {isRotationOnly ? <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} /> : <Lock size={16} />}
                {isRotationOnly
                  ? (lang === 'tr' ? 'Rotasyonu Başlat' : 'Start Rotation')
                  : (lang === 'tr' ? 'Değiştir' : 'Change')}
              </button>
            </div>
          </motion.div>
        )}

        {stage === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-12 space-y-8 flex flex-col items-center"
          >
            <div className="relative w-40 h-40">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.6 }}
                  className="absolute inset-0 border-2 border-blue-500 rounded-full"
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap size={48} className="text-blue-500 animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-4">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                {lang === 'tr' ? 'Şifre Değiştiriliyor' : 'Changing Password'}
              </h3>
              <p className="text-[11px] text-blue-500 font-bold uppercase tracking-widest">
                {getProgressLabel()}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-blue-500/20">
                <motion.div
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ type: 'spring', stiffness: 100, damping: 30 }}
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-lg shadow-blue-500/50"
                />
              </div>
              <div className="flex justify-between text-[8px] text-zinc-600 font-black uppercase tracking-widest">
                <span>{Math.round(progress.progress)}%</span>
                <span>
                  {lang === 'tr' ? 'Beklemeyin, bu işlem devam ediyor...' : 'Please wait...'}
                </span>
              </div>
            </div>

            {/* Stage Indicators */}
            <div className="w-full space-y-2">
              {['validating', 'decrypting', 'encrypting', 'saving'].map((s, idx) => (
                <div key={`cmk-stage-${s}-${idx}`} className="flex items-center gap-3">
                  {progress.stage === s && progress.stage !== 'complete' ? (
                    <Loader2 size={16} className="text-blue-500 animate-spin" />
                  ) : ['validating', 'decrypting', 'encrypting', 'saving'].indexOf(s) < ['validating', 'decrypting', 'encrypting', 'saving'].indexOf(progress.stage) ||
                    progress.stage === 'complete' ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-zinc-700 rounded-full" />
                  )}
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest capitalize">
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {stage === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 space-y-8 flex flex-col items-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.6 }}
              className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20"
            >
              <CheckCircle2 size={48} />
            </motion.div>

            <div className="text-center space-y-3">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                {lang === 'tr' ? 'Başarılı!' : 'Success!'}
              </h3>
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
                {lang === 'tr'
                  ? 'Master şifreniz güvenli bir şekilde değiştirildi. Tüm verileriniz yeniden şifrelendi.'
                  : 'Your master password has been changed successfully. All your data has been re-encrypted.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChangeMasterKeyModal;
