import React from 'react';

const Avatar = ({ src, alt, name, className = '', size = 'medium', onClick }) => {
  const sizeClasses = {
    tiny: 'h-6 w-6 min-w-[24px]',
    small: 'h-8 w-8 min-w-[32px]',
    medium: 'h-12 w-12 min-w-[48px]',
    large: 'h-14 w-14 min-w-[56px] md:h-16 md:w-16 md:min-w-[64px]',
    xl: 'h-20 w-20 min-w-[80px] md:h-24 md:w-24 md:min-w-[96px]',
    xxl: 'h-28 w-28 min-w-[112px] md:h-32 md:w-32 md:min-w-[128px]'
  };

  const pixelSizes = {
    tiny: 24,
    small: 32,
    medium: 48,
    large: 56,
    xl: 80,
    xxl: 112
  };

  const getResponsivePixelSize = (size) => {
    const base = pixelSizes[size] || 48;
    return window.innerWidth < 768 ? Math.min(base, 56) : base;
  };

  const getUiAvatarUrl = () => {
    const displayName = name || alt || 'User';
    const sizePx = getResponsivePixelSize(size);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=${sizePx}&rounded=true`;
  };

  const getImageSource = () => {
    if (src && typeof src === 'string' && src.trim() !== '' && src !== 'null' && src !== 'undefined') {
      if (src.startsWith('/uploads/')) {
        const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';
        return `${API_BASE_URL}${src}`;
      }
      return src;
    }
    return getUiAvatarUrl();
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = getUiAvatarUrl();
  };

  const imageSrc = getImageSource();

  return (
    <div 
      className={`
        relative overflow-hidden rounded-full
        ${sizeClasses[size]}
        bg-gray-100 dark:bg-gray-700 flex-shrink-0
        ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="w-full h-full rounded-full overflow-hidden">
        <img 
          src={imageSrc} 
          alt={alt || name || 'User avatar'} 
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default Avatar;