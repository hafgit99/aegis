import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useVaultStore, PASSWORD_POLICIES } from '../../store/vaultStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Copy, RefreshCw, Check, Hash, Type, Speech } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PasswordGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type GeneratorMode = 'alphanumeric' | 'passphrase' | 'pronounceable' | 'custom';

const POLICY_DEFINITIONS: { [key: string]: any } = {
    standard: { length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true },
    strict: { length: 32, uppercase: true, lowercase: true, numbers: true, symbols: true },
    pin: { length: 6, uppercase: false, lowercase: false, numbers: true, symbols: false },
    web: { length: 12, uppercase: true, lowercase: true, numbers: true, symbols: false },
    legacy: { length: 8, uppercase: true, lowercase: true, numbers: true, symbols: false }
};

const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { generatePassword } = useVaultStore();

    const [mode, setMode] = useState<GeneratorMode>('alphanumeric');
    const [password, setPassword] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [policy, setPolicy] = useState('standard');

    // Alphanumeric options
    const [length, setLength] = useState(16);
    const [options, setOptions] = useState({
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        excludeSimilar: false
    });

    // Passphrase options
    const [wordCount, setWordCount] = useState(4);
    const [separator, setSeparator] = useState('-');
    const [capitalize, setCapitalize] = useState(true);
    const [includeNumber, setIncludeNumber] = useState(true);

    // Custom options
    const [customCharset, setCustomCharset] = useState('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789');

    const handlePolicyChange = (newPolicy: string) => {
        setPolicy(newPolicy);
        const def = POLICY_DEFINITIONS[newPolicy];
        if (def) {
            setLength(def.length);
            setOptions(prev => ({
                ...prev,
                uppercase: def.uppercase,
                lowercase: def.lowercase,
                numbers: def.numbers,
                symbols: def.symbols
            }));
        }
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        let params: any = { type: mode };

        if (mode === 'passphrase') {
            params = {
                ...params,
                wordCount,
                separator,
                capitalize,
                includeNumber
            };
        } else if (mode === 'pronounceable') {
            params = {
                ...params,
                length,
                uppercase: options.uppercase,
                numbers: options.numbers
            };
        } else if (mode === 'custom') {
            params = {
                ...params,
                length,
                customCharset
            };
        } else {
            params = {
                ...params,
                length,
                policy,
                ...options
            };
        }

        const pwd = await generatePassword(params);
        setPassword(pwd);
        setIsCopied(false);
        setTimeout(() => setIsLoading(false), 300);
    };

    const copyToClipboard = () => {
        if (!password) return;
        navigator.clipboard.writeText(password);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    useEffect(() => {
        if (isOpen) handleGenerate();
    }, [isOpen, mode, policy]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('generator.title')}>
            <div className="space-y-6">
                {/* Result Display */}
                <div className="relative group">
                    <div className={`
                        w-full bg-navy-950/50 border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-500
                        ${isCopied ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-indigo-500/30'}
                    `}>
                        <motion.span
                            key={password}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`
                                text-2xl font-mono tracking-wider break-all block
                                ${isCopied ? 'text-emerald-400' : 'text-indigo-400'}
                            `}
                        >
                            {password || t('common.loading')}
                        </motion.span>
                    </div>

                    <div className="absolute top-4 right-4 flex gap-2">
                        <button
                            onClick={handleGenerate}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-white/60 hover:text-white"
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={copyToClipboard}
                            className={`
                                p-3 rounded-xl transition-all flex items-center gap-2
                                ${isCopied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}
                            `}
                        >
                            {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mode Selector */}
                <div className="flex bg-navy-800/50 p-1.5 rounded-2xl border border-white/5 overflow-x-auto">
                    <ModeButton
                        active={mode === 'alphanumeric'}
                        onClick={() => setMode('alphanumeric')}
                        icon={<Hash className="w-4 h-4" />}
                        label={t('generator.modeAlphanumeric')}
                    />
                    <ModeButton
                        active={mode === 'passphrase'}
                        onClick={() => setMode('passphrase')}
                        icon={<Type className="w-4 h-4" />}
                        label={t('generator.modePassphrase')}
                    />
                    <ModeButton
                        active={mode === 'pronounceable'}
                        onClick={() => setMode('pronounceable')}
                        icon={<Speech className="w-4 h-4" />}
                        label={t('generator.modePronounceable')}
                    />
                    <ModeButton
                        active={mode === 'custom'}
                        onClick={() => setMode('custom')}
                        icon={<Type className="w-4 h-4" />}
                        label={t('generator.modeCustom')}
                    />
                </div>

                <div className="bg-navy-800/30 rounded-3xl p-6 border border-white/5">
                    <AnimatePresence mode="wait">
                        {mode === 'alphanumeric' && (
                            <motion.div
                                key="alpha"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-black text-white/20 ml-1">{t('generator.policy')}</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {Object.keys(PASSWORD_POLICIES || { standard: 1, strict: 1, pin: 1, web: 1, legacy: 1 }).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => handlePolicyChange(p)}
                                                className={`
                                                    py-2 px-3 rounded-xl text-[10px] font-bold transition-all border
                                                    ${policy === p ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}
                                                `}
                                            >
                                                {(t(`generator.policies.${p}` as any) as string)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Slider
                                    label={t('generator.length')}
                                    value={length}
                                    min={4}
                                    max={128}
                                    onChange={setLength}
                                    unit={t('generator.characters')}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Toggle
                                        label="A-Z"
                                        active={options.uppercase}
                                        onClick={() => setOptions({ ...options, uppercase: !options.uppercase })}
                                    />
                                    <Toggle
                                        label="a-z"
                                        active={options.lowercase}
                                        onClick={() => setOptions({ ...options, lowercase: !options.lowercase })}
                                    />
                                    <Toggle
                                        label="0-9"
                                        active={options.numbers}
                                        onClick={() => setOptions({ ...options, numbers: !options.numbers })}
                                    />
                                    <Toggle
                                        label="!@#$"
                                        active={options.symbols}
                                        onClick={() => setOptions({ ...options, symbols: !options.symbols })}
                                    />
                                    <div className="col-span-2">
                                        <Toggle
                                            label={t('generator.excludeSimilar')}
                                            active={options.excludeSimilar}
                                            onClick={() => setOptions({ ...options, excludeSimilar: !options.excludeSimilar })}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {mode === 'passphrase' && (
                            <motion.div
                                key="phrase"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-6"
                            >
                                <Slider
                                    label={t('generator.wordCount')}
                                    value={wordCount}
                                    min={3}
                                    max={10}
                                    onChange={setWordCount}
                                    unit="kelime"
                                />
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-sm text-white/60">{t('generator.separator')}</span>
                                        <div className="flex gap-2">
                                            {['-', '.', '_', ' '].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setSeparator(s)}
                                                    className={`
                                                        w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all
                                                        ${separator === s ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}
                                                    `}
                                                >
                                                    {s === ' ' ? '␣' : s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Toggle
                                            label={t('generator.capitalizeWords')}
                                            active={capitalize}
                                            onClick={() => setCapitalize(!capitalize)}
                                        />
                                        <Toggle
                                            label={t('generator.includeNumber')}
                                            active={includeNumber}
                                            onClick={() => setIncludeNumber(!includeNumber)}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {mode === 'pronounceable' && (
                            <motion.div
                                key="pronounce"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-6"
                            >
                                <Slider
                                    label={t('generator.length')}
                                    value={length}
                                    min={8}
                                    max={32}
                                    onChange={setLength}
                                    unit={t('generator.characters')}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Toggle
                                        label="A-Z"
                                        active={options.uppercase}
                                        onClick={() => setOptions({ ...options, uppercase: !options.uppercase })}
                                    />
                                    <Toggle
                                        label="0-9"
                                        active={options.numbers}
                                        onClick={() => setOptions({ ...options, numbers: !options.numbers })}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {mode === 'custom' && (
                            <motion.div
                                key="custom"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-6"
                            >
                                <Slider
                                    label={t('generator.length')}
                                    value={length}
                                    min={4}
                                    max={128}
                                    onChange={setLength}
                                    unit={t('generator.characters')}
                                />
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-black text-white/20 ml-1">{t('generator.customCharset')}</label>
                                    <textarea
                                        value={customCharset}
                                        onChange={(e) => setCustomCharset(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-mono text-indigo-300 focus:border-indigo-500 outline-none transition-all h-24 resize-none"
                                        placeholder="Özel karakterleri buraya girin..."
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Tips */}
                <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                    <p className="text-[10px] uppercase tracking-widest font-black text-indigo-400/40 mb-1 text-center">GÜVENLİK NOTU</p>
                    <p className="text-xs text-indigo-300/40 leading-relaxed text-center">
                        {t('generator.securityNote')}
                    </p>
                </div>
            </div>
        </Modal>
    );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`
            flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all
            ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/30 hover:text-white/60'}
        `}
    >
        {icon}
        {label}
    </button>
);

const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`
            p-4 rounded-2xl border text-sm font-bold transition-all text-left flex items-center justify-between
            ${active ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-navy-900/50 border-white/5 text-white/20'}
        `}
    >
        {label}
        <div className={`w-2 h-2 rounded-full ${active ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-white/10'}`} />
    </button>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit: string }> = ({ label, value, min, max, onChange, unit }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-end">
            <span className="text-xs font-black uppercase tracking-widest text-white/30">{label}</span>
            <span className="text-lg font-mono font-bold text-indigo-400">{value} <span className="text-[10px] text-white/20 uppercase font-bold">{unit}</span></span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
    </div>
);

export default PasswordGeneratorModal;
