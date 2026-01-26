
import React from 'react';
import { Shield, Lock, Calendar, FileText, Printer } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface EmergencySheetProps {
  fileName: string;
  exportDate: number;
  entryCount: number;
}

const EmergencySheet: React.FC<EmergencySheetProps> = ({ fileName, exportDate, entryCount }) => {
  const { t } = useLanguage();
  const dateStr = new Date(exportDate).toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white text-black p-12 min-h-[842px] w-[595px] mx-auto shadow-2xl font-serif print:shadow-none print:m-0 print:w-full">
      <div className="flex justify-between items-start border-b-4 border-black pb-8 mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">AEGIS VAULT</h1>
          <p className="text-xs font-bold uppercase tracking-[0.3em]">Emergency Recovery Sheet</p>
        </div>
        <div className="p-4 bg-black text-white rounded-2xl">
          <Shield size={48} />
        </div>
      </div>

      <div className="space-y-12">
        <section>
          <div className="flex items-center gap-3 mb-4 border-b border-zinc-200 pb-2">
            <FileText size={18} />
            <h2 className="text-sm font-black uppercase tracking-widest">Backup Metadata</h2>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">File Identifier</p>
              <p className="text-sm font-mono break-all">{fileName}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Timestamp</p>
              <p className="text-sm">{dateStr}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Asset Count</p>
              <p className="text-sm font-bold">{entryCount} Encrypted Items</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Protocol</p>
              <p className="text-sm">AES-256-GCM / PBKDF2</p>
            </div>
          </div>
        </section>

        <section className="bg-zinc-50 p-8 border-2 border-dashed border-zinc-200 rounded-3xl relative">
          <div className="absolute -top-3 left-6 bg-white px-3 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Lock size={12} /> Master Security Notice
          </div>
          <p className="text-sm leading-relaxed mb-6">
            This backup file is encrypted. Access requires your <strong>Master Password</strong>. 
            AEGIS Vault does not store your password on any server. If you lose your password, 
            the data in the associated backup file will be permanently unrecoverable.
          </p>
          <div className="h-24 border border-zinc-300 rounded-xl bg-white flex items-center justify-center">
            <p className="text-[10px] text-zinc-300 font-bold uppercase italic">Write password hint or safe location here (Optional)</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 mb-4 border-b border-zinc-200 pb-2">
            <Calendar size={18} />
            <h2 className="text-sm font-black uppercase tracking-widest">Recovery Steps</h2>
          </div>
          <ol className="list-decimal list-inside text-sm space-y-3 text-zinc-700">
            <li>Open Aegis Vault application.</li>
            <li>Go to <strong>Settings &gt; Data Portability</strong>.</li>
            <li>Select the <strong>.aegis</strong> file mentioned above.</li>
            <li>Provide your Master Password when prompted.</li>
            <li>Verify integrity and commit import.</li>
          </ol>
        </section>

        <div className="mt-auto pt-20 text-center">
          <div className="w-24 h-24 border-2 border-black mx-auto mb-4 flex items-center justify-center">
            <p className="text-[8px] font-black uppercase text-zinc-400">Place QR Code<br/>Stamp Here</p>
          </div>
          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Aegis Vault Security Protocol v4.0.0-PRO</p>
        </div>
      </div>

      <div className="fixed bottom-10 right-10 print:hidden">
        <button 
          onClick={handlePrint}
          className="flex items-center gap-3 px-6 py-3 bg-black text-white rounded-full hover:scale-105 transition-transform shadow-2xl"
        >
          <Printer size={18} />
          <span className="text-xs font-black uppercase tracking-widest">Print to PDF</span>
        </button>
      </div>
    </div>
  );
};

export default EmergencySheet;
