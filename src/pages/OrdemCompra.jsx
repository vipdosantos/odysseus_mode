import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardCheck, Plus, CheckCircle2, XCircle, Clock, DollarSign,
  Pencil, Trash2, PackageCheck, ShoppingCart, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAYMENT_LABELS = { boleto: 'Boleto', pix: 'PIX', transferencia: 'Transferência', cartao: 'Cartão', dinheiro: 'Dinheiro', cheque: 'Cheque' };
const STATUS_CONFIG = {
  rascunho:            { label: 'Rascunho',          color: 'bg-gray-400',   icon: Clock },
  aguardando_aprovacao:{ label: 'Ag. Aprovação',     color: 'bg-yellow-500', icon: Clock },
  aprovado:            { label: 'Aprovado',           color: 'bg-green-600',  icon: CheckCircle2 },
  rejeitado:           { label: 'Rejeitado',          color: 'bg-red-500',    icon: XCircle },
  pago:                { label: 'Pago',               color: 'bg-blue-600',   icon: CheckCircle2 },
};

const emptyForm = {
  tipo: 'insumo', descricao: '', fornecedor: '', valor_total: 0,
  data_entrega: '', parcelas: 1, forma_pagamento: 'boleto',
  status: 'aguardando_aprovacao', notas: '', itens: [],
};
const emptyItem = { nome: '', quantidade: 1, unidade: 'un', valor_unit: 0 };

