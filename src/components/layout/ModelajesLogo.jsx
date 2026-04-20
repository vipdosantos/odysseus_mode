import React from 'react';

export default function ModelajesLogo({ collapsed }) {
  if (collapsed) {
    // Icon only: just the M badge
    return (
      <div className="w-9 h-9 mx-auto flex items-center justify-center rounded-lg" style={{ background: '#F47920' }}>
        <svg viewBox="0 0 40 40" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M mark white */}
          <path d="M8 30 L8 14 L20 26 L32 14 L32 30" stroke="white" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Icon: rounded square with M cutout */}
      <svg viewBox="0 0 54 54" width="44" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="54" height="54" rx="10" fill="#F47920"/>
        {/* White M shape */}
        <path d="M10 42 L10 18 L27 34 L44 18 L44 42" stroke="white" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
        {/* Cut notch at bottom of M */}
        <rect x="17" y="36" width="20" height="12" rx="2" fill="#F47920"/>
      </svg>

      {/* Text: MODELAJES in navy */}
      <div className="flex flex-col leading-none">
        <span className="font-extrabold text-xl tracking-widest" style={{ color: '#2B3A8F', letterSpacing: '0.08em' }}>
          MODELAJES
        </span>
        {/* Truss decoration line */}
        <svg viewBox="0 0 160 12" width="130" height="10" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="2" x2="160" y2="2" stroke="#F47920" strokeWidth="1.5"/>
          {[0,13,26,39,52,65,78,91,104,117,130,143].map((x, i) => (
            <polygon key={i} points={`${x+1},2 ${x+13},10 ${x+7},2`} fill="none" stroke="#F47920" strokeWidth="1.2"/>
          ))}
          <line x1="0" y1="10" x2="160" y2="10" stroke="#F47920" strokeWidth="1.5"/>
        </svg>
      </div>
    </div>
  );
}