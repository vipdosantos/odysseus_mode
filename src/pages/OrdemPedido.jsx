import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, DollarSign, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAYMENT_LABELS = {
  boleto: 'Boleto', pix: 'PIX', transferencia: 'Transferência',
  cartao: 'Cartão', dinheiro: 'Dinheiro', cheque: 'Cheque',
};

const STATUS_COLORS = {
  of_etiquetas: 'bg-gray-400', corte_vigas: 'bg-yellow-400', producao: 'bg-blue-500',
  secagem: 'bg-cyan-500', expedicao: 'bg-orange-400', aguardando_entrega: 'bg-amber-500',
  entrega: 'bg-indigo-500', a_caminho: 'bg-purple-500', recebido: 'bg-teal-500',
  pagamento_pendente: 'bg-red-500', finalizado: 'bg-green-600',
};
const STATUS_LABELS = {
  of_etiquetas: 'OF e Etiquetas', corte_vigas: 'Corte Vigas', producao: 'Produção',
  secagem: 'Secagem', expedicao: 'Expedição', aguardando_entrega: 'Ag. Entrega',
  entrega: 'Entrega', a_caminho: 'A Caminho', recebido: 'Recebido',
  pagamento_pendente: 'Pag. Pendente', finalizado: 'Finalizado',
};

export default function OrdemPedido() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState({
    description: '', supplier: '', amount: 0,
    due_date: '', installments: 1, payment_method: 'boleto', notes: '',
  });
  const [search, setSearch] = useState('');
  const [converting, setConverting] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list('-created_date', 500),
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const openConvert = (order) => {
    setSelectedOrder(order);
    setForm({
      description: `Pedido #${order.order_number} — ${order.client_name}`,
      supplier: order.client_name,
      amount: order.total_value || 0,
      due_date: order.delivery_date || '',
      installments: order.installments || 1,
      payment_method: order.payment_method || 'boleto',
      notes: order.notes || '',
    });
    setDialogOpen(true);
  };

  const handleConvert = async () => {
    setConverting(true);
    const installments = Number(form.installments) || 1;
    const totalAmount = Number(form.amount) || 0;
    const installmentValue = totalAmount / installments;

    for (let i = 0; i < installments; i++) {
      const due = new Date(form.due_date || new Date());
      due.setMonth(due.getMonth() + i);
      await base44.entities.Bill.create({
        description: installments > 1
          ? `${form.description} — Parcela ${i + 1}/${installments}`
          : form.description,
        supplier: form.supplier,
        amount: installmentValue,
        due_date: due.toISOString().slice(0, 10),
        payment_method: form.payment_method,
        status: 'pendente',
        notes: form.notes,
        category: 'outros',
      });
    }
    queryClient.invalidateQueries({ queryKey: ['bills'] });
    toast.success(`${installments} conta(s) a pagar criada(s) com sucesso!`);
    setDialogOpen(false);
    setConverting(false);
  };

  const filtered = orders.filter(o =>
    !search ||
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Check if order already has bills
  const orderBillsMap = {};
  for (const bill of bills) {
    const match = bill.description?.match(/Pedido #([^\s—]+)/);
    if (match) {
      const num = match[1];
      if (!orderBillsMap[num]) orderBillsMap[num] = [];
      orderBillsMap[num].push(bill);
    }
  }

  const totalPending = bills.filter(b => b.status === 'pendente').reduce((s, b) => s + (b.amount || 0), 0);
  const totalPaid = bills.filter(b => b.status === 'pago').reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" /> Ordem de Pedido
          </h1>
          <p className="text-sm text-muted-foreground">Converta pedidos em contas a pagar</p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Buscar pedido..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Pedidos</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Contas Pendentes</p>
          <p className="text-2xl font-bold text-red-600">
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Contas Pagas</p>
          <p className="text-2xl font-bold text-green-600">
            R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Pedido','Cliente','Vendedor','Valor','Entrega','Status','Pagamento','Contas',''].map(h => (
                  <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhum pedido encontrado</td></tr>
              )}
              {filtered.map(order => {
                const linkedBills = orderBillsMap[order.order_number] || [];
                const hasBills = linkedBills.length > 0;
                return (
                  <tr key={order.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-bold text-primary">#{order.order_number}</td>
                    <td className="p-3 font-medium">{order.client_name}</td>
                    <td className="p-3 text-muted-foreground">{order.seller_name || '—'}</td>
                    <td className="p-3 font-semibold">
                      {order.total_value > 0
                        ? `R$ ${order.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {order.delivery_date ? format(parseISO(order.delivery_date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="p-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full text-white font-semibold', STATUS_COLORS[order.status] || 'bg-gray-400')}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {order.payment_method ? PAYMENT_LABELS[order.payment_method] : '—'}
                      {order.installments > 1 && <span className="ml-1 text-xs text-primary font-semibold">{order.installments}x</span>}
                    </td>
                    <td className="p-3">
                      {hasBills ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {linkedBills.length} conta(s)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          Não gerado
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant={hasBills ? 'outline' : 'default'}
                        className={cn('text-xs', !hasBills && 'bg-primary text-primary-foreground')}
                        onClick={() => openConvert(order)}
                      >
                        <DollarSign className="w-3.5 h-3.5 mr-1" />
                        {hasBills ? 'Nova Conta' : 'Gerar Conta'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Convert Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Gerar Conta a Pagar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            <div>
              <Label>De quem (Fornecedor / Cliente)</Label>
              <Input value={form.supplier} onChange={e => f('supplier', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Total (R$)</Label>
                <Input type="number" value={form.amount} onChange={e => f('amount', e.target.value)} />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parcelas do Boleto</Label>
                <Input type="number" min={1} max={24} value={form.installments} onChange={e => f('installments', e.target.value)} />
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={form.payment_method} onValueChange={v => f('payment_method', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.installments > 1 && form.amount > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-primary">
                  {form.installments}x de R$ {(Number(form.amount) / Number(form.installments)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Vencimentos mensais a partir da data informada</p>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConvert} disabled={converting} className="bg-primary text-primary-foreground">
              {converting ? 'Gerando...' : 'Gerar Conta(s) a Pagar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}