export default function OrdemCompra() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [activeTab, setActiveTab] = useState('pendentes');
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ordens_compra'] }); setDialogOpen(false); toast.success('Ordem criada e enviada para aprovação!'); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemCompra.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ordens_compra'] }); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OrdemCompra.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordens_compra'] }),
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const openNew = (tipo = 'insumo') => { setEditing(null); setForm({ ...emptyForm, tipo }); setDialogOpen(true); };
  const openEdit = (o) => { setEditing(o); setForm({ ...o }); setDialogOpen(true); };
  const handleSave = () => {
    const totalCalc = form.itens?.length > 0
      ? form.itens.reduce((s, i) => s + (Number(i.quantidade) * Number(i.valor_unit)), 0)
      : Number(form.valor_total);
    const data = { ...form, valor_total: totalCalc };
    editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data);
  };

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

  // Approve
  const handleApprove = async (ordem) => {
    await base44.entities.OrdemCompra.update(ordem.id, {
      status: 'aprovado',
      aprovado_por: currentUser?.full_name || 'Admin',
    });
    // Generate bills
    const installments = Number(ordem.parcelas) || 1;
    const installmentValue = (Number(ordem.valor_total) || 0) / installments;
    for (let i = 0; i < installments; i++) {
      const due = new Date(ordem.data_entrega || new Date());
      due.setMonth(due.getMonth() + i);
      await base44.entities.Bill.create({
        description: installments > 1 ? `${ordem.descricao} — Parcela ${i + 1}/${installments}` : ordem.descricao,
        supplier: ordem.fornecedor,
        amount: installmentValue,
        due_date: due.toISOString().slice(0, 10),
        payment_method: ordem.forma_pagamento,
        status: 'pendente',
        category: 'outros',
        notes: ordem.notas,
      });
    }
    await base44.entities.OrdemCompra.update(ordem.id, { bill_gerado: true });
    queryClient.invalidateQueries({ queryKey: ['ordens_compra'] });
    queryClient.invalidateQueries({ queryKey: ['bills'] });
    toast.success(`Aprovado! ${installments} conta(s) a pagar gerada(s).`);
  };

  // Reject
  const handleReject = async () => {
    await base44.entities.OrdemCompra.update(rejectDialog.id, {
      status: 'rejeitado',
      rejeitado_motivo: rejectMotivo,
    });
    queryClient.invalidateQueries({ queryKey: ['ordens_compra'] });
    toast.error('Ordem rejeitada.');
    setRejectDialog(null);
    setRejectMotivo('');
  };

  const pending = ordens.filter(o => o.status === 'aguardando_aprovacao');
  const approved = ordens.filter(o => o.status === 'aprovado');
  const all = ordens;

  const renderList = (list) => list.length === 0 ? (
    <div className="text-center py-12 text-muted-foreground">Nenhuma ordem encontrada</div>
  ) : list.map(o => {
    const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.rascunho;
    const Icon = sc.icon;
    const expanded = expandedId === o.id;
    return (
      <div key={o.id} className={cn("bg-card border rounded-2xl overflow-hidden transition-all", o.status === 'rejeitado' && 'opacity-60')}>
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Type badge */}
          <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
            o.tipo === 'pedido' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600')}>
            {o.tipo === 'pedido' ? <ShoppingCart className="w-5 h-5" /> : <PackageCheck className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{o.descricao}</p>
              <span className={cn("text-xs px-2 py-0.5 rounded-full text-white font-semibold", sc.color)}>{sc.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {o.fornecedor} · R$ {(o.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              {o.parcelas > 1 && <span className="text-primary font-semibold ml-1">{o.parcelas}x</span>}
              {o.data_entrega && <span className="ml-2">· Venc: {format(parseISO(o.data_entrega), 'dd/MM/yy')}</span>}
            </p>
            {o.status === 'rejeitado' && o.rejeitado_motivo && (
              <p className="text-xs text-red-600 mt-0.5">Motivo: {o.rejeitado_motivo}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {o.status === 'aguardando_aprovacao' && isAdmin && (
              <>
                <Button size="sm" className="bg-green-600 text-white text-xs" onClick={() => handleApprove(o)}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 text-xs" onClick={() => setRejectDialog(o)}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                </Button>
              </>
            )}
            {o.status === 'aprovado' && o.bill_gerado && (
              <span className="text-xs text-green-600 flex items-center gap-1 font-semibold">
                <DollarSign className="w-3.5 h-3.5" /> Conta gerada
              </span>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(o)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteMutation.mutate(o.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
            {o.itens?.length > 0 && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpandedId(expanded ? null : o.id)}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Expanded items */}
        {expanded && o.itens?.length > 0 && (
          <div className="border-t bg-muted/30 px-4 py-3">
            <table className="w-full text-xs">
              <thead><tr className="text-muted-foreground"><th className="text-left pb-1">Item</th><th className="text-left pb-1">Qtd</th><th className="text-left pb-1">Un.</th><th className="text-left pb-1">Valor Unit.</th><th className="text-left pb-1">Total</th></tr></thead>
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
        )}
      </div>
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" /> Aprovação de Ordens
          </h1>
          <p className="text-sm text-muted-foreground">Ordens de pedido e aquisição de insumos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNew('pedido')}>
            <ShoppingCart className="w-4 h-4 mr-1" /> Nova Ordem Pedido
          </Button>
          <Button onClick={() => openNew('insumo')} className="bg-primary text-primary-foreground">
            <PackageCheck className="w-4 h-4 mr-1" /> Aquisição Insumo
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: all.length, color: '' },
          { label: 'Ag. Aprovação', count: pending.length, color: 'text-yellow-600' },
          { label: 'Aprovadas', count: approved.length, color: 'text-green-600' },
          { label: 'Rejeitadas', count: ordens.filter(o => o.status === 'rejeitado').length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-2xl font-bold", s.color)}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Alert for pending */}
      {pending.length > 0 && isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">{pending.length} ordem(ns) aguardando sua aprovação</p>
            <p className="text-xs text-yellow-700 mt-0.5">Após aprovação, as contas a pagar serão geradas automaticamente.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes <span className={cn("ml-1.5 text-xs px-1.5 py-0.5 rounded-full", pending.length > 0 ? "bg-yellow-500 text-white" : "bg-muted")}>{pending.length}</span></TabsTrigger>
          <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="space-y-3 mt-4">{renderList(pending)}</TabsContent>
        <TabsContent value="aprovadas" className="space-y-3 mt-4">{renderList(approved)}</TabsContent>
        <TabsContent value="todas" className="space-y-3 mt-4">{renderList(all)}</TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.tipo === 'pedido' ? <ShoppingCart className="w-5 h-5 text-primary" /> : <PackageCheck className="w-5 h-5 text-primary" />}
              {editing ? 'Editar Ordem' : form.tipo === 'pedido' ? 'Nova Ordem de Pedido' : 'Nova Aquisição de Insumo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => f('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pedido">Ordem de Pedido</SelectItem>
                  <SelectItem value="insumo">Aquisição de Insumo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => f('descricao', e.target.value)} placeholder="Descreva a ordem..." />
            </div>
            <div>
              <Label>Fornecedor / De quem</Label>
              <Input value={form.fornecedor} onChange={e => f('fornecedor', e.target.value)} />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens</Label>
                <Button size="sm" variant="outline" type="button" onClick={addItem} className="text-xs h-7">
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Item
                </Button>
              </div>
              {form.itens?.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 mb-2 items-center">
                  <Input className="col-span-4" placeholder="Nome" value={item.nome} onChange={e => updateItem(i, 'nome', e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="Qtd" value={item.quantidade} onChange={e => updateItem(i, 'quantidade', e.target.value)} />
                  <Input className="col-span-2" placeholder="Un." value={item.unidade} onChange={e => updateItem(i, 'unidade', e.target.value)} />
                  <Input className="col-span-3" type="number" placeholder="R$/un" value={item.valor_unit} onChange={e => updateItem(i, 'valor_unit', e.target.value)} />
                  <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => removeItem(i)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>

            {form.itens?.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm font-semibold text-primary">
                Total calculado: R$ {calcTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                <Label>Data de Entrega / Venc.</Label>
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
            <Button onClick={handleSave} className="bg-primary text-primary-foreground">
              {editing ? 'Salvar' : 'Enviar para Aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><XCircle className="w-5 h-5" /> Rejeitar Ordem</DialogTitle></DialogHeader>
          <div className="mt-2">
            <Label>Motivo da rejeição (opcional)</Label>
            <Textarea value={rejectMotivo} onChange={e => setRejectMotivo(e.target.value)} rows={3} placeholder="Informe o motivo..." className="mt-1" />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button className="bg-red-600 text-white" onClick={handleReject}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}