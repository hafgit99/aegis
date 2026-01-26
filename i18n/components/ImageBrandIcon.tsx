/**
 * Image-based Brand Icon Component
 * son.png dosyasını kullanarak branding
 */

import React from 'react';
import { iconBase64 } from './icon-data';

interface ImageBrandIconProps {
  className?: string;
  size?: number;
  alt?: string;
}

const ImageBrandIcon: React.FC<ImageBrandIconProps> = ({
  className = "",
  size = 120,
  alt = "Aegis Vault"
}) => {

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <img
        src="./icon1.png"
        alt={alt}
        width={size}
        height={size}
        className="drop-shadow-2xl object-contain"
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
      />
    </div>
  );
};

export default ImageBrandIcon;
