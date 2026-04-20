import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScanLine, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Scanner() {
  const { user } = useOutletContext();
  const [qrInput, setQrInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const handleScan = async () => {
    if (!qrInput.trim()) return;
    setLoading(true);
    setResult(null);

    // Find order and item by QR code
    let foundOrder = null;
    let foundItemIdx = -1;

    for (const order of orders) {
      const idx = order.items?.findIndex(item => item.qr_code_id === qrInput.trim());
      if (idx >= 0) {
        foundOrder = order;
        foundItemIdx = idx;
        break;
      }
    }

    if (!foundOrder) {
      setResult({ type: 'error', message: 'QR Code não encontrado em nenhum pedido.' });
      setLoading(false);
      return;
    }

    const item = foundOrder.items[foundItemIdx];
    if ((item.produced || 0) >= item.quantity) {
      setResult({
        type: 'warning',
        message: `Todas as ${item.quantity} treliças "${item.size}" do pedido #${foundOrder.order_number} já foram produzidas.`,
        order: foundOrder, item
      });
      setLoading(false);
      return;
    }

    // Increment produced count
    const updatedItems = [...foundOrder.items];
    updatedItems[foundItemIdx] = { ...item, produced: (item.produced || 0) + 1 };

    // Check if all items complete
    const allDone = updatedItems.every(i => (i.produced || 0) >= i.quantity);
    const newStatus = allDone ? 'controle_qualidade' : 'em_producao';

    await base44.entities.Order.update(foundOrder.id, {
      items: updatedItems,
      status: foundOrder.status === 'novo' ? 'em_producao' : (allDone ? 'controle_qualidade' : foundOrder.status),
    });

    // Log production
    await base44.entities.ProductionLog.create({
      order_id: foundOrder.id,
      order_number: foundOrder.order_number,
      item_index: foundItemIdx,
      truss_size: item.size,
      quantity_produced: 1,
      operator_email: user?.email || '',
      operator_name: user?.full_name || '',
      scanned_qr: qrInput.trim(),
    });

    queryClient.invalidateQueries({ queryKey: ['orders'] });
    
    const newProduced = (item.produced || 0) + 1;
    setResult({
      type: 'success',
      message: `Treliça "${item.size}" registrada! ${newProduced}/${item.quantity} produzidas.`,
      order: foundOrder, item: { ...item, produced: newProduced },
      allDone,
    });
    
    toast.success('Produção registrada!');
    setQrInput('');
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan();
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scanner de Produção</h1>
        <p className="text-sm text-muted-foreground">Escaneie o QR Code da treliça para registrar a produção</p>
      </div>

      {/* Scanner Input */}
      <Card className="p-8 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <ScanLine className="w-10 h-10 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Aponte o leitor de QR Code ou digite o código manualmente
          </p>
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
              {loading ? 'Buscando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Result */}
      {result && (
        <Card className={cn(
          "p-6",
          result.type === 'success' && "border-green-200 bg-green-50",
          result.type === 'error' && "border-red-200 bg-red-50",
          result.type === 'warning' && "border-amber-200 bg-amber-50",
        )}>
          <div className="flex items-start gap-3">
            {result.type === 'success' && <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />}
            {result.type === 'error' && <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />}
            {result.type === 'warning' && <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.order && (
                <div className="mt-3 text-sm space-y-1">
                  <p><strong>Pedido:</strong> #{result.order.order_number}</p>
                  <p><strong>Cliente:</strong> {result.order.client_name}</p>
                  {result.allDone && (
                    <p className="text-green-700 font-semibold mt-2">
                      ✅ Todas as treliças deste pedido foram produzidas! Pedido movido para Controle de Qualidade.
                    </p>
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