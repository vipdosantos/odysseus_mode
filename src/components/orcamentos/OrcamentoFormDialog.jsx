import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TRUSS_TYPES } from '@/lib/trussTypes';
import { lookupEpsDimension } from '@/lib/epsDimensions';
import PaymentsEditor from '@/components/orders/PaymentsEditor';
import { toast } from 'sonner';

function generateAccessKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 16 }, (_, i) =>
    (i > 0 && i % 4 === 0 ? '-' : '') + chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

const TIPO_LAJE_OPTIONS = ['Treliçada', 'Painel', 'Cortina de contenção', 'Treliçado Maciço', 'Painel Maciço'];
const TIPO_ENCHIMENTO_OPTIONS = ['Nenhum', 'EPS', 'Lajota'];

const PAG_OPTIONS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
];

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyItem = { size: '', truss_type: 'H8', quantity: 1, unit_price: 0 };

export default function OrcamentoFormDialog({ open, onOpenChange, onSave }) {
  const [form, setForm] = useState({
    order_number: '', client_name: '', client_phone: '', client_email: '',
    tipo: 'orcamento', status: 'of_etiquetas',
    delivery_address: '', delivery_date: '',
    total_value: 0, payment_method: 'pix', installments: 1, payments: [],
    notes: '', access_key: '',
    quote_tipo_laje: 'Treliçada', tipo_enchimento: 'Nenhum', validade_dias: 15,
    items: [{ ...emptyItem }],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 500),
  });
  const { data: epsDimensions = [] } = useQuery({
    queryKey: ['eps_dimensions'],
    queryFn: () => base44.entities.EpsDimension.list('-created_date', 200),
  });
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        order_number: `ORC-${Date.now().toString().slice(-6)}`,
        client_name: '', client_phone: '', client_email: '',
        tipo: 'orcamento', status: 'of_etiquetas',
        delivery_address: '', delivery_date: '',
        total_value: 0, payment_method: 'pix', installments: 1, payments: [],
        notes: '', access_key: generateAccessKey(),
        quote_tipo_laje: 'Treliçada', tipo_enchimento: 'Nenhum', validade_dias: 15,
        items: [{ ...emptyItem }],
      });
      setClientSearch('');
    }
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'truss_type') {
      const dim = lookupEpsDimension(form.quote_tipo_laje, value, form.tipo_enchimento, epsDimensions);
      if (dim || form.tipo_enchimento !== 'Nenhum') items[idx].enchimento_dimension = dim;
    }
    setForm(f => ({ ...f, items }));
  };

  // Auto-preencher dimensão do enchimento em todos os itens quando tipo_laje ou tipo_enchimento muda
  useEffect(() => {
    if (!epsDimensions.length) return;
    setForm(f => {
      if (f.tipo_enchimento === 'Nenhum' && !f.items.some(it => it.enchimento_dimension)) return f;
      const items = f.items.map(it => ({
        ...it,
        enchimento_dimension: lookupEpsDimension(f.quote_tipo_laje, it.truss_type, f.tipo_enchimento, epsDimensions),
      }));
      return { ...f, items };
    });
  }, [form.tipo_enchimento, form.quote_tipo_laje, epsDimensions]);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  useEffect(() => {
    set(f => ({ ...f, total_value: subtotal }));
  }, [subtotal]);

  const handleSave = () => {
    if (!form.client_name.trim()) { toast.error('Informe o nome do cliente.'); return; }
    if (form.items.length === 0 || form.items.every(i => !i.size)) { toast.error('Adicione pelo menos um item.'); return; }
    onSave({
      ...form,
      total_value: Number(subtotal) || 0,
      items: form.items.map(it => ({
        ...it,
        quantity: Number(it.quantity) || 0,
        produced: 0,
        scanned_units: [],
        delivered_units: [],
        loaded_units: [],
        stage_conferencias: {},
        adicionais: [],
        qr_code_id: '',
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Dados do cliente */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nº Orçamento</Label>
                <Input value={form.order_number} onChange={e => set('order_number', e.target.value)} className="h-9" />
              </div>
              <div className="relative">
                <Label className="text-xs">Cliente</Label>
                <Input
                  value={clientSearch || form.client_name}
                  onChange={e => {
                    setClientSearch(e.target.value);
                    set('client_name', e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => { setClientSearch(form.client_name); setShowClientDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                  placeholder="Buscar ou digitar..."
                  autoComplete="off"
                  className="h-9"
                />
                {showClientDropdown && clients.filter(c =>
                  !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
                ).length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(c => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onMouseDown={() => {
                            set('client_name', c.name);
                            set('client_phone', c.phone || '');
                            set('client_email', c.email || '');
                            set('delivery_address', c.address || '');
                            setClientSearch('');
                            setShowClientDropdown(false);
                          }}>
                          <span className="font-medium">{c.name}</span>
                          {c.phone && <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} className="h-9" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Endereço de entrega</Label>
                <Input value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} className="h-9" placeholder="Rua, nº, bairro, cidade" />
              </div>
            </div>
          </div>

          {/* Tipo de laje */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tipo de Laje</Label>
              <Select value={form.quote_tipo_laje} onValueChange={v => set('quote_tipo_laje', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_LAJE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Enchimento</Label>
              <Select value={form.tipo_enchimento || 'Nenhum'} onValueChange={v => set('tipo_enchimento', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_ENCHIMENTO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Validade (dias)</Label>
              <Input type="number" min={1} value={form.validade_dias} onChange={e => set('validade_dias', Number(e.target.value))} className="h-9" />
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens / Metragem</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-2.5 space-y-2">
                  <div className="flex items-end gap-2">
                    <div className="w-20 shrink-0">
                      <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                      <Select value={item.truss_type} onValueChange={v => updateItem(idx, 'truss_type', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRUSS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Label className="text-[10px] text-muted-foreground">Tamanho / Metragem</Label>
                      <Input value={item.size} onChange={e => updateItem(idx, 'size', e.target.value)} placeholder="Ex: 8cm x 3m" className="h-8 text-xs" />
                    </div>
                    <div className="w-16 shrink-0">
                      <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                      <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="w-24 shrink-0">
                      <Label className="text-[10px] text-muted-foreground">Unit. R$</Label>
                      <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} className="h-8 text-xs" />
                    </div>
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {form.tipo_enchimento !== 'Nenhum' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-muted-foreground">Dimensão {form.tipo_enchimento}:</span>
                      <Input
                        className="h-8 flex-1 text-xs"
                        value={item.enchimento_dimension || ''}
                        onChange={e => updateItem(idx, 'enchimento_dimension', e.target.value)}
                        placeholder="Auto-preenchido pela tabela"
                      />
                    </div>
                  )}
                  <div className="text-right text-[11px] text-muted-foreground">
                    Subtotal: <strong className="text-foreground">R$ {fmtBRL((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagamento */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Forma Principal</Label>
                <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAG_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Input type="number" min={1} value={form.installments} onChange={e => set('installments', Number(e.target.value))} className="h-9" />
              </div>
            </div>
            <PaymentsEditor
              value={form.payments}
              onChange={v => set('payments', v)}
              totalValue={Number(form.total_value) || 0}
              compact
            />
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Condições especiais, prazos, observações..." />
          </div>

          {/* Total */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Total do Orçamento</span>
            <span className="text-lg font-bold text-primary">R$ {fmtBRL(subtotal)}</span>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground">
            Criar Orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}