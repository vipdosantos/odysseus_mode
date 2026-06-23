import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ruler, Package, Scissors, CheckCircle, AlertTriangle, Layers, Printer, Pencil, ArrowRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BAR_LENGTH = 12; // Treliça só tem 12 metros
const MIN_SOBRA = 0.5; // Sobras menores que 0.5m são consideradas perda

// Extrai comprimento numérico de um tamanho (ex: "3.5m", "4,00m", "3.5")
function parseLen(sizeStr) {
  const match = sizeStr?.toString().match(/[\d.,]+/);
  return match ? parseFloat(match[0].replace(',', '.')) : null;
}

export default function SobraTrelica() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [editMode, setEditMode] = useState(false);

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

  // Pedidos em corte de vigas
  const corteVigasOrders = orders.filter(o => o.status === 'corte_vigas');

  // Coleta todas as peças individuais de todos os pedidos em corte_vigas
  const allPieces = useMemo(() => {
    const pieces = [];
    corteVigasOrders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!item.size || !item.quantity) return;
        const itemLen = parseLen(item.size);
        if (!itemLen || itemLen <= 0) return;
        for (let i = 0; i < item.quantity; i++) {
          pieces.push({
            orderNumber: order.order_number,
            orderId: order.id,
            size: item.size,
            len: itemLen,
          });
        }
      });
    });
    return pieces;
  }, [corteVigasOrders]);

  // Sobras em estoque (agrupadas por tamanho)
  const sobrasEstoque = useMemo(() => {
    return supplies
      .filter(s => s.name?.toLowerCase().includes('sobra'))
      .map(s => ({ ...s, len: parseLen(s.name) }))
      .filter(s => s.len && s.len > 0 && (s.stock || 0) > 0)
      .sort((a, b) => b.len - a.len);
  }, [supplies]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
  };

  const calcRoteiro = () => {
    // 1. Tenta reaproveitar sobras do estoque primeiro (maior sobra primeiro)
    const stockAvailable = sobrasEstoque.map(s => ({ ...s, available: s.stock || 0 }));
    const usedFromStock = [];
    const piecesToCut = [];

    // Ordena peças por tamanho (menor primeiro) para melhor aproveitamento de sobras
    const sortedPieces = [...allPieces].sort((a, b) => a.len - b.len);

    for (const piece of sortedPieces) {
      // Procura a menor sobra em estoque que sirva para esta peça
      const sobra = stockAvailable.find(s => s.available > 0 && s.len >= piece.len);
      if (sobra) {
        sobra.available--;
        usedFromStock.push({ ...piece, sobraName: sobra.name, sobraId: sobra.id, sobraLen: sobra.len });
      } else {
        piecesToCut.push(piece);
      }
    }

    // 2. Roteiro de corte: First Fit Decreasing (FFD) com barras de 12m
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
        bars.push({
          remaining: parseFloat((BAR_LENGTH - piece.len).toFixed(3)),
          cuts: [piece],
        });
      }
    }

    // 3. Classifica sobras geradas
    const sobrasGeradas = [];
    const perdas = [];

    bars.forEach((bar, idx) => {
      if (bar.remaining >= MIN_SOBRA) {
        sobrasGeradas.push({
          barIndex: idx + 1,
          len: bar.remaining,
          label: `${bar.remaining.toFixed(2)}m`,
        });
      } else if (bar.remaining > 0) {
        perdas.push({ barIndex: idx + 1, len: bar.remaining });
      }
    });

    // Agrupa sobras geradas por tamanho
    const sobrasAgrupadas = {};
    sobrasGeradas.forEach(s => {
      const key = s.label;
      if (!sobrasAgrupadas[key]) {
        sobrasAgrupadas[key] = { ...s, count: 0 };
      }
      sobrasAgrupadas[key].count++;
    });

    setCalcResult({
      orders: corteVigasOrders,
      totalPieces: allPieces.length,
      usedFromStock,
      bars,
      sobrasGeradas: Object.values(sobrasAgrupadas),
      perdas,
      totalBars: bars.length,
      totalWaste: perdas.reduce((sum, p) => sum + p.len, 0),
    });
    setDialogOpen(true);
  };

  const recalcFromBars = (bars) => {
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
      bars: filteredBars,
      sobrasGeradas: Object.values(sobrasAgrupadas),
      perdas,
      totalBars: filteredBars.length,
      totalWaste: perdas.reduce((sum, p) => sum + p.len, 0),
    }));
  };

  const moveCut = (fromBarIdx, cutIdx, toBarIdxStr) => {
    const bars = calcResult.bars.map(b => ({ ...b, cuts: [...b.cuts] }));
    const piece = bars[fromBarIdx].cuts.splice(cutIdx, 1)[0];
    const toBarIdx = parseInt(toBarIdxStr);
    if (toBarIdx === -1) {
      // Remover do plano
      toast.info(`Peça ${piece.size} removida do plano de corte`);
    } else {
      if (toBarIdx >= bars.filter(b => b.cuts.length > 0).length) {
        bars.push({ remaining: BAR_LENGTH, cuts: [] });
      }
      bars[toBarIdx].cuts.push(piece);
    }
    recalcFromBars(bars);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const date = new Date().toLocaleDateString('pt-BR');
    let html = `<html><head><title>Roteiro de Corte</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; margin-bottom: 4px; }
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
      <p style="margin: 0 0 12px; font-size: 13px; color: #666;">Data: ${date} — Barras de ${BAR_LENGTH}m</p>
      <div class="summary">
        <strong>Barras:</strong> ${calcResult.totalBars} |
        <strong>Peças do estoque:</strong> ${calcResult.usedFromStock.length} |
        <strong>Sobras geradas:</strong> ${calcResult.sobrasGeradas.reduce((s,x) => s+x.count, 0)} |
        <strong>Perda:</strong> ${calcResult.totalWaste.toFixed(2)}m
      </div>`;

    calcResult.bars.forEach((bar, idx) => {
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

    if (calcResult.usedFromStock.length > 0) {
      html += `<h2 style="font-size: 16px; margin-top: 20px;">Peças Reaproveitadas do Estoque (${calcResult.usedFromStock.length})</h2><table><thead><tr><th>Peça</th><th>Origem (Sobra)</th><th>Pedido</th></tr></thead><tbody>`;
      calcResult.usedFromStock.forEach(u => {
        html += `<tr><td>${u.size}</td><td>${u.sobraName}</td><td>#${u.orderNumber}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `<div class="no-print" style="margin-top: 20px;"><button onclick="window.print()" style="padding: 10px 20px; background: #f59e0b; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Imprimir</button></div>`;
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const handleApplyToStock = async () => {
    // 1. Reduz sobras usadas do estoque
    const stockUsed = {};
    calcResult.usedFromStock.forEach(u => {
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

    // 2. Adiciona novas sobras geradas ao estoque
    for (const s of calcResult.sobrasGeradas) {
      const label = `Sobra Treliça ${s.label}`;
      const existing = supplies.find(sup =>
        sup.name?.toLowerCase().includes('sobra') &&
        sup.name?.toLowerCase().includes(s.label.toLowerCase())
      );
      if (existing) {
        await updateSupplyMutation.mutateAsync({
          id: existing.id,
          data: { stock: (existing.stock || 0) + s.count },
        });
      } else {
        await createSupplyMutation.mutateAsync({
          name: label,
          code: `SOBRA-${s.label.replace('.', '').replace('m', '')}`,
          unit: 'un',
          stock: s.count,
          min_stock: 0,
          cost_per_unit: 0,
          category: 'outros',
          notes: `Sobra gerada no roteiro de corte`,
        });
      }
    }

    toast.success('Roteiro aplicado! Sobras atualizadas no estoque.');
    setDialogOpen(false);
    setCalcResult(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ruler className="w-6 h-6 text-primary" /> Roteiro de Corte de Treliça
        </h1>
        <p className="text-sm text-muted-foreground">
          Gera o plano de corte das treliças de 12m para os pedidos em "corte de vigas". Sobras aproveitáveis vão para o estoque.
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
                          {item.size} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumo */}
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
                <p className="text-2xl font-bold text-amber-600">{sobrasEstoque.length}</p>
                <p className="text-xs text-muted-foreground">Tamanhos diferentes</p>
              </div>
            </div>

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
                  <p className="font-medium text-sm">{s.name}</p>
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
              <Layers className="w-5 h-5 text-primary" /> Roteiro de Corte
            </DialogTitle>
          </DialogHeader>
          {calcResult && (
            <div className="space-y-4 mt-2">
              {/* Resumo */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-muted/40 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold">{calcResult.totalBars}</p>
                  <p className="text-xs text-muted-foreground">Barras 12m</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{calcResult.usedFromStock.length}</p>
                  <p className="text-xs text-muted-foreground">Do estoque</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-amber-600">{calcResult.sobrasGeradas.reduce((s, x) => s + x.count, 0)}</p>
                  <p className="text-xs text-muted-foreground">Sobras geradas</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-red-500">{calcResult.totalWaste.toFixed(2)}m</p>
                  <p className="text-xs text-muted-foreground">Perda</p>
                </div>
              </div>

              {/* Peças reaproveitadas do estoque */}
              {calcResult.usedFromStock.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-green-800 flex items-center gap-1 mb-2">
                    <CheckCircle className="w-4 h-4" /> {calcResult.usedFromStock.length} peça(s) reaproveitadas do estoque
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {calcResult.usedFromStock.map((u, i) => (
                      <span key={i} className="text-xs bg-white border border-green-300 text-green-700 px-2 py-0.5 rounded-full">
                        {u.size} ← {u.sobraName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Plano de corte por barra */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Plano de Corte ({calcResult.totalBars} barras de 12m)</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditMode(!editMode)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> {editMode ? 'Concluir Edição' : 'Editar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handlePrint}>
                      <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir
                    </Button>
                  </div>
                </div>
                {editMode && (
                  <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                    Modo edição: use o menu de cada peça para movê-la entre barras ou removê-la do plano.
                  </p>
                )}
                <div className="space-y-2">
                  {calcResult.bars.map((bar, idx) => {
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
                        {/* Visual da barra */}
                        <div className="flex h-6 rounded overflow-hidden bg-muted">
                          {bar.cuts.map((c, ci) => (
                            <div
                              key={ci}
                              className="bg-primary flex items-center justify-center text-[10px] text-primary-foreground border-r border-primary-foreground/20"
                              style={{ width: `${(c.len / BAR_LENGTH) * 100}%` }}
                              title={`${c.size} — Pedido #${c.orderNumber}`}
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
                                {c.size} (#{c.orderNumber})
                                <select
                                  className="text-[10px] border-0 bg-transparent cursor-pointer focus:outline-none"
                                  value=""
                                  onChange={(e) => { if (e.target.value !== "") moveCut(idx, ci, e.target.value); }}
                                >
                                  <option value="">Mover para...</option>
                                  {Array.from({ length: calcResult.bars.length }, (_, i) => i).filter(i => i !== idx).map(i => (
                                    <option key={i} value={i}>Barra {i + 1}</option>
                                  ))}
                                  <option value={calcResult.bars.length}>Nova barra</option>
                                  <option value="-1">Remover</option>
                                </select>
                              </span>
                            ) : (
                              <span key={ci} className="text-[10px] text-muted-foreground">
                                {c.size} (#{c.orderNumber}){ci < bar.cuts.length - 1 ? ' ·' : ''}
                              </span>
                            )
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sobras geradas */}
              {calcResult.sobrasGeradas.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-amber-800 mb-2">Sobras aproveitáveis que serão adicionadas ao estoque:</p>
                  <div className="flex flex-wrap gap-2">
                    {calcResult.sobrasGeradas.map((s, i) => (
                      <span key={i} className="text-xs bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded-full font-medium">
                        {s.label} × {s.count} un
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Perdas */}
              {calcResult.totalWaste > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">
                    Perda total: <strong>{calcResult.totalWaste.toFixed(2)}m</strong> (sobras menores que {MIN_SOBRA}m não aproveitadas)
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeDialog}>Fechar</Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
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