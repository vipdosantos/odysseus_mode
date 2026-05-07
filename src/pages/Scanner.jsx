import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScanLine, CheckCircle2, AlertCircle, Camera, CameraOff, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Role → which status transition the scanner triggers
const ROLE_ACTIONS = {
  admin:       { label: 'Admin (Produção)',       fromStatus: null,          toStatus: 'producao',       logLabel: 'Produção' },
  operador:    { label: 'Operador (Produção)',     fromStatus: null,          toStatus: 'producao',       logLabel: 'Produção' },
  cortador:    { label: 'Cortador (Corte Vigas)',  fromStatus: null,          toStatus: 'corte_vigas',    logLabel: 'Corte de Vigas' },
  secagem:     { label: 'Secagem',                 fromStatus: 'producao',    toStatus: 'secagem',        logLabel: 'Secagem' },
  expedicao:   { label: 'Expedição',               fromStatus: 'secagem',     toStatus: 'expedicao',      logLabel: 'Expedição' },
  financeiro:  { label: 'Financeiro',              fromStatus: null,          toStatus: null,             logLabel: 'Consulta' },
  visualizador:{ label: 'Visualizador',            fromStatus: null,          toStatus: null,             logLabel: 'Consulta' },
};

export default function Scanner() {
  const { user } = useOutletContext();
  const [qrInput, setQrInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('keyboard'); // 'keyboard' | 'camera'
  const [cameraError, setCameraError] = useState('');
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const queryClient = useQueryClient();

  const role = user?.role || 'operador';
  const roleAction = ROLE_ACTIONS[role] || ROLE_ACTIONS.operador;

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  // --- Camera ---
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setCameraError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode]);

  // --- QR Decode from video frame ---
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const lastScanned = useRef('');

  // Load jsQR dynamically
  const jsQRRef = useRef(null);
  useEffect(() => {
    if (jsQRRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.onload = () => { jsQRRef.current = window.jsQR; };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (mode !== 'camera') {
      clearInterval(scanIntervalRef.current);
      return;
    }
    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = videoRef.current.videoWidth;
      const h = videoRef.current.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);

      // Try jsQR first (works everywhere)
      if (jsQRRef.current) {
        const code = jsQRRef.current(imageData.data, w, h);
        if (code?.data && code.data !== lastScanned.current) {
          lastScanned.current = code.data;
          setTimeout(() => { lastScanned.current = ''; }, 3000);
          processScan(code.data);
          return;
        }
      }

      // Fallback: BarcodeDetector (Chrome/Android)
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(canvas).then(codes => {
          if (codes.length > 0) {
            const val = codes[0].rawValue;
            if (val && val !== lastScanned.current) {
              lastScanned.current = val;
              setTimeout(() => { lastScanned.current = ''; }, 3000);
              processScan(val);
            }
          }
        }).catch(() => {});
      }
    }, 400);
    return () => clearInterval(scanIntervalRef.current);
  }, [mode, orders]);

  const processScan = async (rawValue) => {
    setLoading(true);
    setResult(null);

    let qrId = rawValue.trim();
    // Try to parse JSON QR (from label format)
    try {
      const parsed = JSON.parse(rawValue);
      qrId = parsed.id || parsed.qr_code_id || rawValue.trim();
    } catch (_) {}

    let foundOrder = null;
    let foundItemIdx = -1;

    for (const order of orders) {
      const idx = order.items?.findIndex(item =>
        item.qr_code_id === qrId ||
        item.qr_code_id === rawValue.trim()
      );
      if (idx >= 0) { foundOrder = order; foundItemIdx = idx; break; }
    }

    if (!foundOrder) {
      setResult({ type: 'error', message: `QR Code não encontrado: ${qrId}` });
      setLoading(false);
      return;
    }

    const item = foundOrder.items[foundItemIdx];

    // If role has no status change (consulta), just show info
    if (!roleAction.toStatus) {
      setResult({
        type: 'info',
        message: `Pedido #${foundOrder.order_number} — ${item.size}`,
        order: foundOrder, item,
      });
      setLoading(false);
      return;
    }

    if ((item.produced || 0) >= item.quantity) {
      setResult({ type: 'warning', message: `Todas as ${item.quantity} treliças "${item.size}" do pedido #${foundOrder.order_number} já foram registradas.`, order: foundOrder, item });
      setLoading(false);
      return;
    }

    // Increment produced
    const updatedItems = [...foundOrder.items];
    updatedItems[foundItemIdx] = { ...item, produced: (item.produced || 0) + 1 };
    const allDone = updatedItems.every(i => (i.produced || 0) >= i.quantity);
    const nextStatus = allDone ? 'secagem' : roleAction.toStatus;

    await base44.entities.Order.update(foundOrder.id, {
      items: updatedItems,
      status: nextStatus,
    });

    await base44.entities.ProductionLog.create({
      order_id: foundOrder.id,
      order_number: foundOrder.order_number,
      item_index: foundItemIdx,
      truss_size: item.size,
      quantity_produced: 1,
      operator_email: user?.email || '',
      operator_name: user?.full_name || '',
      scanned_qr: qrId,
    });

    queryClient.invalidateQueries({ queryKey: ['orders'] });
    const newProduced = (item.produced || 0) + 1;
    setResult({
      type: 'success',
      message: `[${roleAction.logLabel}] "${item.size}" registrada! ${newProduced}/${item.quantity}`,
      order: foundOrder,
      item: { ...item, produced: newProduced },
      allDone,
      nextStatus,
    });
    toast.success(`${roleAction.logLabel} registrada!`);
    setQrInput('');
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleScan = () => processScan(qrInput);
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleScan(); };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scanner QR</h1>
        <p className="text-sm text-muted-foreground">
          Função ativa: <span className="font-semibold text-primary">{roleAction.label}</span>
          {roleAction.toStatus && <span className="ml-1 text-muted-foreground">→ status <strong>{roleAction.toStatus.replace(/_/g, ' ')}</strong></span>}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === 'keyboard' ? 'default' : 'outline'}
          onClick={() => setMode('keyboard')}
          className="flex-1"
        >
          <Keyboard className="w-4 h-4 mr-2" /> Teclado / Leitor
        </Button>
        <Button
          variant={mode === 'camera' ? 'default' : 'outline'}
          onClick={() => setMode('camera')}
          className="flex-1"
        >
          <Camera className="w-4 h-4 mr-2" /> Câmera do Celular
        </Button>
      </div>

      {/* Camera Mode */}
      {mode === 'camera' && (
        <Card className="overflow-hidden">
          {cameraError ? (
            <div className="p-8 text-center space-y-3">
              <CameraOff className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-red-600">{cameraError}</p>
              <Button onClick={startCamera} variant="outline">Tentar novamente</Button>
            </div>
          ) : (
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" style={{ maxHeight: 360, objectFit: 'cover' }} />
              <canvas ref={canvasRef} className="hidden" />
              {/* Scanner overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-4 border-primary rounded-2xl opacity-80 shadow-lg">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
                </div>
              </div>
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  Aponte para o QR Code
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Keyboard Mode */}
      {mode === 'keyboard' && (
        <Card className="p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <ScanLine className="w-10 h-10 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-4">Aponte o leitor de QR Code ou digite o código</p>
            <div className="flex gap-2 max-w-md mx-auto">
              <Input
                ref={inputRef}
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Código QR..."
                className="text-center text-lg font-mono"
                autoFocus
              />
              <Button onClick={handleScan} disabled={loading} className="bg-primary text-primary-foreground px-6">
                {loading ? '...' : 'OK'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className={cn(
          "p-6",
          result.type === 'success' && "border-green-200 bg-green-50",
          result.type === 'error' && "border-red-200 bg-red-50",
          result.type === 'warning' && "border-amber-200 bg-amber-50",
          result.type === 'info' && "border-blue-200 bg-blue-50",
        )}>
          <div className="flex items-start gap-3">
            {result.type === 'success' && <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />}
            {result.type === 'error' && <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />}
            {result.type === 'warning' && <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />}
            {result.type === 'info' && <ScanLine className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.order && (
                <div className="mt-3 text-sm space-y-1">
                  <p><strong>Pedido:</strong> #{result.order.order_number}</p>
                  <p><strong>Cliente:</strong> {result.order.client_name}</p>
                  {result.nextStatus && <p><strong>Novo status:</strong> {result.nextStatus.replace(/_/g, ' ')}</p>}
                  {result.allDone && (
                    <p className="text-green-700 font-semibold mt-2">✅ Todas as treliças produzidas! Pedido avançado.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}