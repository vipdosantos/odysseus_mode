import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Ruler, Package, Scissors, CheckCircle, AlertTriangle, Layers, Printer, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TRUSS_TYPES, FERRO_DIAMETERS, FERRO_LABEL } from '@/lib/trussTypes';

const BAR_LENGTH = 12; // Treliça só tem 12 metros
const MIN_SOBRA = 0.5; // Sobras menores que 0.5m são consideradas perda
const SEM_TIPO = '_semtipo';

function typeLabel(t) {
  return t === SEM_TIPO ? 'Sem tipo' : t;
}

// Extrai comprimento numérico de um tamanho (ex: "3.5m", "4,00m", "3.5")
function parseLen(sizeStr) {
  const match = sizeStr?.toString().match(/[\d.,]+/);
  return match ? parseFloat(match[0].replace(',', '.')) : null;
}

// Executa o plano de corte (FFD) para um conjunto de peças, reaproveitando sobras do mesmo tipo
function calcForType(pieces, stockSobras) {
  const stockAvailable = stockSobras.map(s => ({ ...s, available: s.stock || 0 }));
  const usedFromStock = [];
  const piecesToCut = [];

  const sortedPieces = [...pieces].sort((a, b) => a.len - b.len);
  for (const piece of sortedPieces) {
    const sobra = stockAvailable.find(s => s.available > 0 && s.len >= piece.len);
    if (sobra) {
      sobra.available--;
      usedFromStock.push({ ...piece, sobraName: sobra.name, sobraId: sobra.id, sobraLen: sobra.len });
    } else {
      piecesToCut.push(piece);
    }
  }

  const sortedForCut = [...piecesToCut].sort((a, b) => b.len - a.len);
  const bars = [];
  for (const piece of sortedForCut) {
    let placed = false;
    for (const bar of bars) {
      if (bar.remaining >= piece.len) {
        bar.cuts.push(piece);
        bar.remaining = parseFloat((bar.remaining - piece.len).toFixed(3));
        placed = true;
        break;
      }
    }
    if (!placed) {
      bars.push({ remaining: parseFloat((BAR_LENGTH - piece.len).toFixed(3)), cuts: [piece] });
    }
  }

  const sobrasGeradas = [];
  const perdas = [];
  bars.forEach((bar, idx) => {
    if (bar.remaining >= MIN_SOBRA) {
      sobrasGeradas.push({ barIndex: idx + 1, len: bar.remaining, label: `${bar.remaining.toFixed(2)}m` });
    } else if (bar.remaining > 0) {
      perdas.push({ barIndex: idx + 1, len: bar.remaining });
    }
  });

  const sobrasAgrupadas = {};
  sobrasGeradas.forEach(s => {
    if (!sobrasAgrupadas[s.label]) sobrasAgrupadas[s.label] = { ...s, count: 0 };
    sobrasAgrupadas[s.label].count++;
  });

  return {
    totalPieces: pieces.length,
    usedFromStock,
    bars,
    sobrasGeradas: Object.values(sobrasAgrupadas),
    perdas,
    totalBars: bars.length,
    totalWaste: perdas.reduce((sum, p) => sum + p.len, 0),
  };
}

