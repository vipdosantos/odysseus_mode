import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

// Scanner de QR por câmera reutilizável.
// Carrega jsQR dinamicamente (mesmo padrão do Scanner principal) e dispara
// onDetect(rawValue) a cada QR novo detectado (com cooldown de 3s).
export default function LoadQRScanner({ active, onDetect }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const jsQRRef = useRef(null);
  const lastScanned = useRef('');
  const [error, setError] = useState('');

  // Carrega jsQR uma vez
  useEffect(() => {
    if (jsQRRef.current) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = () => { jsQRRef.current = window.jsQR; };
    document.head.appendChild(s);
  }, []);

  // Liga/desliga câmera conforme `active`
  useEffect(() => {
    let raf;
    if (!active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return () => {};
    }
    (async () => {
      setError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      }
    })();

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState >= 2 && canvasRef.current && jsQRRef.current) {
        const w = videoRef.current.videoWidth;
        const h = videoRef.current.videoHeight;
        if (w && h) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
          const ctx = canvasRef.current.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQRRef.current(img.data, w, h);
          if (code?.data && code.data !== lastScanned.current) {
            lastScanned.current = code.data;
            setTimeout(() => { lastScanned.current = ''; }, 2500);
            onDetect?.(code.data);
          }
        }
      }
      raf = setTimeout(() => requestAnimationFrame(tick), 250);
    };
    raf = setTimeout(tick, 600);

    return () => {
      clearTimeout(raf);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [active, onDetect]);

  if (!active) return null;
  return (
    <div className="relative rounded-xl overflow-hidden border bg-black" style={{ height: 240 }}>
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      {/* Moldura de scan */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 border-2 border-primary/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
      </div>
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
        <span className="text-xs px-2 py-1 rounded-full bg-black/60 text-white flex items-center gap-1">
          <ScanLine className="w-3 h-3" /> Aponte para o QR da treliça
        </span>
      </div>
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white p-4 text-center">
          <CameraOff className="w-8 h-8" />
          <p className="text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}