import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, CheckCircle2, Clock, AlertTriangle, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

const statusConfig = {
  pendente: { label: 'Pendente', icon: Clock, class: 'text-amber-600 bg-amber-50' },
  recebido: { label: 'Recebido', icon: CheckCircle2, class: 'text-green-600 bg-green-50' },
  atrasado: { label: 'Atrasado', icon: AlertTriangle, class: 'text-red-600 bg-red-50' },
  cancelado: { label: 'Cancelado', icon: Clock, class: 'text-gray-400 bg-gray-50' },
};

const paymentLabels = { boleto:'Boleto', pix:'PIX', transferencia:'Transferência', cartao:'Cartão', dinheiro:'Dinheiro', cheque:'Cheque' };

const emptyForm = { description:'', client_name:'', order_number:'', amount:0, due_date:'', received_date:'', status:'pendente', payment_method:'pix', notes:'' };

export default function Receivables() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.Receivable.list('-due_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Receivable.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['receivables'] }); setDialogOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Receivable.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['receivables'] }); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Receivable.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['receivables'] }),
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const processed = receivables.map(r => {
    if (r.status === 'pendente' && r.due_date && new Date(r.due_date) < new Date()) return { ...r, status: 'atrasado' };
    return r;
  });

  const filtered = processed
    .filter(r => tab === 'all' || r.status === tab)
    .filter(r => !search || r.description?.toLowerCase().includes(search.toLowerCase()) || r.client_name?.toLowerCase().includes(search.toLowerCase()));

  const totalPending = processed.filter(r => r.status === 'pendente').reduce((s, r) => s + (r.amount || 0), 0);
  const totalOverdue = processed.filter(r => r.status === 'atrasado').reduce((s, r) => s + (r.amount || 0), 0);
  const totalReceived = processed.filter(r => r.status === 'recebido').reduce((s, r) => s + (r.amount || 0), 0);

  const markReceived = (r) => updateMutation.mutate({ id: r.id, data: { ...r, status: 'recebido', received_date: new Date().toISOString().split('T')[0] } });

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setDialogOpen(true); };
  const handleSave = () => editing ? updateMutation.mutate({ id: editing.id, data: form }) : createMutation.mutate(form);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><TrendingUp className="w-6 h-6 text-primary" /> Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus recebíveis</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Nova Conta</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-amber-600 uppercase">A Receber</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-red-600 uppercase">Atrasado</p>
          <p className="text-2xl font-bold text-red-700 mt-1">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-green-600 uppercase">Recebido</p>
          <p className="text-2xl font-bold text-green-700 mt-1">R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="atrasado">Atrasadas</TabsTrigger>
            <TabsTrigger value="recebido">Recebidas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground"><TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Nenhuma conta encontrada</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium">Descrição</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Cliente</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Pedido</th>
                  <th className="text-left p-3 font-medium">Vencimento</th>
                  <th className="text-left p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = statusConfig[r.status] || statusConfig.pendente;
                  const daysUntil = r.due_date ? differenceInDays(parseISO(r.due_date), new Date()) : null;
                  return (
                    <tr key={r.id} className="border-t last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <p className="font-medium">{r.description}</p>
                        <p className="text-xs text-muted-foreground">{paymentLabels[r.payment_method] || r.payment_method}</p>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{r.client_name}</td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{r.order_number || '—'}</td>
                      <td className="p-3">
                        <p>{r.due_date ? format(parseISO(r.due_date), 'dd/MM/yyyy') : '—'}</p>
                        {daysUntil !== null && r.status === 'pendente' && (
                          <p className={cn("text-xs", daysUntil <= 3 ? "text-red-600 font-medium" : "text-muted-foreground")}>
                            {daysUntil === 0 ? 'Hoje!' : daysUntil === 1 ? 'Amanhã' : daysUntil > 0 ? `Em ${daysUntil} dias` : `${Math.abs(daysUntil)}d atrás`}
                          </p>
                        )}
                      </td>
                      <td className="p-3 font-semibold">R$ {r.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3">
                        <span className={cn("text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1", st.class)}>
                          <st.icon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.status !== 'recebido' && (
                            <Button variant="ghost" size="sm" onClick={() => markReceived(r)} className="text-green-600 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Receber
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Conta' : 'Nova Conta a Receber'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2"><Label>Descrição</Label><Input value={form.description} onChange={e => f('description', e.target.value)} /></div>
            <div><Label>Cliente</Label><Input value={form.client_name} onChange={e => f('client_name', e.target.value)} /></div>
            <div><Label>Nº do Pedido</Label><Input value={form.order_number} onChange={e => f('order_number', e.target.value)} /></div>
            <div><Label>Valor (R$)</Label><Input type="number" value={form.amount} onChange={e => f('amount', Number(e.target.value))} /></div>
            <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} /></div>
            <div><Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={v => f('payment_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(paymentLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => f('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(statusConfig).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground">{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}