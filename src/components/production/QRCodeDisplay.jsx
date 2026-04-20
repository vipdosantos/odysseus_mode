import React from 'react';

export default function QRCodeDisplay({ value, size = 100 }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  
  return (
    <div className="flex items-center gap-3">
      <img src={qrUrl} alt={`QR: ${value}`} width={size} height={size} className="rounded" />
      <span className="text-[10px] text-muted-foreground font-mono break-all">{value}</span>
    </div>
  );
}