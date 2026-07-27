import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanLine, CheckCircle2, AlertCircle, Camera, CameraOff, Keyboard, Truck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Scanner() {
  const { user } = useOutletContext();
  const [qrInput, setQrInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('keyboard'); // 'keyboard' | 'camera'
  const [activeStage, setActiveStage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const { data: kanbanColumns = [] } = useQuery({
    queryKey: ['kanban-columns'],
    queryFn: () => base44.entities.KanbanColumn.list('order', 50),
  });

  // Resolve which stage(s) this user is responsible for (set by the admin, multiple allowed).
  const role = user?.role || 'visualizador';
  const userStages = Array.isArray(user?.assigned_stages) && user.assigned_stages.length
    ? user.assigned_stages
    : (user?.assigned_stage ? [user.assigned_stage] : []);
  const availableStages = userStages.length
    ? userStages
    : (role === 'admin' ? kanbanColumns.map(c => c.key) : (role === 'operador' ? ['producao'] : []));
  useEffect(() => {
    if (!availableStages.includes(activeStage)) setActiveStage(availableStages[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableStages.join('|')]);
  const stageKey = availableStages.includes(activeStage) ? activeStage : (availableStages[0] || '');
  const isDelivery = stageKey === 'entrega';
  const stageLabel = kanbanColumns.find(c => c.key === stageKey)?.label
    || (stageKey ? stageKey.replace(/_/g, ' ') : 'Consulta');
  const canScan = !!stageKey;

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

      if (jsQRRef.current) {
        const code = jsQRRef.current(imageData.data, w, h);
        if (code?.data && code.data !== lastScanned.current) {
          lastScanned.current = code.data;
          setTimeout(() => { lastScanned.current = ''; }, 3000);
          processScan(code.data);
          return;
        }
      }

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

  const resolveOrderItem = (rawValue) => {
    let qrId = rawValue.trim();
    let parsed = null;
    try { parsed = JSON.parse(rawValue); } catch (_) {}
    const unitNum = parsed?.unidade != null ? Number(parsed.unidade) : null;
    const itemIdxFromQR = parsed?.item_idx != null ? Number(parsed.item_idx) : null;
    qrId = parsed?.id || parsed?.qr_code_id || rawValue.trim();

    let foundOrder = null;
    let foundItemIdx = -1;

    if (parsed && parsed.pedido) {
      foundOrder = orders.find(o => o.order_number === parsed.pedido) || null;
      if (foundOrder && itemIdxFromQR != null && foundOrder.items?.[itemIdxFromQR]) {
        foundItemIdx = itemIdxFromQR;
      } else if (foundOrder && parsed.tamanho) {
        foundItemIdx = foundOrder.items?.findIndex(i => i.size === parsed.tamanho) ?? -1;
      }
    }

    if (!foundOrder) {
      for (const order of orders) {
        const idx = order.items?.findIndex(item =>
          item.qr_code_id === qrId || item.qr_code_id === rawValue.trim()
        );
        if (idx >= 0) { foundOrder = order; foundItemIdx = idx; break; }
      }
    }

    return { foundOrder, foundItemIdx, unitNum, qrId };
  };

  // Next Kanban column after a given stage key (by order)
  const nextColumnKey = (key) => {
    const sorted = [...kanbanColumns].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex(c => c.key === key);
    if (idx < 0) return null;
    return sorted[idx + 1]?.key || null;
  };

  // Units already conferidas for a given stage on an item (legacy-aware)
  const stageUnits = (item, stage) => {
    const sc = item.stage_conferencias || {};
    if (Array.isArray(sc[stage])) return sc[stage];
    if (stage === 'producao' && Array.isArray(item.scanned_units)) return item.scanned_units;
    if (stage === 'entrega' && Array.isArray(item.delivered_units)) return item.delivered_units;
    return [];
  };

  // --- Unified stage conference (works for any Kanban stage) ---
  const processStage = async (foundOrder, foundItemIdx, unitNum, qrId) => {
    const stage = stageKey;
    const item = foundOrder.items[foundItemIdx];

    if (unitNum == null) {
      setResult({ type: 'error', message: 'Este QR não tem número de unidade. Use etiquetas com unidade para a conferência.' });
      setLoading(false);
      return;
    }
    if (unitNum < 1 || unitNum > (item.quantity || 0)) {
      setResult({ type: 'error', message: `Unidade ${unitNum} inválida para "${item.size}" (qtd ${item.quantity}).` });
      setLoading(false);
      return;
    }

    const current = [...stageUnits(item, stage)];
    if (current.includes(unitNum)) {
      setResult({
        type: 'warning',
        message: `Unidade ${unitNum}/${item.quantity} de "${item.size}" (pedido #${foundOrder.order_number}) JÁ foi conferida em "${stageLabel}". Etiqueta duplicada — não contada.`,
        order: foundOrder, item,
      });
      setLoading(false);
      setQrInput('');
      inputRef.current?.focus();
      return;
    }
    current.push(unitNum);

    const updatedItems = foundOrder.items.map((it, i) => {
      if (i !== foundItemIdx) return it;
      const sc = { ...(it.stage_conferencias || {}) };
      sc[stage] = current;
      const newItem = { ...it, stage_conferencias: sc };
      if (stage === 'producao') { newItem.scanned_units = current; newItem.produced = current.length; }
      if (stage === 'entrega') { newItem.delivered_units = current; }
      return newItem;
    });

    const allDone = updatedItems.every(i => stageUnits(i, stage).length >= (i.quantity || 0));
    const updateData = { items: updatedItems };

    if (stage === 'entrega' && allDone) {
      updateData.delivery_conferido = true;
      updateData.delivery_conferido_at = new Date().toISOString();
      updateData.delivery_conferido_by = user?.full_name || user?.email || '';
    }

    if (allDone) {
      updateData.status = stage === 'entrega' ? (nextColumnKey('entrega') || 'recebido') : (nextColumnKey(stage) || stage);
    } else {
      updateData.status = stage;
    }

    await base44.entities.Order.update(foundOrder.id, updateData);
    queryClient.invalidateQueries({ queryKey: ['orders'] });

    if (stage === 'producao') {
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
    }

    const breakdown = updatedItems.map(i => {
      const del = stageUnits(i, stage);
      const missing = i.quantity > 0
        ? Array.from({ length: i.quantity }, (_, u) => u + 1).filter(n => !del.includes(n))
        : [];
      return { size: i.size, expected: i.quantity, delivered: del.length, missing };
    });
    const totalMissing = breakdown.reduce((s, b) => s + b.missing.length, 0);
    const nextStatus = updateData.status;

    setResult({
      type: allDone ? 'success' : (totalMissing > 0 ? 'warning' : 'success'),
      message: `[${stageLabel}] "${item.size}" — unidade ${unitNum} conferida!`,
      order: { ...foundOrder, items: updatedItems },
      conference: breakdown,
      allDone,
      totalMissing,
      nextStatus,
    });
    // Auto-advance to the next stage so the operator keeps conferencing
    // the same labels there — otherwise the duplicate warning fires cross-stage.
    if (allDone) {
      const next = nextColumnKey(stage);
      if (next && availableStages.includes(next)) setActiveStage(next);
    }
    toast.success(allDone ? `Conferência de "${stageLabel}" completa!` : 'Unidade conferida');
    setQrInput('');
    setLoading(false);
    inputRef.current?.focus();
  };

  // --- Admin: clear bipped labels for the active stage on an order ---
  const clearScans = async (order) => {
    const stage = stageKey;
    const updatedItems = order.items.map(it => {
      const sc = { ...(it.stage_conferencias || {}) };
      delete sc[stage];
      const newItem = { ...it, stage_conferencias: sc };
      if (stage === 'producao') { newItem.scanned_units = []; newItem.produced = 0; }
      if (stage === 'entrega') { newItem.delivered_units = []; }
      return newItem;
    });
    const updateData = { items: updatedItems, status: stage };
    if (stage === 'entrega') {
      updateData.delivery_conferido = false;
      updateData.delivery_conferido_at = '';
      updateData.delivery_conferido_by = '';
    }
    await base44.entities.Order.update(order.id, updateData);
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    toast.success(`Bipagens de "${stageLabel}" excluídas.`);
    setResult(null);
  };

  const processScan = async (rawValue) => {
    setLoading(true);
    setResult(null);

    const { foundOrder, foundItemIdx, unitNum, qrId } = resolveOrderItem(rawValue);

    if (!foundOrder || foundItemIdx < 0) {
      setResult({ type: 'error', message: `QR Code não encontrado: ${qrId}` });
      setLoading(false);
      return;
    }

    // Consulta (no stage assigned)
    if (!canScan) {
      const item = foundOrder.items[foundItemIdx];
      setResult({
        type: 'info',
        message: `Pedido #${foundOrder.order_number} — ${item.size}`,
        order: foundOrder, item,
      });
      setLoading(false);
      return;
    }

    await processStage(foundOrder, foundItemIdx, unitNum, qrId);
  };

  const handleScan = () => processScan(qrInput);
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleScan(); };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scanner QR</h1>
        <p className="text-sm text-muted-foreground">
          Responsável pela etapa:{' '}
          <span className="font-semibold text-primary">{stageLabel}</span>
          {isDelivery && <span className="ml-2 text-violet-600 font-medium">— Conferência de Entrega</span>}
          {!canScan && <span className="ml-1 text-muted-foreground">(somente consulta)</span>}
          {canScan && !isDelivery && <span className="ml-1 text-muted-foreground">→ status <strong>{stageLabel}</strong></span>}
        </p>
        {availableStages.length > 1 && (
          <Select value={stageKey} onValueChange={setActiveStage}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableStages.map(k => (
                <SelectItem key={k} value={k}>
                  {kanbanColumns.find(c => c.key === k)?.label || k.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isDelivery && (
        <Card className="p-4 border-violet-200 bg-violet-50 flex items-start gap-3">
          <Truck className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
          <p className="text-sm text-violet-800">
            Modo conferência de entrega: bipar cada treliça ao descarregar no cliente.
            O sistema compara com o pedido e aponta o que estiver faltando.
          </p>
        </Card>
      )}

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
            <div className="flex-1">
              <p className="font-medium">{result.message}</p>
              {result.order && (
                <div className="mt-3 text-sm space-y-1">
                  <p><strong>Pedido:</strong> #{result.order.order_number}</p>
                  <p><strong>Cliente:</strong> {result.order.client_name}</p>
                  {result.nextStatus && <p><strong>Novo status:</strong> {result.nextStatus.replace(/_/g, ' ')}</p>}
                </div>
              )}

              {role === 'admin' && result.order && canScan && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => clearScans(result.order)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir bipagens de "{stageLabel}"
                </Button>
              )}

              {/* Always-on conference breakdown for the active stage */}
              {result.order && canScan && (() => {
                const breakdown = (result.order.items || []).map(i => {
                  const sc = i.stage_conferencias || {};
                  let bipped = Array.isArray(sc[stageKey]) ? sc[stageKey]
                    : (stageKey === 'producao' && Array.isArray(i.scanned_units) ? i.scanned_units
                    : (stageKey === 'entrega' && Array.isArray(i.delivered_units) ? i.delivered_units : []));
                  bipped = [...bipped].sort((a, b) => a - b);
                  const q = i.quantity || 0;
                  const missing = q > 0 ? Array.from({ length: q }, (_, u) => u + 1).filter(n => !bipped.includes(n)) : [];
                  return { size: i.size, expected: q, bipped, missing };
                });
                const totalMissing = breakdown.reduce((s, b) => s + b.missing.length, 0);
                const allDone = totalMissing === 0;
                return (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conferência — {stageLabel}</p>
                    {breakdown.map((b, idx) => (
                      <div key={idx} className={cn(
                        "rounded-lg border p-2 text-sm",
                        b.missing.length === 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{b.size}</span>
                          <span className={cn("text-xs font-semibold", b.missing.length === 0 ? "text-green-700" : "text-amber-700")}>
                            {b.bipped.length}/{b.expected}
                          </span>
                        </div>
                        <p className="text-xs text-green-700 mt-1">✓ Bipadas: {b.bipped.length ? b.bipped.join(', ') : '—'}</p>
                        {b.missing.length > 0 ? (
                          <p className="text-xs text-amber-700">⚠ Faltam: {b.missing.join(', ')}</p>
                        ) : (
                          <p className="text-xs text-green-700">Completo</p>
                        )}
                      </div>
                    ))}
                    {allDone ? (
                      <p className="text-green-700 font-semibold">✅ Conferência completa — nenhuma treliça faltando!</p>
                    ) : (
                      <p className="text-amber-700 font-semibold">⚠️ Faltam {totalMissing} treliça(s) no total.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}