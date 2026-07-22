import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/69e67ee13ca6bee2db939472/a733a5b7d_graph-paper-5mm-1-en.png';

export { LOGO_URL };

export default function ModelajesLogo({ collapsed }) {
  if (collapsed) {
    return (
      <div className="w-9 h-9 mx-auto flex items-center justify-center rounded-lg overflow-hidden" style={{ background: '#F47920' }}>
        <img src={LOGO_URL} alt="M" className="w-8 h-8 object-cover object-left" />
      </div>
    );
  }

  return (
    <div className="flex items-center px-1">
      <img src={LOGO_URL} alt="Modelajes" className="h-12 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
    </div>
  );
}