import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShoppingBag, Plus, Trash2, Search, Clock, CheckCircle2, XCircle, PackageCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAYMENT_LABELS = {
  boleto: 'Boleto', pix: 'PIX', transferencia: 'Transferência',
  cartao: 'Cartão', dinheiro: 'Dinheiro', cheque: 'Cheque',
};

const STATUS_CONFIG = {
  rascunho:             { label: 'Rascunho',       color: 'bg-gray-400' },
  aguardando_aprovacao: { label: 'Ag. Aprovação',  color: 'bg-yellow-500' },
  aprovado:             { label: 'Aprovado',        color: 'bg-green-600' },
  rejeitado:            { label: 'Rejeitado',       color: 'bg-red-500' },
  pago:                 { label: 'Pago',            color: 'bg-blue-600' },
};

const emptyItem = { nome: '', quantidade: 1, unidade: 'un', valor_unit: 0 };
const emptyForm = {
  descricao: '', fornecedor: '', valor_total: 0,
  data_entrega: '', parcelas: 1, forma_pagamento: 'boleto',
  status: 'aguardando_aprovacao', notas: '', itens: [], tipo: 'insumo',
};

export default function OrdemPedido() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordens_compra'],
    queryFn: () => base44.entities.OrdemCompra.list('-created_date', 500),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'financeiro';

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OrdemCompra.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_compra'] });
      setDialogOpen(false);
      toast.success('Ordem de compra enviada para aprovação!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemCompra.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_compra'] });
      setDialogOpen(false);
      toast.success('Ordem atualizada!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OrdemCompra.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordens_compra'] }),
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addItem = () => setForm(prev => ({ ...prev, itens: [...(prev.itens || []), { ...emptyItem }] }));
  const updateItem = (i, k, v) => setForm(prev => {
    const itens = [...prev.itens];
    itens[i] = { ...itens[i], [k]: v };
    return { ...prev, itens };
  });
  const removeItem = (i) => setForm(prev => ({ ...prev, itens: prev.itens.filter((_, idx) => idx !== i) }));

  const calcTotal = form.itens?.length > 0
    ? form.itens.reduce((s, i) => s + (Number(i.quantidade || 0) * Number(i.valor_unit || 0)), 0)
    : Number(form.valor_total || 0);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (o) => {
    setEditing(o);
    setForm({ ...o });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.descricao.trim()) { toast.error('Informe a descrição da ordem.'); return; }
    const totalCalc = form.itens?.length > 0
      ? form.itens.reduce((s, i) => s + (Number(i.quantidade) * Number(i.valor_unit)), 0)
      : Number(form.valor_total);
    const data = { ...form, valor_total: totalCalc, tipo: 'insumo' };
    editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data);
  };

  const filtered = ordens.filter(o => {
    const matchSearch = !search ||
      o.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      o.fornecedor?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const totals = {
    total: ordens.length,
    pendentes: ordens.filter(o => o.status === 'aguardando_aprovacao').length,
    aprovadas: ordens.filter(o => o.status === 'aprovado').length,
    rejeitadas: ordens.filter(o => o.status === 'rejeitado').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" /> Ordem de Compras
          </h1>
          <p className="text-sm text-muted-foreground">Solicite compras de insumos e materiais para aprovação</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Nova Ordem de Compra
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: totals.total, color: '' },
          { label: 'Ag. Aprovação', value: totals.pendentes, color: 'text-yellow-600' },
          { label: 'Aprovadas', value: totals.aprovadas, color: 'text-green-600' },
          { label: 'Rejeitadas', value: totals.rejeitadas, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-2xl p-3 md:p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-xl md:text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por descrição ou fornecedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma ordem de compra encontrada</p>
          </div>
        )}
        {filtered.map(o => {
          const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.rascunho;
          const expanded = expandedId === o.id;
          return (
            <div key={o.id} className={cn('bg-card border rounded-2xl overflow-hidden', o.status === 'rejeitado' && 'opacity-60')}>
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold">{o.descricao}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full text-white font-semibold', sc.color)}>{sc.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {o.fornecedor && <span>{o.fornecedor} · </span>}
                    <span className="font-semibold text-foreground">R$ {(o.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    {o.parcelas > 1 && <span className="text-primary font-semibold ml-1">{o.parcelas}x</span>}
                    {o.data_entrega && <span className="ml-2">· {format(parseISO(o.data_entrega), 'dd/MM/yyyy')}</span>}
                  </p>
                  {o.status === 'rejeitado' && o.rejeitado_motivo && (
                    <p className="text-xs text-red-600 mt-0.5">Motivo: {o.rejeitado_motivo}</p>
                  )}
                  {o.status === 'aprovado' && o.aprovado_por && (
                    <p className="text-xs text-green-600 mt-0.5">Aprovado por: {o.aprovado_por}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(o.status === 'rascunho' || o.status === 'aguardando_aprovacao') && (
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => openEdit(o)}>
                      Editar
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => { if (window.confirm('Excluir esta ordem?')) deleteMutation.mutate(o.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                  {o.itens?.length > 0 && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpandedId(expanded ? null : o.id)}>
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </div>
              {expanded && o.itens?.length > 0 && (
                <div className="border-t bg-muted/30 px-4 py-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left pb-1">Item</th>
                          <th className="text-left pb-1">Qtd</th>
                          <th className="text-left pb-1">Un.</th>
                          <th className="text-left pb-1">Valor Unit.</th>
                          <th className="text-left pb-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.itens.map((item, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="py-1 font-medium">{item.nome}</td>
                            <td className="py-1">{item.quantidade}</td>
                            <td className="py-1">{item.unidade}</td>
                            <td className="py-1">R$ {Number(item.valor_unit || 0).toFixed(2)}</td>
                            <td className="py-1 font-semibold">R$ {(Number(item.quantidade) * Number(item.valor_unit || 0)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              {editing ? 'Editar Ordem de Compra' : 'Nova Ordem de Compra'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => f('descricao', e.target.value)} placeholder="Ex: Compra de arame galvanizado..." />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={form.fornecedor} onChange={e => f('fornecedor', e.target.value)} placeholder="Nome do fornecedor" />
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens da Compra</Label>
                <Button size="sm" variant="outline" type="button" onClick={addItem} className="text-xs h-7">
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Item
                </Button>
              </div>
              {form.itens?.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 mb-2 items-center">
                  <Input className="col-span-4 text-xs" placeholder="Nome" value={item.nome} onChange={e => updateItem(i, 'nome', e.target.value)} />
                  <Input className="col-span-2 text-xs" type="number" placeholder="Qtd" value={item.quantidade} onChange={e => updateItem(i, 'quantidade', e.target.value)} />
                  <Input className="col-span-2 text-xs" placeholder="Un." value={item.unidade} onChange={e => updateItem(i, 'unidade', e.target.value)} />
                  <Input className="col-span-3 text-xs" type="number" placeholder="R$/un" value={item.valor_unit} onChange={e => updateItem(i, 'valor_unit', e.target.value)} />
                  <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => removeItem(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {form.itens?.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm font-semibold text-primary">
                Total: R$ {calcTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}

            {(!form.itens || form.itens.length === 0) && (
              <div>
                <Label>Valor Total (R$)</Label>
                <Input type="number" value={form.valor_total} onChange={e => f('valor_total', e.target.value)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Prevista</Label>
                <Input type="date" value={form.data_entrega} onChange={e => f('data_entrega', e.target.value)} />
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} max={24} value={form.parcelas} onChange={e => f('parcelas', Number(e.target.value))} />
              </div>
            </div>

            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => f('forma_pagamento', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.parcelas > 1 && calcTotal > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-primary">{form.parcelas}x de R$ {(calcTotal / Number(form.parcelas)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">Parcelas mensais a partir da data informada</p>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea value={form.notas} onChange={e => f('notas', e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary text-primary-foreground"
            >
              {editing ? 'Salvar Alterações' : 'Enviar para Aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}