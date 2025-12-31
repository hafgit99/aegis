
import React from 'react';

interface BrandIconProps {
  className?: string;
  size?: number;
}

const BrandIcon: React.FC<BrandIconProps> = ({ className = "", size = 120 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-2xl"
      >
        <defs>
          {/* Arka plan Sapphire Glow */}
          <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          
          {/* Cam Efekti Gradienti */}
          <linearGradient id="glass-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0.02" />
          </linearGradient>

          {/* Kalkan Ana Rengi */}
          <linearGradient id="shield-base" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1e24" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>

          {/* Altın Mühür Detayı */}
          <linearGradient id="gold-detail" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <filter id="blur-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>
        </defs>

        {/* Arka Parlama */}
        <circle cx="100" cy="100" r="80" fill="url(#glow)" />

        {/* Ana Kalkan Formu */}
        <path
          d="M100 20C70 20 40 35 40 70C40 120 100 170 100 170C100 170 160 120 160 70C160 35 130 20 100 20Z"
          fill="url(#shield-base)"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />

        {/* Cam Katmanı (Glassmorphism) */}
        <path
          d="M100 35C80 35 55 45 55 75C55 110 100 150 100 150C100 150 145 110 145 75C145 45 120 35 100 35Z"
          fill="url(#glass-gradient)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.5"
          style={{ backdropFilter: 'blur(8px)' }}
        />

        {/* Altın Mühür / Kilit Sembolü */}
        <rect x="96" y="65" width="8" height="30" rx="4" fill="url(#gold-detail)" />
        <circle cx="100" cy="105" r="5" fill="url(#gold-detail)" />
        
        {/* Işık Yansıması */}
        <path
          d="M70 55C70 55 85 45 100 45"
          stroke="white"
          strokeOpacity="0.3"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default BrandIcon;