export default function SobraTrelica() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const [planMode, setPlanMode] = useState('trelica');
  const [activeFerro, setActiveFerro] = useState(null);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list(),
  });

  const updateSupplyMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supply.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplies'] }),
  });

  const createSupplyMutation = useMutation({
    mutationFn: (data) => base44.entities.Supply.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplies'] }),
  });

  const corteVigasOrders = orders.filter(o => o.status === 'corte_vigas');

  // Coleta todas as peças, marcando o tipo de treliça
  const allPieces = useMemo(() => {
    const pieces = [];
    corteVigasOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!item.size || !item.quantity) return;
        const itemLen = parseLen(item.size);
        if (!itemLen || itemLen <= 0) return;
        const trussType = item.truss_type || SEM_TIPO;
        for (let i = 0; i < item.quantity; i++) {
          pieces.push({
            orderNumber: order.order_number,
            orderId: order.id,
            size: item.size,
            len: itemLen,
            trussType,
          });
        }
      });
    });
    return pieces;
  }, [corteVigasOrders]);

  // Coleta as peças de ferros adicionais (por diâmetro), mesma length da treliça
  const allFerroPieces = useMemo(() => {
    const pieces = [];
    corteVigasOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!item.size || !item.quantity) return;
        const itemLen = parseLen(item.size);
        if (!itemLen || itemLen <= 0) return;
        (item.adicionais || []).forEach(adc => {
          const qty = Number(adc.quantity) || 0;
          if (qty <= 0) return;
          for (let i = 0; i < qty; i++) {
            pieces.push({
              orderNumber: order.order_number,
              orderId: order.id,
              size: item.size,
              len: itemLen,
              diametro: adc.diametro,
              kind: 'ferro',
            });
          }
        });
      });
    });
    return pieces;
  }, [corteVigasOrders]);

  const usedTypes = useMemo(() => {
    const types = Array.from(new Set(allPieces.map(p => p.trussType)));
    // ordena tipos conhecidos primeiro, "Sem tipo" por último
    return types.sort((a, b) => {
      if (a === SEM_TIPO) return 1;
      if (b === SEM_TIPO) return -1;
      return TRUSS_TYPES.indexOf(a) - TRUSS_TYPES.indexOf(b);
    });
  }, [allPieces]);

  // Sobras em estoque (apenas as que têm truss_type)
  const sobrasEstoque = useMemo(() => {
    return supplies
      .filter(s => s.name?.toLowerCase().includes('sobra'))
      .map(s => ({ ...s, len: parseLen(s.name), trussType: s.truss_type || SEM_TIPO }))
      .filter(s => s.len && s.len > 0 && (s.stock || 0) > 0)
      .sort((a, b) => b.len - a.len);
  }, [supplies]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setCalcResult(null);
  };

  const calcRoteiro = () => {
    const byType = {};
    TRUSS_TYPES.forEach(type => {
      const piecesOfType = allPieces.filter(p => p.trussType === type);
      const stockOfType = sobrasEstoque.filter(s => s.trussType === type);
      byType[type] = calcForType(piecesOfType, stockOfType);
    });

    const byFerro = {};
    FERRO_DIAMETERS.forEach(f => {
      const piecesOfFerro = allFerroPieces.filter(p => p.diametro === f.code);
      byFerro[f.code] = calcForType(piecesOfFerro, []);
    });

    setCalcResult({ byType, byFerro, trussTypes: TRUSS_TYPES, ferroDiameters: FERRO_DIAMETERS.map(f => f.code) });
    setPlanMode('trelica');
    setActiveType(TRUSS_TYPES[0]);
    setActiveFerro(FERRO_DIAMETERS[0].code);
    setDialogOpen(true);
  };

  const recalcGroup = (kind, key, bars) => {
    bars.forEach(bar => {
      const totalCut = bar.cuts.reduce((sum, c) => sum + c.len, 0);
      bar.remaining = parseFloat((BAR_LENGTH - totalCut).toFixed(3));
    });
    const filteredBars = bars.filter(b => b.cuts.length > 0);

    const sobrasGeradas = [];
    const perdas = [];
    filteredBars.forEach((bar, idx) => {
      if (bar.remaining >= MIN_SOBRA) {
        sobrasGeradas.push({ barIndex: idx + 1, len: bar.remaining, label: `${bar.remaining.toFixed(2)}m` });
      } else if (bar.remaining > 0) {
        perdas.push({ barIndex: idx + 1, len: bar.remaining });
      }
    });

    const sobrasAgrupadas = {};
    sobrasGeradas.forEach(s => {
      if (!sobrasAgrupadas[s.label]) sobrasAgrupadas[s.label] = { ...s, count: 0 };
      sobrasAgrupadas[s.label].count++;
    });

    setCalcResult(prev => ({
      ...prev,
      [kind === 'trelica' ? 'byType' : 'byFerro']: {
        ...prev[kind === 'trelica' ? 'byType' : 'byFerro'],
        [key]: {
          ...prev[kind === 'trelica' ? 'byType' : 'byFerro'][key],
          bars: filteredBars,
          sobrasGeradas: Object.values(sobrasAgrupadas),
          perdas,
          totalBars: filteredBars.length,
          totalWaste: perdas.reduce((sum, p) => sum + p.len, 0),
        },
      },
    }));
  };

  const moveCut = (kind, key, fromBarIdx, cutIdx, toBarIdxStr) => {
    const groupResult = kind === 'trelica' ? calcResult.byType[key] : calcResult.byFerro[key];
    const bars = groupResult.bars.map(b => ({ ...b, cuts: [...b.cuts] }));
    const piece = bars[fromBarIdx].cuts.splice(cutIdx, 1)[0];
    const toBarIdx = parseInt(toBarIdxStr);
    if (toBarIdx === -1) {
      toast.info(`Peça ${piece.size} removida do plano de corte`);
    } else {
      if (toBarIdx >= bars.filter(b => b.cuts.length > 0).length) {
        bars.push({ remaining: BAR_LENGTH, cuts: [] });
      }
      bars[toBarIdx].cuts.push(piece);
    }
    recalcGroup(kind, key, bars);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const date = new Date().toLocaleDateString('pt-BR');
    let html = `<html><head><title>Roteiro de Corte</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; margin-bottom: 4px; }
        h2 { color: #b45309; margin-top: 24px; border-bottom: 2px solid #fbbf24; padding-bottom: 4px; }
        .summary { background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
        .bar { border: 1px solid #999; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
        .bar-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; text-align: left; }
        th { background: #f9fafb; }
        .sobra-badge { color: #92400e; font-weight: bold; }
        .perda-badge { color: #dc2626; font-weight: bold; }
        @media print { .no-print { display: none; } }
      </style>
    </head><body>
      <h1>Roteiro de Corte de Treliça</h1>
      <p style="margin: 0 0 12px; font-size: 13px; color: #666;">Data: ${date} — Barras de ${BAR_LENGTH}m (separado por tipo)</p>`;

    let totalBars = 0, totalStock = 0, totalSobras = 0, totalWaste = 0;
    calcResult.trussTypes.forEach(t => {
      const r = calcResult.byType[t];
      totalBars += r.totalBars;
      totalStock += r.usedFromStock.length;
      totalSobras += r.sobrasGeradas.reduce((s, x) => s + x.count, 0);
      totalWaste += r.totalWaste;
    });
    let ferroBars = 0, ferroWaste = 0, ferroPieces = 0;
    (calcResult.ferroDiameters || []).forEach(d => {
      const r = calcResult.byFerro[d];
      ferroBars += r.totalBars;
      ferroWaste += r.totalWaste;
      ferroPieces += r.totalPieces;
    });
    html += `<div class="summary">
      <strong>Treliças — Barras:</strong> ${totalBars} |
      <strong>Peças do estoque:</strong> ${totalStock} |
      <strong>Sobras geradas:</strong> ${totalSobras} |
      <strong>Perda:</strong> ${totalWaste.toFixed(2)}m
    </div>`;
    if (ferroPieces > 0) {
      html += `<div class="summary" style="margin-top:8px;">
        <strong>Adicionais (Ferros) — Barras:</strong> ${ferroBars} |
        <strong>Peças:</strong> ${ferroPieces} |
        <strong>Perda:</strong> ${ferroWaste.toFixed(2)}m
      </div>`;
    }

    calcResult.trussTypes.forEach(type => {
      const r = calcResult.byType[type];
      html += `<h2>Treliça ${typeLabel(type)} — ${r.totalBars} barras / ${r.totalPieces} peças</h2>`;
      r.bars.forEach((bar, idx) => {
        const isSobra = bar.remaining >= MIN_SOBRA;
        const sobraClass = isSobra ? 'sobra-badge' : 'perda-badge';
        html += `<div class="bar">
          <div class="bar-header">
            <span>Barra ${idx + 1}</span>
            <span class="${sobraClass}">${bar.remaining > 0 ? `Sobra: ${bar.remaining.toFixed(2)}m` : 'Aproveitamento total'}</span>
          </div>
          <table><thead><tr><th>Peça</th><th>Comprimento</th><th>Pedido</th></tr></thead><tbody>`;
        bar.cuts.forEach(c => {
          html += `<tr><td>${c.size}</td><td>${c.len}m</td><td>#${c.orderNumber}</td></tr>`;
        });
        html += `</tbody></table></div>`;
      });

      if (r.usedFromStock.length > 0) {
        html += `<h3 style="font-size:14px;">Reaproveitadas do estoque (${r.usedFromStock.length})</h3><table><thead><tr><th>Peça</th><th>Origem (Sobra)</th><th>Pedido</th></tr></thead><tbody>`;
        r.usedFromStock.forEach(u => {
          html += `<tr><td>${u.size}</td><td>${u.sobraName}</td><td>#${u.orderNumber}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    });

    (calcResult.ferroDiameters || []).forEach(diam => {
      const r = calcResult.byFerro[diam];
      if (r.totalPieces === 0) return;
      html += `<h2 style="color:#1d4ed8;border-bottom-color:#3b82f6;">Ferro ${FERRO_LABEL(diam)} — ${r.totalBars} barras / ${r.totalPieces} peças</h2>`;
      r.bars.forEach((bar, idx) => {
        const isSobra = bar.remaining >= MIN_SOBRA;
        const sobraClass = isSobra ? 'sobra-badge' : 'perda-badge';
        html += `<div class="bar">
          <div class="bar-header">
            <span>Barra ${idx + 1}</span>
            <span class="${sobraClass}">${bar.remaining > 0 ? `Sobra: ${bar.remaining.toFixed(2)}m` : 'Aproveitamento total'}</span>
          </div>
          <table><thead><tr><th>Peça</th><th>Comprimento</th><th>Pedido</th></tr></thead><tbody>`;
        bar.cuts.forEach(c => {
          html += `<tr><td>${c.size} (${FERRO_LABEL(c.diametro)})</td><td>${c.len}m</td><td>#${c.orderNumber}</td></tr>`;
        });
        html += `</tbody></table></div>`;
      });
    });

    html += `<div class="no-print" style="margin-top: 20px;"><button onclick="window.print()" style="padding: 10px 20px; background: #f59e0b; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Imprimir</button></div>`;
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const handleApplyToStock = async () => {
    for (const type of calcResult.trussTypes) {
      const r = calcResult.byType[type];

      // 1. Reduz sobras usadas do estoque
      const stockUsed = {};
      r.usedFromStock.forEach(u => {
        if (!stockUsed[u.sobraId]) stockUsed[u.sobraId] = { id: u.sobraId, name: u.sobraName, count: 0 };
        stockUsed[u.sobraId].count++;
      });
      for (const s of Object.values(stockUsed)) {
        const supply = supplies.find(sup => sup.id === s.id);
        if (supply) {
          await updateSupplyMutation.mutateAsync({
            id: s.id,
            data: { stock: Math.max(0, (supply.stock || 0) - s.count) },
          });
        }
      }

      // 2. Adiciona novas sobras geradas ao estoque (com truss_type)
      for (const s of r.sobrasGeradas) {
        const label = `Sobra ${type !== SEM_TIPO ? type : 'Treliça'} ${s.label}`;
        const existing = supplies.find(sup =>
          sup.name?.toLowerCase().includes('sobra') &&
          sup.name?.toLowerCase().includes(s.label.toLowerCase()) &&
          (sup.truss_type || SEM_TIPO) === type
        );
        if (existing) {
          await updateSupplyMutation.mutateAsync({
            id: existing.id,
            data: { stock: (existing.stock || 0) + s.count },
          });
        } else {
          await createSupplyMutation.mutateAsync({
            name: label,
            code: `SOBRA-${type !== SEM_TIPO ? type : 'TR'}-${s.label.replace('.', '').replace('m', '')}`,
            unit: 'un',
            stock: s.count,
            min_stock: 0,
            cost_per_unit: 0,
            category: 'outros',
            truss_type: type !== SEM_TIPO ? type : undefined,
            notes: `Sobra gerada no roteiro de corte${type !== SEM_TIPO ? ` — treliça ${type}` : ''}`,
          });
        }
      }
    }

    toast.success('Roteiro aplicado! Sobras atualizadas no estoque por tipo.');
    closeDialog();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ruler className="w-6 h-6 text-primary" /> Roteiro de Corte de Treliça
        </h1>
        <p className="text-sm text-muted-foreground">
          Gera o plano de corte das treliças de 12m para os pedidos em "corte de vigas". O roteiro é separado por tipo de treliça (H8, H12, H16, H20, H25, H30) — barras e sobras de um tipo não servem para outro.
        </p>
      </div>

      {/* Pedidos em corte de vigas */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Scissors className="w-4 h-4 text-primary" /> Pedidos Aguardando Corte
          </h3>
          <span className="text-sm text-muted-foreground">{corteVigasOrders.length} pedido(s)</span>
        </div>

        {corteVigasOrders.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">
            Nenhum pedido em "corte de vigas" no momento.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {corteVigasOrders.map(o => {
                const pieces = (o.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
                return (
                  <div key={o.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">#{o.order_number} — {o.client_name}</p>
                      <p className="text-xs text-muted-foreground">{pieces} peça(s)</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {(o.items || []).map((item, i) => (
                        <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {item.truss_type && <span className="font-bold mr-1">{item.truss_type}</span>}
                          {item.size} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumo por tipo */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{allPieces.length}</p>
                <p className="text-xs text-muted-foreground">Peças totais</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {sobrasEstoque.reduce((s, x) => s + x.stock, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Sobras em estoque</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{usedTypes.filter(t => t !== SEM_TIPO).length}</p>
                <p className="text-xs text-muted-foreground">Tipos no corte</p>
              </div>
            </div>

            {/* Lista de tipos presentes */}
            {usedTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {usedTypes.map(t => {
                  const count = allPieces.filter(p => p.trussType === t).length;
                  return (
                    <span key={t} className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium",
                      t === SEM_TIPO ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-700"
                    )}>
                      {typeLabel(t)} · {count} peças
                    </span>
                  );
                })}
              </div>
            )}

            <Button onClick={calcRoteiro} className="w-full bg-primary text-primary-foreground">
              <Scissors className="w-4 h-4 mr-2" /> Gerar Roteiro de Corte
            </Button>
          </>
        )}
      </div>

      {/* Sobras em estoque */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Sobras em Estoque</h3>
        </div>
        <div className="divide-y">
          {sobrasEstoque.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma sobra registrada ainda</p>
          ) : (
            sobrasEstoque.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {s.name}
                    {s.trussType !== SEM_TIPO && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{typeLabel(s.trussType)}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.notes || '—'}</p>
                </div>
                <span className={cn("font-bold text-sm", s.stock > 0 ? "text-green-600" : "text-muted-foreground")}>
                  {s.stock} {s.unit}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dialog roteiro */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Roteiro de Corte por Tipo
            </DialogTitle>
          </DialogHeader>
          {calcResult && calcResult.trussTypes.length > 0 && (
            <div className="space-y-4 mt-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={planMode === 'trelica' ? 'default' : 'outline'}
                  onClick={() => setPlanMode('trelica')}
                  className={planMode === 'trelica' ? 'bg-primary text-primary-foreground' : ''}
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" /> Treliças
                </Button>
                <Button
                  size="sm"
                  variant={planMode === 'ferro' ? 'default' : 'outline'}
                  onClick={() => setPlanMode('ferro')}
                  className={planMode === 'ferro' ? 'bg-blue-600 text-white' : ''}
                >
                  Adicionais (Ferros)
                </Button>
              </div>

              {planMode === 'trelica' ? (
                <>
                  <Tabs value={activeType || calcResult.trussTypes[0]} onValueChange={setActiveType}>
                    <TabsList className="w-full flex-wrap justify-start">
                      {calcResult.trussTypes.map(t => (
                        <TabsTrigger key={t} value={t} className="flex-1">
                          {typeLabel(t)}
                          <span className="ml-1.5 text-[10px] text-muted-foreground">{calcResult.byType[t].totalBars}b</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {calcResult.trussTypes.map(t => {
                      const r = calcResult.byType[t];
                      return (
                        <TabsContent key={t} value={t} className="space-y-4 mt-3">
                          <TypeRoteiro
                            kind="trelica"
                            groupKey={t}
                            groupLabel={typeLabel(t)}
                            result={r}
                            editMode={editMode}
                            moveCut={moveCut}
                          />
                        </TabsContent>
                      );
                    })}
                  </Tabs>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                    Cada tipo de treliça tem seu próprio plano de corte. Barras e sobras de um tipo não são reaproveitadas em outro.
                  </div>
                </>
              ) : (
                <>
                  <Tabs value={activeFerro || (calcResult.ferroDiameters && calcResult.ferroDiameters[0])} onValueChange={setActiveFerro}>
                    <TabsList className="w-full flex-wrap justify-start">
                      {(calcResult.ferroDiameters || []).map(d => (
                        <TabsTrigger key={d} value={d} className="flex-1">
                          {FERRO_LABEL(d)}
                          <span className="ml-1.5 text-[10px] text-muted-foreground">{calcResult.byFerro[d].totalBars}b</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {(calcResult.ferroDiameters || []).map(d => {
                      const r = calcResult.byFerro[d];
                      return (
                        <TabsContent key={d} value={d} className="space-y-4 mt-3">
                          <TypeRoteiro
                            kind="ferro"
                            groupKey={d}
                            groupLabel={FERRO_LABEL(d)}
                            result={r}
                            editMode={editMode}
                            moveCut={moveCut}
                          />
                        </TabsContent>
                      );
                    })}
                  </Tabs>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                    Plano de corte dos ferros adicionais por diâmetro. Cada diâmetro é cortado em barras de 12m separadas.
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeDialog}>Fechar</Button>
            <Button variant="outline" onClick={() => setEditMode(!editMode)}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> {editMode ? 'Concluir Edição' : 'Editar'}
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5 mr-2" /> Imprimir
            </Button>
            <Button onClick={handleApplyToStock} className="bg-primary text-primary-foreground">
              <CheckCircle className="w-4 h-4 mr-2" /> Aplicar e Atualizar Estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypeRoteiro({ kind, groupKey, groupLabel, result, editMode, moveCut }) {
  const { totalBars, totalPieces, usedFromStock, bars, sobrasGeradas, perdas, totalWaste } = result;
  const isFerro = kind === 'ferro';
  const cutLabel = (c) => c.diametro ? `${FERRO_LABEL(c.diametro)} ${c.size}` : c.size;
  if (totalPieces === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Scissors className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma peça de <strong>{groupLabel}</strong> no corte de vigas.</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-muted/40 rounded-lg p-2 text-center">
          <p className="text-lg font-bold">{totalBars}</p>
          <p className="text-xs text-muted-foreground">Barras 12m</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-green-600">{usedFromStock.length}</p>
          <p className="text-xs text-muted-foreground">Do estoque</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-amber-600">{sobrasGeradas.reduce((s, x) => s + x.count, 0)}</p>
          <p className="text-xs text-muted-foreground">Sobras geradas</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-red-500">{totalWaste.toFixed(2)}m</p>
          <p className="text-xs text-muted-foreground">Perda</p>
        </div>
      </div>

      {usedFromStock.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-sm font-semibold text-green-800 flex items-center gap-1 mb-2">
            <CheckCircle className="w-4 h-4" /> {usedFromStock.length} peça(s) reaproveitadas do estoque
          </p>
          <div className="flex flex-wrap gap-1.5">
            {usedFromStock.map((u, i) => (
              <span key={i} className="text-xs bg-white border border-green-300 text-green-700 px-2 py-0.5 rounded-full">
                {u.size} ← {u.sobraName}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">Plano de Corte ({totalBars} barras de 12m)</p>
        {editMode && (
          <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
            Modo edição: use o menu de cada peça para movê-la entre barras ou removê-la do plano.
          </p>
        )}
        <div className="space-y-2">
          {bars.map((bar, idx) => {
            const used = BAR_LENGTH - bar.remaining;
            const usedPct = (used / BAR_LENGTH) * 100;
            const isSobra = bar.remaining >= MIN_SOBRA;
            const isPerda = bar.remaining > 0 && bar.remaining < MIN_SOBRA;
            return (
              <div key={idx} className="border rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Barra {idx + 1}</span>
                  <span className={cn(
                    "font-semibold",
                    isSobra ? "text-amber-600" : isPerda ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {bar.remaining > 0 ? `Sobra: ${bar.remaining.toFixed(2)}m` : 'Aproveitamento total'}
                  </span>
                </div>
                <div className="flex h-6 rounded overflow-hidden bg-muted">
                  {bar.cuts.map((c, ci) => (
                    <div
                      key={ci}
                      className="bg-primary flex items-center justify-center text-[10px] text-primary-foreground border-r border-primary-foreground/20"
                      style={{ width: `${(c.len / BAR_LENGTH) * 100}%` }}
                      title={`${cutLabel(c)} — Pedido #${c.orderNumber}`}
                    >
                      {c.len}m
                    </div>
                  ))}
                  {bar.remaining > 0 && (
                    <div
                      className={cn(
                        "flex items-center justify-center text-[10px] border-r",
                        isSobra ? "bg-amber-200 text-amber-700" : "bg-red-100 text-red-500"
                      )}
                      style={{ width: `${(bar.remaining / BAR_LENGTH) * 100}%` }}
                    >
                      {bar.remaining.toFixed(1)}m
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {bar.cuts.map((c, ci) => (
                    editMode ? (
                      <span key={ci} className="text-[10px] inline-flex items-center gap-1 bg-white border border-input rounded-full pl-2 pr-1 py-0.5">
                        {cutLabel(c)} (#{c.orderNumber})
                        <select
                          className="text-[10px] border-0 bg-transparent cursor-pointer focus:outline-none"
                          value=""
                          onChange={(e) => { if (e.target.value !== "") moveCut(kind, groupKey, idx, ci, e.target.value); }}
                        >
                          <option value="">Mover para...</option>
                          {Array.from({ length: bars.length }, (_, i) => i).filter(i => i !== idx).map(i => (
                            <option key={i} value={i}>Barra {i + 1}</option>
                          ))}
                          <option value={bars.length}>Nova barra</option>
                          <option value="-1">Remover</option>
                        </select>
                      </span>
                    ) : (
                      <span key={ci} className="text-[10px] text-muted-foreground">
                        {cutLabel(c)} (#{c.orderNumber}){ci < bar.cuts.length - 1 ? ' ·' : ''}
                      </span>
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sobrasGeradas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            {isFerro
              ? `Sobras aproveitáveis de ${groupLabel}:`
              : `Sobras aproveitáveis que serão adicionadas ao estoque (${groupLabel === 'Sem tipo' ? 'sem tipo' : groupLabel}):`}
          </p>
          <div className="flex flex-wrap gap-2">
            {sobrasGeradas.map((s, i) => (
              <span key={i} className="text-xs bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded-full font-medium">
                {s.label} × {s.count} un
              </span>
            ))}
          </div>
        </div>
      )}

      {totalWaste > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            Perda total: <strong>{totalWaste.toFixed(2)}m</strong> (sobras menores que {MIN_SOBRA}m não aproveitadas)
          </p>
        </div>
      )}
    </>
  );
}