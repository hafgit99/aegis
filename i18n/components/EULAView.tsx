import React from 'react';
import { Shield, Lock, AlertCircle, Scale, Fingerprint, Database, EyeOff, Globe, HardDrive, FileCheck } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const EULAView: React.FC = () => {
  const { lang } = useLanguage();

  const content = {
    tr: {
      sections: [
        {
          title: "1. LİSANS VERİLMESİ",
          icon: FileCheck,
          desc: "Aegis Vault, bu yazılımı kullanmanız için size kişisel, dünya çapında, telifsiz, devredilemez ve münhasır olmayan bir lisans verir. Bu lisansın tek amacı, Aegis Vault tarafından sunulan hizmetlerden yararlanmanızı sağlamaktır."
        },
        {
          title: "2. SIFIR-BİLGİ (ZERO-KNOWLEDGE) VE GİZLİLİK",
          icon: EyeOff,
          desc: "Aegis Vault, tam gizlilik esasına dayalı 'Zero-Knowledge' prensibiyle çalışır. Ana şifreniz (Master Password) veya kasanızdaki veriler asla bir sunucuya iletilmez, depolanmaz veya geliştirici dahil üçüncü şahıslar tarafından erişilemez. Tüm şifreleme işlemleri AES-256-GCM kullanılarak sadece sizin cihazınızda gerçekleşir."
        },
        {
          title: "3. YEREL DEPOLAMA VE GÜVENLİK",
          icon: HardDrive,
          desc: "Tüm verileriniz cihazınızdaki güvenli bir veritabanında saklanır. Uygulama hiçbir analitik veri veya kullanıcı alışkanlığı takibi yapmaz. Verilerinizin güvenliği, cihazınızın fiziksel güvenliği ve ana şifrenizin karmaşıklığı ile doğrudan ilişkilidir."
        },
        {
          title: "4. KULLANICI SORUMLULUĞU (KRİTİK!)",
          icon: AlertCircle,
          desc: "Ana şifrenizi veya kurtarma kelimelerinizi kaybetmeniz durumunda, verilere erişimi kurtarmanın bir yolu yoktur. Geliştirici şifre sıfırlama hizmeti sunamaz. Yedekleme ve şifre yönetimi tamamen kullanıcının sorumluluğundadır.",
          critical: true
        },
        {
          title: "5. GARANTİ REDDİ VE SORUMLULUK SINIRI",
          icon: Scale,
          desc: "Yazılım 'olduğu gibi' sunulmaktadır. Geliştirici, yazılımın kullanımından doğabilecek veri kaybı, kâr kaybı veya herhangi bir dolaylı zarardan sorumlu tutulamaz. Yazılımı kullanarak bu şartları kabul etmiş sayılırsınız."
        }
      ],
      footer: "Aegis Security Mühendislik ve Hukuk Departmanı tarafından onaylanmıştır."
    },
    en: {
      sections: [
        {
          title: "1. GRANT OF LICENSE",
          icon: FileCheck,
          desc: "Aegis Vault grants you a personal, worldwide, royalty-free, non-assignable and non-exclusive license to use the software. This license is for the sole purpose of enabling you to use and enjoy the benefit of the services provided by Aegis Vault."
        },
        {
          title: "2. ZERO-KNOWLEDGE & PRIVACY",
          icon: EyeOff,
          desc: "Aegis Vault operates under a strict 'Zero-Knowledge' protocol. Your Master Password and vault data are never transmitted to any server or accessible by any third party. Encryption occurs locally using AES-256-GCM, ensuring only you hold the keys."
        },
        {
          title: "3. LOCAL STORAGE & SECURITY",
          icon: HardDrive,
          desc: "All data assets are stored within a secure local database on your machine. We do not collect telemetry or user behavior data. The security of your data depends on the physical security of your device and the strength of your master password."
        },
        {
          title: "4. USER RESPONSIBILITY (CRITICAL!)",
          icon: AlertCircle,
          desc: "If you lose your Master Password or Recovery Words, access to your data cannot be recovered. The developer cannot provide reset services. Secure backup of your credentials is the sole responsibility of the user.",
          critical: true
        },
        {
          title: "5. DISCLAIMER & LIMITATION OF LIABILITY",
          icon: Scale,
          desc: "The software is provided 'as is'. The developer shall not be liable for any loss of data, loss of profits, or any indirect damages resulting from the use of the software. By using this software, you agree to these terms."
        }
      ],
      footer: "Certified by Aegis Security Engineering & Legal Division."
    }
  };

  const current = lang === 'tr' ? content.tr : content.en;

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mb-1">Legal Compliance Protocol</h2>
          <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Version: 2024.12 - Enterprise Grade Security</p>
        </div>
        <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[9px] font-black text-zinc-400">
          STALWART EULA v5
        </div>
      </div>

      <div className="space-y-5">
        {current.sections.map((section, idx) => (
          <div key={idx} className={`p-6 rounded-[2rem] border transition-all hover:bg-white/[0.03] ${section.critical ? 'bg-red-500/[0.03] border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.05)]' : 'bg-white/[0.01] border-white/5'}`}>
            <div className="flex items-center gap-4 mb-3">
              <div className={`p-2.5 rounded-xl ${section.critical ? 'bg-red-600/10 text-red-500' : 'bg-blue-600/10 text-blue-500'}`}>
                <section.icon size={18} />
              </div>
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${section.critical ? 'text-red-400' : 'text-zinc-100'}`}>
                {section.title}
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-medium pl-2 border-l border-white/10 ml-2">
              {section.desc}
            </p>
          </div>
        ))}

        <div className="pt-6 text-center border-t border-white/5">
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] italic leading-loose">
            {current.footer}<br />
            Aegis Security Engineering &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EULAView;
