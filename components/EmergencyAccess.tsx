import React, { useState } from 'react';
import { ShieldAlert, Zap, FileText, Download, Activity, Lock, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'framer-motion';

interface EmergencyAccessProps {
    onPanic: () => void;
}

const EmergencyAccess: React.FC<EmergencyAccessProps> = ({ onPanic }) => {
    const { t } = useLanguage();

    const handleDownloadKit = () => {
        // Simple Text Template for Emergency Kit
        const content = `
AEGIS VAULT - EMERGENCY RECOVERY KIT
====================================
Generated: ${new Date().toLocaleString()}

IMPORTANT: Keep this document in a secure, physical location (e.g., a safe).

1. MASTER PASSWORD HINT
-----------------------
[                                        ]


2. EMERGENCY CONTACTS
---------------------
Name: [                     ]  Phone: [                     ]
Name: [                     ]  Phone: [                     ]


3. RECOVERY WORDS (24-WORD PHRASE)
----------------------------------
If you have set up recovery words in Aegis Vault, write them down here:

01. [          ]  07. [          ]  13. [          ]  19. [          ]
02. [          ]  08. [          ]  14. [          ]  20. [          ]
03. [          ]  09. [          ]  15. [          ]  21. [          ]
04. [          ]  10. [          ]  16. [          ]  22. [          ]
05. [          ]  11. [          ]  17. [          ]  23. [          ]
06. [          ]  12. [          ]  18. [          ]  24. [          ]


4. 2FA BACKUP CODES
-------------------
[          ]  [          ]  [          ]
[          ]  [          ]  [          ]


IN CASE OF EMERGENCY
--------------------
1. Access this document.
2. Use the Recovery Words to restore the vault on a new device.
3. If 2FA is lost, use Backup Codes.
`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Aegis_Emergency_Kit_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            {/* Panic Control */}
            <div className="glass p-5 rounded-[1.5rem] border border-red-500/10 bg-red-500/[0.02] flex items-center justify-between group hover:border-red-500/30 transition-all relative overflow-hidden">
                <div className="absolute inset-0 bg-red-500/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-600/20 group-hover:scale-110 transition-transform">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">{t('panic_button')}</h4>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 max-w-[200px] leading-relaxed">{t('panic_button_desc')}</p>
                    </div>
                </div>
                <button
                    onClick={onPanic}
                    className="relative z-10 px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-red-600/20 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Zap size={14} fill="currentColor" /> {t('activate_panic_btn')}
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Emergency Kit */}
                <div className="glass p-5 rounded-[1.5rem] border border-white/5 hover:border-amber-500/30 transition-all flex flex-col gap-4 group">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                            <FileText size={20} />
                        </div>
                        <div className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-[9px] font-black uppercase tracking-wider">
                            {t('important')}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">{t('emergency_kit')}</h4>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 leading-relaxed">{t('emergency_kit_desc')}</p>
                    </div>
                    <button
                        onClick={handleDownloadKit}
                        className="mt-auto w-full py-3 border border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Download size={14} /> {t('generate_kit')}
                    </button>
                </div>

                {/* Anomaly Detection Status (Mock) */}
                <div className="glass p-5 rounded-[1.5rem] border border-white/5 hover:border-blue-500/30 transition-all flex flex-col gap-4 group">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                            <Activity size={20} />
                        </div>
                        <div className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-[9px] font-black uppercase tracking-wider">
                            {t('status_monitoring')}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">{t('anomaly_detection')}</h4>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 leading-relaxed">{t('anomaly_notice')}</p>
                    </div>
                    <div className="mt-auto pt-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">System Normal</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmergencyAccess;
