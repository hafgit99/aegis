
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Copy, Check, X, Shield, Hash, Type, History, Info, BookOpen, Layers } from 'lucide-react';
import { usePasswordGenerator, GeneratorOptions } from '../hooks/usePasswordGenerator';
import { analyzeStrength } from '../utils/passwordStrength';
import { useLanguage } from '../contexts/LanguageContext';

const PasswordGenerator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useLanguage();
  const { generate, history, options, setOptions } = usePasswordGenerator();

  const [currentPassword, setCurrentPassword] = useState('');
  const [displayPassword, setDisplayPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const matrixIntervalRef = useRef<number | null>(null);

  const handleGenerate = () => {
    const pass = generate(options);
    setCurrentPassword(pass);
    setCopied(false);
    triggerMatrixEffect(pass);
  };

  const triggerMatrixEffect = (target: string) => {
    if (matrixIntervalRef.current) window.clearInterval(matrixIntervalRef.current);

    let iterations = 0;
    const maxIterations = 10;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

    matrixIntervalRef.current = window.setInterval(() => {
      setDisplayPassword(target.split('').map((char, index) => {
        if (iterations > maxIterations || Math.random() > 0.8) return char;
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('')
      );

      iterations++;
      if (iterations > maxIterations) {
        setDisplayPassword(target);
        if (matrixIntervalRef.current) window.clearInterval(matrixIntervalRef.current);
      }
    }, 40);
  };

  // Ayarlar her değiştiğinde şifreyi otomatik yenile
  useEffect(() => {
    handleGenerate();
  }, [options.mode, options.upper, options.lower, options.numbers, options.symbols, options.avoidSimilar, options.length]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const strength = analyzeStrength(currentPassword, options.mode);

  return (
    <div className="glass border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight uppercase">{t('engine_v3')}</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t('csprng_precision')}</p>
        </div>
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-xl">
          <X size={18} />
        </button>
      </div>

      <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl mb-8">
        <button
          onClick={() => setOptions({ ...options, mode: 'random', length: 18 })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${options.mode === 'random' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Layers size={14} /> {t('mode_random')}
        </button>
        <button
          onClick={() => setOptions({ ...options, mode: 'readable', length: 4 })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${options.mode === 'readable' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <BookOpen size={14} /> {t('mode_readable')}
        </button>
      </div>

      <div className="relative group mb-8">
        <div className="p-6 bg-zinc-950/80 border border-white/5 rounded-[2rem] flex items-center justify-between transition-all group-hover:border-blue-500/20 shadow-inner min-h-[100px]">
          <span className="text-xl font-mono text-white break-all tracking-wider selection:bg-blue-500/30 pr-4">
            {displayPassword}
          </span>
          <div className="flex gap-2">
            <button onClick={handleGenerate} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:rotate-180 duration-500">
              <RefreshCw size={20} />
            </button>
            <button
              onClick={() => copyToClipboard(currentPassword)}
              className={`p-3 rounded-xl transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
        </div>

        <div className="absolute -bottom-1 left-6 right-6">
          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden flex gap-0.5">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-full flex-1 transition-all duration-700 ${step <= strength.score ? strength.color : 'bg-zinc-800'}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{t('calculated_entropy')}</span>
              <span className="text-[10px] font-mono text-blue-500 font-bold">{strength.bits} bits</span>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${strength.color.replace('bg-', 'text-')}`}>
              {t(strength.label.toLowerCase().replace(' ', '_') as any)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8 mt-12">
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">
              {options.mode === 'random' ? t('char_length') : t('word_count')}
            </span>
            <span className="text-2xl font-mono text-white font-black">{options.length}</span>
          </div>
          <input
            type="range"
            min={options.mode === 'random' ? 8 : 3}
            max={options.mode === 'random' ? 64 : 12}
            value={options.length}
            onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
            className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all hover:accent-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'upper', icon: Type, label: options.mode === 'random' ? t('uppercase') : t('capitalize') },
            { id: 'lower', icon: Type, label: t('lowercase') },
            { id: 'numbers', icon: Hash, label: options.mode === 'random' ? t('numbers') : t('append_number') },
            { id: 'symbols', icon: Shield, label: t('symbols') },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setOptions({ ...options, [opt.id]: !options[opt.id as keyof GeneratorOptions] })}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${options[opt.id as keyof GeneratorOptions] ? 'bg-blue-600/10 border-blue-500/30 text-white shadow-lg shadow-blue-500/5' : 'bg-white/[0.02] border-white/5 text-zinc-600'}`}
            >
              <opt.icon size={16} className={options[opt.id as keyof GeneratorOptions] ? 'text-blue-400' : ''} />
              <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
            </button>
          ))}

          {options.mode === 'random' ? (
            <button
              onClick={() => setOptions({ ...options, avoidSimilar: !options.avoidSimilar })}
              className={`col-span-2 flex items-center justify-between p-4 rounded-2xl border transition-all ${options.avoidSimilar ? 'bg-amber-600/10 border-amber-500/30 text-amber-500' : 'bg-white/[0.02] border-white/5 text-zinc-600'}`}
            >
              <div className="flex items-center gap-3">
                <Info size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('exclude_similar')}</span>
              </div>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${options.avoidSimilar ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                <motion.div
                  animate={{ x: options.avoidSimilar ? 18 : 2 }}
                  className="absolute top-1 left-0 w-2 h-2 bg-white rounded-full"
                />
              </div>
            </button>
          ) : (
            <div className="col-span-2 space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-2">{t('word_separator')}</label>
              <div className="flex gap-2">
                {['-', '.', '_', ' '].map(sep => (
                  <button
                    key={sep}
                    onClick={() => setOptions({ ...options, separator: sep })}
                    className={`flex-1 py-3 rounded-xl border text-xs font-mono transition-all ${options.separator === sep ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-zinc-500'}`}
                  >
                    {sep === ' ' ? 'Space' : sep}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {history.length > 1 && (
          <div className="pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <History size={14} className="text-zinc-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('recent_session_keys')}</span>
            </div>
            <div className="space-y-2">
              {history.slice(1, 4).map((pass, idx) => (
                <div key={idx} className="group/hist p-3 bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-xl flex items-center justify-between transition-all">
                  <span className="text-xs font-mono text-zinc-500 truncate pr-4 group-hover/hist:text-zinc-300 transition-colors">
                    {pass}
                  </span>
                  <button onClick={() => copyToClipboard(pass)} className="p-1.5 text-zinc-600 hover:text-blue-400 opacity-0 group-hover/hist:opacity-100 transition-all">
                    <Copy size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordGenerator;
