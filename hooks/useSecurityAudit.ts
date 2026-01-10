
import { useState, useCallback } from 'react';
import { VaultEntry, SensitiveData } from '../types.ts';
import { analyzeStrength } from '../utils/passwordStrength.ts';
// import { OfflineBreachService } from '../services/offlineBreachService';

export interface AuditIssue {
  entry: VaultEntry;
  type: 'weak' | 'reused' | 'old' | 'breached';
  severity: 'critical' | 'warning';
  messageKey: string;
}

export interface SmartTip {
  id: string;
  titleKey: string;
  descriptionKey: string;
  improvementKey: string;
}

export interface AuditStats {
  score: number;
  total: number;
  unique: number;
  atRisk: number;
  secureCount: number;
  breachMatches: number;
  breachDatabaseStats?: {
    patternCount: number;
    initialized: boolean;
  };
}

const commonPatterns = ['123456', 'password', 'qwerty', '12345678', 'admin', 'welcome'];

export const useSecurityAudit = (entries: VaultEntry[], decryptFn: (e: VaultEntry) => Promise<SensitiveData>) => {
  const [isScanning, setIsScanning] = useState(false);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [tips, setTips] = useState<SmartTip[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    score: 0, total: 0, unique: 0, atRisk: 0, secureCount: 0, breachMatches: 0
  });

  const generateSmartTips = (issues: AuditIssue[], stats: AuditStats): SmartTip[] => {
    const generatedTips: SmartTip[] = [];

    if (stats.atRisk > 0) {
      generatedTips.push({
        id: 'length_boost',
        titleKey: 'tip_length_title',
        descriptionKey: 'tip_length_desc',
        improvementKey: '+40% Entropy'
      });
    }

    if (issues.some(i => i.type === 'reused')) {
      generatedTips.push({
        id: 'unique_keys',
        titleKey: 'tip_unique_title',
        descriptionKey: 'tip_unique_desc',
        improvementKey: 'Zero Collision'
      });
    }

    if (stats.score < 90) {
      generatedTips.push({
        id: 'rotation',
        titleKey: 'tip_rotation_title',
        descriptionKey: 'tip_rotation_desc',
        improvementKey: 'Active Defense'
      });
    }

    return generatedTips;
  };

  const runAudit = useCallback(async () => {
    if (entries.length === 0) return;

    // Offline breach database missing
    // await OfflineBreachService.initialize();

    setIsScanning(true);
    await new Promise(r => setTimeout(r, 2000));

    const foundIssues: AuditIssue[] = [];
    const plainPasswords: Record<string, VaultEntry[]> = {};
    let atRiskIds = new Set<string>();
    let breachMatches = 0;

    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    console.log(`[SecurityAudit] Starting audit for ${entries.length} entries...`);

    for (const entry of entries) {
      try {
        const sensitive = await decryptFn(entry);
        const pass = sensitive.password || '';

        // 1. Strength analysis
        const strength = analyzeStrength(pass);
        if (strength.bits < 60) {
          foundIssues.push({
            entry,
            type: 'weak',
            severity: strength.bits < 40 ? 'critical' : 'warning',
            messageKey: strength.bits < 40 ? 'audit_msg_weak_critical' : 'audit_msg_weak_warning'
          });
          atRiskIds.add(entry.id);
        }

        // 2. Offline breach check (REMOVED - missing service)
        /*
        const breachResult = await OfflineBreachService.checkPassword(pass);
        if (breachResult.isBreached) {
          foundIssues.push({
            entry,
            type: 'breached',
            severity: breachResult.strength < 40 ? 'critical' : 'warning',
            messageKey: 'audit_msg_breached'
          });
          atRiskIds.add(entry.id);
          breachMatches++;
        }
        */

        // 3. Pattern matching
        const isCommon = commonPatterns.some(p => pass.toLowerCase().includes(p));
        if (isCommon) {
          foundIssues.push({
            entry,
            type: 'breached',
            severity: 'critical',
            messageKey: 'audit_msg_breached'
          });
          atRiskIds.add(entry.id);
          breachMatches++;
        }

        // 4. Duplicate password check
        if (pass) {
          if (!plainPasswords[pass]) plainPasswords[pass] = [];
          plainPasswords[pass].push(entry);
        }

        // 5. Old password check (6+ months)
        if (now - entry.updatedAt > SIX_MONTHS_MS) {
          foundIssues.push({
            entry,
            type: 'old',
            severity: 'warning',
            messageKey: 'audit_msg_old'
          });
          atRiskIds.add(entry.id);
        }
      } catch (e) {
        console.error("Audit decryption failed", entry.id);
      }
    }

    Object.values(plainPasswords).forEach(dupes => {
      if (dupes.length > 1) {
        dupes.forEach(entry => {
          foundIssues.push({
            entry,
            type: 'reused',
            severity: 'critical',
            messageKey: 'audit_msg_reused'
          });
          atRiskIds.add(entry.id);
        });
      }
    });

    const riskFactor = entries.length > 0 ? (atRiskIds.size / entries.length) * 100 : 0;
    const finalScore = Math.max(0, 100 - Math.round(riskFactor));

    // Get breach database statistics
    // const breachStats = OfflineBreachService.getStats();

    const newStats = {
      score: finalScore,
      total: entries.length,
      unique: Object.keys(plainPasswords).length,
      atRisk: atRiskIds.size,
      secureCount: entries.length - atRiskIds.size,
      breachMatches,
      breachDatabaseStats: {
        patternCount: 0,
        initialized: false
      }
    };

    console.log(`[SecurityAudit] Audit complete: score=${finalScore}, breached=${breachMatches}, atRisk=${atRiskIds.size}`);

    setStats(newStats);
    setIssues(foundIssues);
    setTips(generateSmartTips(foundIssues, newStats));
    setIsScanning(false);
  }, [entries, decryptFn]);

  return { runAudit, isScanning, issues, stats, tips };
};
