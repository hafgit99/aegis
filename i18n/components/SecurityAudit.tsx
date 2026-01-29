import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, ShieldCheck, ShieldX, Info,
  RotateCw, AlertTriangle, CheckCircle2,
  Activity, ArrowRight, Shield, Zap, Lightbulb,
  Target, Fingerprint, Globe, Search, Key
} from 'lucide-react';
import { VaultEntry } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVault } from '../../hooks/useVault';
import { useSecurityAudit, AuditIssue } from '../../hooks/useSecurityAudit';

interface SecurityAuditProps {
  entries: VaultEntry[];
  onEditEntry: (entry: VaultEntry) => void;
  onRotateKey: () => void;
}

const SecurityAudit: React.FC<SecurityAuditProps> = ({ entries, onEditEntry, onRotateKey }) => {
  const { t } = useLanguage();
  const { decryptData } = useVault();
  const { runAudit, isScanning, issues, stats, tips } = useSecurityAudit(entries, decryptData);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'warning'>('all');

  useEffect(() => {
    runAudit();
  }, []);

  const filteredIssues = issues.filter(issue => {
    if (activeFilter === 'all') return true;
    return issue.severity === activeFilter;
  });

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (stats.score / 100) * circumference;

  const tipIcons: Record<string, any> = { Zap, Key: Shield, RotateCw };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24">
      <AnimatePresence>
        {isScanning ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/90 backdrop-blur-2xl"
          >
            <div className="relative w-80 h-80 flex items-center justify-center">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.8 }}
                  className="absolute inset-0 border border-blue-500/30 rounded-full"
                />
              ))}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-[1px] border-blue-500/20 rounded-full bg-gradient-to-t from-blue-500/10 via-transparent to-transparent"
              />
              <div className="absolute inset-0 overflow-hidden rounded-full border border-white/5">
                <motion.div
                  animate={{ y: [-320, 320] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.8)]"
                />
              </div>
              <div className="relative z-10 flex flex-col items-center">
                <Fingerprint size={64} className="text-blue-500 animate-pulse" />
              </div>
            </div>
            <div className="mt-12 text-center">
              <h2 className="text-2xl font-black text-white tracking-[0.5em] uppercase">{t('deep_audit')}</h2>
              <p className="text-[10px] text-zinc-500 mt-3 font-bold uppercase tracking-widest flex items-center gap-3">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                {t('scanning_blocks')}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 glass rounded-[3.5rem] p-12 flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-56 h-56">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="112" cy="112" r={radius + 15} fill="transparent" stroke="currentColor" strokeWidth="2" className="text-zinc-900" strokeDasharray="5 5" />
                    <circle cx="112" cy="112" r={radius} fill="transparent" stroke="currentColor" strokeWidth="16" className="text-zinc-900/50" />
                    <motion.circle
                      cx="112" cy="112" r={radius} fill="transparent" stroke="currentColor" strokeWidth="16"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: offset }}
                      transition={{ duration: 2.5, ease: "circOut" }}
                      className={stats.score > 80 ? 'text-emerald-500' : stats.score > 50 ? 'text-amber-500' : 'text-red-500'}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-black text-white tracking-tighter">{stats.score}</span>
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mt-1">{t('health_score')}</span>
                  </div>
                </div>
                <div className="mt-8 text-center px-4">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-loose">
                    {stats.score === 100 ? t('score_perfect') : t('score_warning')}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: t('stat_at_risk'), value: stats.atRisk, icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
                    { label: t('stat_breach'), value: stats.breachMatches, icon: Globe, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                    { label: t('stat_unique'), value: stats.unique, icon: Target, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                    { label: t('stat_secure'), value: stats.secureCount, icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  ].map((stat, i) => (
                    <div key={i} className="glass rounded-[2rem] p-6 border border-white/5 flex flex-col items-center text-center">
                      <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} mb-4`}><stat.icon size={20} /></div>
                      <span className="text-2xl font-black text-white mb-1">{stat.value}</span>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{stat.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex-1 glass rounded-[2.5rem] p-8 border border-white/5 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg"><Lightbulb size={18} /></div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">{t('smart_tips')}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tips.map((tip, idx) => {
                      const Icon = tipIcons[tip.id === 'length_boost' ? 'Zap' : tip.id === 'unique_keys' ? 'Key' : 'RotateCw'] || Zap;
                      return (
                        <div key={`audit-tip-${tip.id}-${idx}`} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col h-full hover:bg-white/[0.04] transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <Icon className="text-blue-500" size={20} />
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">{tip.improvementKey}</span>
                          </div>
                          <h4 className="text-xs font-bold text-white mb-2">{t(tip.titleKey as any)}</h4>
                          <p className="text-[10px] text-zinc-500 leading-relaxed flex-1">{t(tip.descriptionKey as any)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {stats.masterKeyStatus && (
              <div className={`glass rounded-[2.5rem] p-8 border ${stats.masterKeyStatus.isOld ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'} transition-all`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-[1.5rem] ${stats.masterKeyStatus.isOld ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      <Key size={32} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-xl font-black text-white uppercase tracking-tighter">
                          {t('master_key_status')}
                        </h4>
                        {stats.masterKeyStatus.isOld && (
                          <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded">
                            {t('rotation_required')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                        {t('last_rotated')}: {new Date(stats.masterKeyStatus.lastRotated).toLocaleDateString()} ({stats.masterKeyStatus.ageDays} {t('days_ago')})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onRotateKey}
                    className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${stats.masterKeyStatus.isOld
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                      }`}
                  >
                    {t('rotate_master_key')}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">{t('security_report')}</h3>
                  <span className="px-3 py-1 bg-zinc-900 border border-white/5 rounded-full text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    {filteredIssues.length} {t('findings')}
                  </span>
                </div>
                <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5">
                  {(['all', 'critical', 'warning'] as const).map((f, idx) => (
                    <button
                      key={`filter-${f}-${idx}`} onClick={() => setActiveFilter(f)}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === f ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-zinc-600 hover:text-white'}`}
                    >
                      {t(`filter_${f}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredIssues.length > 0 ? filteredIssues.map((issue, idx) => (
                    <motion.div
                      key={`${issue.entry.id}-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      className="glass rounded-[2rem] border border-white/5 p-6 flex items-center justify-between group hover:border-blue-500/20 transition-all cursor-pointer"
                      onClick={() => onEditEntry(issue.entry)}
                    >
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl ${issue.severity === 'critical' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {issue.type === 'weak' ? <ShieldX size={24} /> : issue.type === 'reused' ? <AlertTriangle size={24} /> : issue.type === 'breached' ? <Globe size={24} /> : <Activity size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="font-bold text-white text-lg">{issue.entry.title}</h4>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${issue.severity === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'}`}>
                              {issue.severity.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{issue.entry.username}</span>
                            <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                            <span className="text-[10px] font-bold text-zinc-400 italic">
                              {t(issue.messageKey as any)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditEntry(issue.entry); }}
                        className="flex items-center gap-4 pl-8 group/btn"
                      >
                        <div className="text-right">
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">{t('recover_account')}</p>
                          <p className="text-[8px] font-bold text-zinc-600 uppercase mt-0.5">{t('change_password')}</p>
                        </div>
                        <div className="p-4 bg-white/5 text-zinc-500 group-hover:bg-blue-600 group-hover:text-white rounded-2xl transition-all shadow-xl">
                          <ArrowRight size={20} />
                        </div>
                      </button>
                    </motion.div>
                  )) : (
                    <div className="py-24 flex flex-col items-center justify-center text-center glass rounded-[3.5rem] border-dashed border-zinc-900 border-2">
                      <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                        <ShieldCheck size={48} className="text-emerald-500" />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-widest">{t('vault_flawless')}</h3>
                      <p className="text-xs text-zinc-500 mt-2 font-bold uppercase tracking-widest max-w-sm">{t('vault_flawless_desc')}</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-blue-500/10 bg-blue-500/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Info className="text-blue-500" size={20} />
                <div className="flex flex-col">
                  <p className="text-[10px] text-blue-500/80 font-bold uppercase tracking-widest leading-relaxed">
                    {t('offline_notice')}
                  </p>
                  {stats.breachDatabaseStats?.initialized && (
                    <p className="text-[9px] text-zinc-500 mt-1 font-medium uppercase tracking-wide">
                      {t('breach_db_loaded', {
                        count: stats.breachDatabaseStats.patternCount?.toLocaleString() || '0',
                        version: stats.breachDatabaseStats.version || '1.0'
                      })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                {stats.breachDatabaseStats?.initialized && (
                  <div className="flex items-center gap-4 text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span>{stats.breachDatabaseStats.totalChecks || 0} {t('checks')}</span>
                    </div>
                    {stats.breachDatabaseStats.lastUpdated && (
                      <span>{new Date(stats.breachDatabaseStats.lastUpdated).toLocaleDateString()}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SecurityAudit;