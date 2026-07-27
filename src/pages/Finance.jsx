import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, DollarSign, Clock, CheckCircle2, AlertTriangle, Trash2, Pencil } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import BillFormDialog from '../components/finance/BillFormDialog';
import TaxDashboard from '../components/finance/TaxDashboard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const statusConfig = {
  pendente: { label: 'Pendente', icon: Clock, class: 'text-amber-600 bg-amber-50' },
  pago: { label: 'Pago', icon: CheckCircle2, class: 'text-green-600 bg-green-50' },
  atrasado: { label: 'Atrasado', icon: AlertTriangle, class: 'text-red-600 bg-red-50' },
  cancelado: { label: 'Cancelado', icon: Clock, class: 'text-gray-400 bg-gray-50' },
};

const categoryLabels = {
  material: 'Material', energia: 'Energia', aluguel: 'Aluguel', salario: 'Salário',
  imposto: 'Imposto', manutencao: 'Manutenção', transporte: 'Transporte', outros: 'Outros',
};

export default function Finance() {
  const { user } = useOutletContext();
  const [showForm, setShowForm] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const queryClient = useQueryClient();

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list('-due_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Bill.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bills'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bill.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bills'] }); setEditBill(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bill.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bills'] }),
  });

  const handleSave = (data) => {
    if (editBill) updateMutation.mutate({ id: editBill.id, data });
    else createMutation.mutate(data);
  };

  const markAsPaid = (bill) => {
    updateMutation.mutate({ id: bill.id, data: { ...bill, status: 'pago' } });
  };

  // Auto-mark overdue
  const processedBills = bills.map(bill => {
    if (bill.status === 'pendente' && bill.due_date && new Date(bill.due_date) < new Date()) {
      return { ...bill, status: 'atrasado' };
    }
    return bill;
  });

  const filtered = processedBills
    .filter(b => tab === 'all' || b.status === tab)
    .filter(b => !search || b.description?.toLowerCase().includes(search.toLowerCase()) || b.supplier?.toLowerCase().includes(search.toLowerCase()));

  const totalPending = processedBills.filter(b => b.status === 'pendente').reduce((s, b) => s + (b.amount || 0), 0);
  const totalOverdue = processedBills.filter(b => b.status === 'atrasado').reduce((s, b) => s + (b.amount || 0), 0);
  const totalPaid = processedBills.filter(b => b.status === 'pago').reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas contas a pagar</p>
        </div>
        <Button onClick={() => { setEditBill(null); setShowForm(true); }} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-1" /> Nova Conta
        </Button>
      </div>

      {/* Dashboard de Impostos */}
      <TaxDashboard bills={bills} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-amber-600 uppercase">Pendente</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-red-600 uppercase">Atrasado</p>
          <p className="text-2xl font-bold text-red-700 mt-1">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-green-600 uppercase">Pago</p>
          <p className="text-2xl font-bold text-green-700 mt-1">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="atrasado">Atrasadas</TabsTrigger>
            <TabsTrigger value="pago">Pagas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
      </div>

      {/* Bills List */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma conta encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Descrição</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Fornecedor</th>
                  <th className="text-left p-3 font-medium">Vencimento</th>
                  <th className="text-left p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(bill => {
                  const st = statusConfig[bill.status] || statusConfig.pendente;
                  const daysUntil = bill.due_date ? differenceInDays(parseISO(bill.due_date), new Date()) : null;
                  return (
                    <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{bill.description}</p>
                        <p className="text-xs text-muted-foreground capitalize">{categoryLabels[bill.category]}</p>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{bill.supplier}</td>
                      <td className="p-3">
                        <p>{bill.due_date ? format(parseISO(bill.due_date), 'dd/MM/yyyy') : '—'}</p>
                        {daysUntil !== null && bill.status === 'pendente' && (
                          <p className={cn("text-xs", daysUntil <= 3 ? "text-red-600 font-medium" : "text-muted-foreground")}>
                            {daysUntil === 0 ? 'Hoje!' : daysUntil === 1 ? 'Amanhã' : daysUntil > 0 ? `Em ${daysUntil} dias` : `${Math.abs(daysUntil)} dias atrás`}
                          </p>
                        )}
                      </td>
                      <td className="p-3 font-semibold">
                        R$ {bill.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <span className={cn("text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1", st.class)}>
                          <st.icon className="w-3 h-3" />
                          {st.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {bill.status !== 'pago' && (
                            <Button variant="ghost" size="sm" onClick={() => markAsPaid(bill)} className="text-green-600 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Pagar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => { setEditBill(bill); setShowForm(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(bill.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
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

      <BillFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        bill={editBill}
        onSave={handleSave}
      />
    </div>
  );
}