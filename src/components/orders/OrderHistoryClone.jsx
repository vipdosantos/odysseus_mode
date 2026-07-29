import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Copy, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function OrderHistoryClone({ onSelect, currentClientName }) {
  const [search, setSearch] = useState(currentClientName || '');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-clone-history', search],
    queryFn: () => base44.entities.Order.list('-created_date', 80),
  });

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.client_name || '').toLowerCase().includes(q) ||
      (o.order_number || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700">
        <Package className="w-4 h-4 shrink-0" />
        <span>Selecione um pedido anterior para clonar itens, cliente, entrega e pagamento. Será gerado um novo número.</span>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Buscar por cliente ou nº do pedido..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Carregando pedidos...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {filtered.map(o => {
            const totalItems = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            return (
              <div
                key={o.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">#{o.order_number}</span>
                    <span className="text-xs text-muted-foreground truncate">{o.client_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{totalItems} treliça(s)</span>
                    {o.total_value > 0 && <span>· R$ {Number(o.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                    {o.created_date && <span>· {format(parseISO(o.created_date), 'dd/MM/yy')}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(o.items || []).slice(0, 4).map((it, i) => (
                      <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {it.size} ×{it.quantity}
                      </span>
                    ))}
                    {(o.items || []).length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{o.items.length - 4}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelect(o)}
                  className="shrink-0 text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Clonar
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}