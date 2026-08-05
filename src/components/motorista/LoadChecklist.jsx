import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, ClipboardList, RotateCcw, Truck, Camera, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import LoadQRScanner from '@/components/motorista/LoadQRScanner';
import { beep, unlockAudio } from '@/lib/beep';

export default function LoadChecklist({ order }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const items = order.items || [];

  const [loaded, setLoaded] = useState(() => items.map(i => (i.loaded_units || []).slice()));
  const [inputs, setInputs] = useState(() => items.map(() => ''));
  const [alerta, setAlerta] = useState(null);
  const [mode, setMode] = useState('camera'); // 'camera' | 'teclado'
  const inputRefs = useRef([]);

  useEffect(() => {
    setLoaded(items.map(i => (i.loaded_units || []).slice()));
    setInputs(items.map(() => ''));
    setAlerta(null);
  }, [order.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Order.update(order.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });

  const totalUnidades = items.reduce((a, i) => a + (i.quantity || 0), 0);
  const conferidas = loaded.reduce((a, l) => a + l.length, 0);
  const pct = totalUnidades ? Math.round((conferidas / totalUnidades) * 100) : 0;
  const tudoConferido = totalUnidades > 0 && items.every((i, idx) => loaded[idx].length >= (i.quantity || 0));

  const persist = (novaLoaded) => {
    const newItems = items.map((it, idx) => ({ ...it, loaded_units: novaLoaded[idx] }));
    saveMutation.mutate({ items: newItems });
  };

  // Núcleo de conferência — usado pelo teclado e pela câmera QR.
  const markUnit = useCallback((idx, unit, opts = {}) => {
    if (idx < 0 || idx >= items.length) {
      beep('erro');
      setAlerta({ type: 'erro', msg: 'QR não pertence a este pedido.' });
      return;
    }
    const item = items[idx];
    const qtd = Number(item.quantity || 0);
    const label = `${item.truss_type}${item.size ? ' ' + item.size : ''}`;
    if (!unit || unit < 1 || unit > qtd) {
      beep('erro');
      setAlerta({ type: 'erro', msg: `Unidade ${unit} inválida para ${label} (1 a ${qtd}).` });
      return;
    }
    setLoaded(prev => {
      if (prev[idx].includes(unit)) {
        beep('dup');
        setAlerta({ type: 'erro', msg: `Unidade ${unit} de ${label} já foi conferida.` });
        return prev;
      }
      const nova = prev.map((l, j) => (j === idx ? [...l, unit].sort((a, b) => a - b) : l));
      setAlerta({ type: 'ok', msg: `Unidade ${unit} de ${label} conferida (${nova[idx].length}/${qtd}).` });
      beep('ok');
      persist(nova);
      return nova;
    });
    if (opts.keepFocus) setTimeout(() => inputRefs.current[idx]?.focus(), 10);
  }, [items, order.id]);

  // Resolve o conteúdo do QR (mesmo formato das etiquetas do Scanner):
  // { pedido, item_idx, unidade, tamanho, id, qr_code_id }
  const resolveQR = useCallback((raw) => {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* QR antigo/plano */ }
    const unit = parsed?.unidade != null ? Number(parsed.unidade) : null;
    if (parsed?.pedido && parsed.pedido !== order.order_number) {
      beep('erro');
      setAlerta({ type: 'erro', msg: `QR é do pedido #${parsed.pedido}, mas você está conferindo #${order.order_number}.` });
      return;
    }
    let idx = parsed?.item_idx != null ? Number(parsed.item_idx) : -1;
    if (idx < 0 || idx >= items.length) {
      if (parsed?.tamanho) idx = items.findIndex(i => i.size === parsed.tamanho);
      if (idx < 0) {
        const qrId = parsed?.id || parsed?.qr_code_id || raw.trim();
        idx = items.findIndex(i => i.qr_code_id === qrId);
      }
    }
    if (unit == null || idx < 0) {
      beep('erro');
      setAlerta({ type: 'erro', msg: 'QR não reconhecido para este pedido. Verifique a etiqueta.' });
      return;
    }
    markUnit(idx, unit);
  }, [items, order.order_number, markUnit]);

  const handleScan = (idx) => {
    const raw = (inputs[idx] || '').trim();
    if (!raw) return;
    // Bipador/leitor envia o conteúdo completo do QR (JSON); número avulso = unidade manual.
    if (raw.startsWith('{') || isNaN(Number(raw))) {
      unlockAudio();
      resolveQR(raw);
    } else {
      markUnit(idx, Number(raw), { keepFocus: true });
    }
    setInputs(inputs.map((v, j) => (j === idx ? '' : v)));
  };

  const finalizar = () => {
    const missing = items
      .map((it, idx) => {
        const faltam = [];
        for (let u = 1; u <= (it.quantity || 0); u++) if (!loaded[idx].includes(u)) faltam.push(u);
        return { idx, truss_type: it.truss_type, size: it.size, faltam };
      })
      .filter(m => m.faltam.length > 0);

    if (missing.length > 0) {
      beep('erro');
      const totalFaltam = missing.reduce((a, m) => a + m.faltam.length, 0);
      setAlerta({
        type: 'erro',
        msg: `FALTAM ${totalFaltam} unidade(s) não conferidas no caminhão!`,
        missing,
      });
      return;
    }
    beep('sucesso');
    setAlerta({ type: 'ok', msg: 'Carga 100% conferida. Pode seguir viagem!' });
    const newItems = items.map((it, idx) => ({ ...it, loaded_units: loaded[idx] }));
    saveMutation.mutate({
      items: newItems,
      load_conferido: true,
      load_conferido_at: new Date().toISOString(),
      load_conferido_by: user?.full_name || user?.email || '',
    });
  };

  const resetar = () => {
    const vazia = items.map(() => []);
    setLoaded(vazia);
    setInputs(items.map(() => ''));
    setAlerta(null);
    saveMutation.mutate({ items: items.map(it => ({ ...it, loaded_units: [] })), load_conferido: false });
    inputRefs.current[0]?.focus();
  };

  if (!items.length) return null;

  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" /> Conferência de Carga do Caminhão
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
            tudoConferido ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
            {conferidas}/{totalUnidades}
          </span>
          {order.load_conferido && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Conferido
            </span>
          )}
        </div>
      </div>

      {/* Progresso */}
      <div className="px-4 pt-3">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", tudoConferido ? "bg-green-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Modo de bipagem: câmera (QR) ou teclado */}
      <div className="px-4 pt-3 flex gap-2">
        <button
          onClick={() => setMode('camera')}
          className={cn("flex-1 flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors",
            mode === 'camera' ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
        >
          <Camera className="w-4 h-4" /> Câmera QR
        </button>
        <button
          onClick={() => setMode('teclado')}
          className={cn("flex-1 flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors",
            mode === 'teclado' ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
        >
          <Keyboard className="w-4 h-4" /> Teclado
        </button>
      </div>

      {mode === 'camera' && (
        <div className="px-4 pt-3">
          <LoadQRScanner active={mode === 'camera'} onDetect={resolveQR} />
        </div>
      )}

      {/* Alerta visual */}
      {alerta && (
        <div className={cn("mx-4 mt-3 p-3 rounded-xl border flex items-start gap-2 animate-in fade-in",
          alerta.type === 'erro' ? "bg-red-50 border-red-300 text-red-800" : "bg-green-50 border-green-300 text-green-800")}>
          {alerta.type === 'erro' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <div className="flex-1 text-sm">
            <p className="font-semibold">{alerta.msg}</p>
            {alerta.missing && (
              <ul className="mt-1 space-y-0.5">
                {alerta.missing.map(m => (
                  <li key={m.idx}>
                    {m.truss_type}{m.size ? ' ' + m.size : ''}: faltam {m.faltam.join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Itens / bipagem */}
      <div className="p-4 space-y-3">
        {items.map((item, idx) => {
          const qtd = Number(item.quantity || 0);
          const done = loaded[idx].length >= qtd;
          const label = `${item.truss_type}${item.size ? ' ' + item.size : ''}`;
          return (
            <div key={idx} className={cn("rounded-xl border p-3", done ? "border-green-300 bg-green-50/40" : "border-border")}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">Qtd: {qtd}</span>
                </div>
                <span className={cn("text-xs font-semibold", done ? "text-green-600" : "text-muted-foreground")}>
                  {loaded[idx].length}/{qtd}
                </span>
              </div>

              <div className="flex gap-2 mt-2">
                <Input
                  ref={el => (inputRefs.current[idx] = el)}
                  value={inputs[idx] || ''}
                  onChange={e => setInputs(inputs.map((v, j) => (j === idx ? e.target.value : v)))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleScan(idx); } }}
                  placeholder={done ? 'Conferido' : 'Bipar unidade (1 a ' + qtd + ')'}
                  disabled={done}
                  className="h-9"
                  inputMode="numeric"
                />
                <Button
                  size="sm"
                  variant={done ? 'secondary' : 'default'}
                  disabled={done}
                  onClick={() => handleScan(idx)}
                >
                  Biper
                </Button>
              </div>

              {/* Slots de unidades */}
              <div className="flex flex-wrap gap-1 mt-2">
                {Array.from({ length: qtd }, (_, u) => u + 1).map(u => {
                  const ok = loaded[idx].includes(u);
                  return (
                    <span key={u} className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold border",
                      ok ? "bg-green-500 text-white border-green-500" : "bg-muted/40 text-muted-foreground border-dashed border-muted-foreground/30"
                    )}>
                      {ok ? '✓' : u}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex gap-2 pt-1">
          <Button onClick={finalizar} className="flex-1 bg-primary text-primary-foreground">
            <CheckCircle2 className="w-4 h-4" /> Finalizar Conferência
          </Button>
          <Button variant="outline" onClick={resetar}>
            <RotateCcw className="w-4 h-4" /> Reiniciar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ClipboardList className="w-3 h-3" /> Bipar todas as treliças ao subir no caminhão. Se faltar algo, soará um alarme e mostrará o que falta.
        </p>
      </div>
    </div>
  );
}