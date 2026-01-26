import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

type LegalDocType = 'terms' | 'privacy';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: LegalDocType;
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, docType }) => {
  const { t, lang } = useLanguage();
  const [agreed, setAgreed] = useState(false);

  const getDocumentTitle = () => {
    return docType === 'terms' ? t('legal_terms_title') : t('legal_privacy_title');
  };

  const renderTermsContent = () => {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
          <div key={num} className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">
              {t(`legal_terms_section_${num}` as any)}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {t(`legal_terms_section_${num}_desc` as any)}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderPrivacyContent = () => {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
          <div key={num} className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">
              {t(`legal_privacy_section_${num}` as any)}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {t(`legal_privacy_section_${num}_desc` as any)}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-gradient-to-r from-blue-600/5 to-transparent">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">
                {getDocumentTitle()}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-all text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {docType === 'terms' ? renderTermsContent() : renderPrivacyContent()}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-800 p-6 bg-zinc-950/50 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-blue-500 cursor-pointer"
                />
                <span className="text-xs text-zinc-400 group-hover:text-zinc-300 leading-relaxed">
                  {t('legal_agree_checkbox')}
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-zinc-800 hover:bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  {t('legal_close_button')}
                </button>
                <button
                  disabled={!agreed}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Check size={14} />
                  I Accept
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LegalModal;
