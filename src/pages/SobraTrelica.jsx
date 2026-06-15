import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ruler, Plus, Package, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Comprimentos padrão de treliça vindos de fábrica (metros)
const FACTORY_LENGTHS = [6, 7, 8, 9, 10, 11, 12];

export default function SobraTrelica() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [factoryLength, setFactoryLength] = useState('6');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [calcResult, setCalcResult] = useState(null);

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

  // Pedidos com itens de treliça
  const ordersWithTrelica = orders.filter(o =>
    o.items?.some(i => i.size && i.quantity > 0)
  );

  const calcSobra = () => {
    if (!selectedOrder) return;
    const length = parseFloat(factoryLength);
    const results = [];

    (selectedOrder.items || []).forEach(item => {
      if (!item.size || !item.quantity) return;
      // Extrai tamanho do item (ex: "3.5m", "4.00m", "3,5")
      const match = item.size.toString().match(/[\d.,]+/);
      const itemLen = match ? parseFloat(match[0].replace(',', '.')) : null;
      if (!itemLen || itemLen <= 0) return;

      const qty = item.quantity;

      // Verifica sobras desse tamanho já em estoque
      const sobraSize = `${(length - itemLen).toFixed(2)}m`;
      const estoqueExistente = supplies.find(s =>
        s.name?.toLowerCase().includes('sobra') &&
        s.name?.toLowerCase().includes(sobraSize.toLowerCase())
      );
      const sobraEmEstoque = estoqueExistente ? (estoqueExistente.stock || 0) : 0;

      // Quantas peças podem ser aproveitadas do estoque
      const piecesFromStock = Math.min(sobraEmEstoque, qty);
      // Quantidades que ainda precisam vir de barras novas
      const qtyRemaining = qty - piecesFromStock;

      const piecesNeeded = qtyRemaining > 0 ? Math.ceil((itemLen * qtyRemaining) / length) : 0;
      const totalBought = piecesNeeded * length;
      const totalUsed = itemLen * qtyRemaining;
      const sobra = parseFloat((totalBought - totalUsed).toFixed(3));

      results.push({
        size: item.size,
        quantity: qty,
        itemLen,
        factoryLength: length,
        piecesFromStock,
        sobraEmEstoque,
        piecesNeeded,
        totalUsed,
        sobra,
        sobraSize: sobra > 0.1 ? `${sobra.toFixed(2)}m` : null,
      });
    });

    setCalcResult({ order: selectedOrder, results, factoryLength: length });
    setDialogOpen(true);
  };

  const handleAddToStock = async () => {
    for (const r of calcResult.results) {
      if (!r.sobraSize || r.sobra <= 0) continue;
      const label = `Sobra Treliça ${r.sobraSize}`;
      const existing = supplies.find(s =>
        s.name?.toLowerCase().includes(`sobra`) &&
        s.name?.toLowerCase().includes(r.sobraSize.toLowerCase())
      );
      if (existing) {
        await updateSupplyMutation.mutateAsync({
          id: existing.id,
          data: { stock: (existing.stock || 0) + r.piecesNeeded },
        });
      } else {
        await createSupplyMutation.mutateAsync({
          name: label,
          code: `SOBRA-${r.sobraSize.replace('.', '').replace('m', '')}`,
          unit: 'un',
          stock: r.piecesNeeded,
          min_stock: 0,
          cost_per_unit: 0,
          category: 'outros',
          notes: `Sobra gerada do pedido #${calcResult.order.order_number}`,
        });
      }
    }
    toast.success('Sobras adicionadas ao estoque!');
    setDialogOpen(false);
    setCalcResult(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ruler className="w-6 h-6 text-primary" /> Controle de Sobra de Treliça
        </h1>
        <p className="text-sm text-muted-foreground">Calcule a sobra de treliça por pedido e registre no estoque</p>
      </div>

      {/* Configuração */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold">Selecione o Pedido e o Tamanho de Fábrica</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Pedido</label>
            <Select value={selectedOrder?.id || ''} onValueChange={v => setSelectedOrder(orders.find(o => o.id === v) || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um pedido..." />
              </SelectTrigger>
              <SelectContent>
                {ordersWithTrelica.map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    #{o.order_number} — {o.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Comprimento da Treliça de Fábrica (m)</label>
            <Select value={factoryLength} onValueChange={setFactoryLength}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FACTORY_LENGTHS.map(l => (
                  <SelectItem key={l} value={String(l)}>{l} metros</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedOrder && (
          <div className="bg-muted/40 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold">Itens do Pedido #{selectedOrder.order_number}</p>
            <div className="flex flex-wrap gap-2">
              {(selectedOrder.items || []).map((item, i) => (
                <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {item.size} × {item.quantity} un
                </span>
              ))}
            </div>
          </div>
        )}

        <Button onClick={calcSobra} disabled={!selectedOrder} className="bg-primary text-primary-foreground">
          <Ruler className="w-4 h-4 mr-2" /> Calcular Sobra
        </Button>
      </div>

      {/* Histórico de sobras no estoque */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Sobras em Estoque</h3>
        </div>
        <div className="divide-y">
          {supplies.filter(s => s.name?.toLowerCase().includes('sobra')).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma sobra registrada ainda</p>
          ) : (
            supplies.filter(s => s.name?.toLowerCase().includes('sobra')).map(s => (
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

      {/* Dialog resultado */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado do Cálculo de Sobra</DialogTitle>
          </DialogHeader>
          {calcResult && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Pedido <strong>#{calcResult.order.order_number}</strong> — Treliça de fábrica: <strong>{calcResult.factoryLength}m</strong>
              </p>
              <div className="space-y-3">
                {calcResult.results.map((r, i) => (
                  <div key={i} className="border rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{r.size} × {r.quantity} un</p>
                      {r.sobraSize ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">Sobra: {r.sobraSize}</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Sem sobra</span>
                      )}
                    </div>
                    {r.piecesFromStock > 0 && (
                      <div className="text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-green-700">
                        ✓ {r.piecesFromStock} un aproveitadas do estoque (sobras existentes)
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div><p className="font-medium text-foreground">{r.piecesNeeded}</p><p>Barras novas</p></div>
                      <div><p className="font-medium text-foreground">{r.totalUsed.toFixed(2)}m</p><p>Total consumido</p></div>
                      <div><p className="font-medium text-amber-600">{r.sobra.toFixed(2)}m × {r.piecesNeeded}</p><p>Sobra gerada</p></div>
                    </div>
                  </div>
                ))}
              </div>
              {calcResult.results.some(r => r.sobraSize) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  As sobras serão adicionadas ao estoque como insumos separados por tamanho.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Fechar</Button>
            {calcResult?.results.some(r => r.sobraSize) && (
              <Button onClick={handleAddToStock} className="bg-primary text-primary-foreground">
                <Package className="w-4 h-4 mr-2" /> Adicionar Sobras ao Estoque
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}