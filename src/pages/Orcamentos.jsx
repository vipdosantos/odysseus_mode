import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, FileText, Plus } from 'lucide-react';
import OrderQuoteTab from '@/components/orders/OrderQuoteTab';
import OrcamentoFormDialog from '@/components/orcamentos/OrcamentoFormDialog';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Orcamentos() {
  const [busca, setBusca] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-orcamentos'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const orcamentos = useMemo(
    () => orders.filter(o => o.tipo === 'orcamento'),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return orcamentos;
    return orcamentos.filter(o =>
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.client_name || '').toLowerCase().includes(q)
    );
  }, [orcamentos, busca]);

  const handleSave = (data) => {
    base44.entities.Order.create(data).then(() => {
      queryClient.invalidateQueries({ queryKey: ['orders-orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowForm(false);
      toast.success('Orçamento criado!');
    }).catch(() => toast.error('Erro ao criar orçamento.'));
  };

  const handleConverted = () => {
    setSelected(null);
    queryClient.invalidateQueries({ queryKey: ['orders-orcamentos'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Orçamentos
          </h1>
          <p className="text-sm text-muted-foreground">Crie orçamentos, envie ao cliente e converta em pedido quando aceitar.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Novo Orçamento
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou nº do orçamento..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando orçamentos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum orçamento encontrado. Clique em "Novo Orçamento" para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const totalItems = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            const valor = Number(order.total_value) || 0;
            const signed = !!order.contract_signed_at;
            return (
              <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-sm transition-shadow">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">#{order.order_number}</span>
                    <span className="text-sm text-muted-foreground truncate">{order.client_name}</span>
                    {signed && (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">CONTRATO ASSINADO</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {totalItems} treliça(s) · {order.created_date ? format(new Date(order.created_date), 'dd/MM/yyyy') : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {valor > 0 ? `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </span>
                  <Button size="sm" onClick={() => setSelected(order)}>
                    <FileText className="w-4 h-4 mr-1" /> Abrir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <Dialog open onOpenChange={open => !open && setSelected(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Orçamento #{selected.order_number}</DialogTitle>
            </DialogHeader>
            <OrderQuoteTab order={selected} onConverted={handleConverted} />
          </DialogContent>
        </Dialog>
      )}

      <OrcamentoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSave={handleSave}
      />
    </div>
  );
}