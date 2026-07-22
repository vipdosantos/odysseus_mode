import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TRUSS_TYPES, FERRO_DIAMETERS } from '@/lib/trussTypes';
import OrderAttachments from './OrderAttachments';
import DeliveryMapPicker from './DeliveryMapPicker';
import ClientPhotoCapture from './ClientPhotoCapture';

function generateAccessKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 16 }, (_, i) =>
    (i > 0 && i % 4 === 0 ? '-' : '') + chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

const emptyItem = { truss_type: 'H8', size: '', quantity: 1, produced: 0, qr_code_id: '', adicionais: [] };

export default function OrderFormDialog({ open, onOpenChange, order, onSave }) {
  const [form, setForm] = useState({
    order_number: '', client_name: '', client_phone: '',
    seller_id: '', seller_name: '', seller_phone: '',
    status: 'of_etiquetas', priority: 'normal',
    delivery_date: '', delivery_address: '', delivery_lat: null, delivery_lng: null,
    truck_type: 'nenhum',
    total_value: 0, payment_method: 'boleto', installments: 1, notes: '',
    items: [{ ...emptyItem }],
    attachments: [],
    delivery_photos: [],
    client_photo: '',
    access_key: '',
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers'],
    queryFn: () => base44.entities.Seller.list('name', 200),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 500),
  });

  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => base44.entities.Product.filter({ active: true }, 'name', 200),
  });

  const { data: truckTypes = [] } = useQuery({
    queryKey: ['truck-types-active'],
    queryFn: () => base44.entities.TruckType.filter({ active: true }, 'name', 200),
  });

  useEffect(() => {
    if (order) {
      setForm({
        ...order,
        items: order.items?.length ? order.items : [{ ...emptyItem }],
        attachments: order.attachments || [],
        delivery_photos: order.delivery_photos || [],
      });
    } else {
      setForm({
        order_number: `PED-${Date.now().toString().slice(-6)}`,
        client_name: '', client_phone: '',
        seller_id: '', seller_name: '', seller_phone: '',
        status: 'of_etiquetas', priority: 'normal',
        delivery_date: '', delivery_address: '', delivery_lat: null, delivery_lng: null,
        truck_type: 'nenhum',
        total_value: 0, payment_method: 'boleto', installments: 1, notes: '',
        items: [{ ...emptyItem }],
        attachments: [],
        delivery_photos: [],
        client_photo: '',
        access_key: generateAccessKey(),
      });
    }
  }, [order, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (!items[idx].qr_code_id) items[idx].qr_code_id = `${form.order_number}-${items[idx].size}-${idx}`;
    setForm(f => ({ ...f, items }));
  };
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const updateAdicional = (idx, diametro, value) => {
    const qty = Number(value) || 0;
    const items = [...form.items];
    const adicionais = [...(items[idx].adicionais || [])];
    const existing = adicionais.findIndex(a => a.diametro === diametro);
    if (existing >= 0) {
      if (qty > 0) adicionais[existing] = { diametro, quantity: qty };
      else adicionais.splice(existing, 1);
    } else if (qty > 0) {
      adicionais.push({ diametro, quantity: qty });
    }
    items[idx] = { ...items[idx], adicionais };
    setForm(f => ({ ...f, items }));
  };

  const handleSave = () => {
    const items = form.items.map((item, idx) => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      produced: Number(item.produced) || 0,
      qr_code_id: item.qr_code_id || `${form.order_number}-${item.size}-${idx}`,
    }));
    onSave({
      ...form,
      total_value: Number(form.total_value) || 0,
      items: items.map(item => ({
        ...item,
        adicionais: (item.adicionais || []).filter(a => Number(a.quantity) > 0),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
            <TabsTrigger value="itens" className="flex-1">Itens</TabsTrigger>
            <TabsTrigger value="entrega" className="flex-1">Entrega</TabsTrigger>
            <TabsTrigger value="anexos" className="flex-1">Anexos</TabsTrigger>
          </TabsList>

          {/* ── ABA DADOS ─────────────────────────── */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº do Pedido</Label>
                <Input value={form.order_number} onChange={e => set('order_number', e.target.value)} />
              </div>
              <div className="relative">
                <Label>Cliente</Label>
                <Input
                  value={clientSearch || form.client_name}
                  onChange={e => {
                    setClientSearch(e.target.value);
                    set('client_name', e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => { setClientSearch(form.client_name); setShowClientDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                  placeholder="Buscar ou digitar cliente..."
                  autoComplete="off"
                />
                {showClientDropdown && clients.filter(c =>
                  !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
                ).length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clients
                      .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onMouseDown={() => {
                            set('client_name', c.name);
                            set('client_phone', c.phone || form.client_phone);
                            setClientSearch('');
                            setShowClientDropdown(false);
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.phone && <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} />
              </div>
              <div>
                <Label>Vendedor</Label>
                <Select value={form.seller_id || ''} onValueChange={v => {
                  if (v === '') {
                    set('seller_id', ''); set('seller_name', ''); set('seller_phone', ''); return;
                  }
                  const seller = sellers.find(s => s.id === v);
                  set('seller_id', v);
                  set('seller_name', seller?.name || '');
                  set('seller_phone', seller?.phone || '');
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— Nenhum —</SelectItem>
                    {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => set('priority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Total (R$)</Label>
                <Input type="number" value={form.total_value} onChange={e => set('total_value', e.target.value)} />
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={form.payment_method || 'boleto'} onValueChange={v => set('payment_method', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} max={24} value={form.installments || 1} onChange={e => set('installments', Number(e.target.value))} />
              </div>
              <div>
                <Label>Chave de Acesso ao Status</Label>
                <Input value={form.access_key || ''} onChange={e => set('access_key', e.target.value)} placeholder="Gerada automaticamente se vazia" />
              </div>
              {order && (
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => set('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="of_etiquetas">OF e Etiquetas</SelectItem>
                      <SelectItem value="corte_vigas">Corte Vigas</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                      <SelectItem value="secagem">Secagem</SelectItem>
                      <SelectItem value="expedicao">Expedição</SelectItem>
                      <SelectItem value="aguardando_entrega">Aguardando Entrega</SelectItem>
                      <SelectItem value="entrega">Entrega</SelectItem>
                      <SelectItem value="a_caminho">A Caminho</SelectItem>
                      <SelectItem value="recebido">Recebido</SelectItem>
                      <SelectItem value="pagamento_pendente">Pagamento Pendente</SelectItem>
                      <SelectItem value="finalizado">Finalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {/* Foto do Cliente */}
            <div>
              <Label>Foto do Cliente</Label>
              <div className="mt-1">
                <ClientPhotoCapture
                  photoUrl={form.client_photo}
                  onChange={v => set('client_photo', v)}
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </TabsContent>

          {/* ── ABA ITENS ─────────────────────────── */}
          <TabsContent value="itens" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Itens (Treliças)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-muted/50 rounded-xl space-y-2">
                  <div className="flex items-end gap-3">
                  <div className="w-28">
                    <Label className="text-xs">Tipo Treliça</Label>
                    <Select value={item.truss_type || 'H8'} onValueChange={v => updateItem(idx, 'truss_type', v)}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        {TRUSS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Tamanho / Produto</Label>
                    {products.length > 0 ? (
                      <Select value={item.size} onValueChange={v => updateItem(idx, 'size', v)}>
                        <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.size || p.name}>
                              {p.name}{p.size ? ` — ${p.size}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={item.size} onChange={e => updateItem(idx, 'size', e.target.value)} placeholder="Ex: 8cm x 3m" />
                    )}
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Quantidade</Label>
                    <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                  </div>
                  {form.items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 border-t border-border/50">
                    <span className="text-xs font-medium text-muted-foreground">Adicionais (ferros):</span>
                    {FERRO_DIAMETERS.map(f => {
                      const adc = (item.adicionais || []).find(a => a.diametro === f.code);
                      return (
                        <div key={f.code} className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{f.label}</span>
                          <Input
                            type="number"
                            min={0}
                            className="w-16 h-8"
                            value={adc?.quantity ?? 0}
                            onChange={e => updateAdicional(idx, f.code, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── ABA ENTREGA ───────────────────────── */}
          <TabsContent value="entrega" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Entrega</Label>
                <Input type="date" value={form.delivery_date} onChange={e => set('delivery_date', e.target.value)} />
              </div>
              <div>
                <Label>Tipo de Caminhão</Label>
                <Select value={form.truck_type || 'nenhum'} onValueChange={v => set('truck_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">— Nenhum —</SelectItem>
                    {truckTypes.map(t => (
                      <SelectItem key={t.id} value={t.code || t.name}>
                        {t.name}{t.capacity_kg ? ` (${Number(t.capacity_kg).toLocaleString('pt-BR')} kg)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {truckTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Cadastre os tipos em Cadastros → Tipos de Caminhão.</p>
                )}
              </div>
            </div>
            <DeliveryMapPicker
              address={form.delivery_address}
              lat={form.delivery_lat}
              lng={form.delivery_lng}
              onChange={({ address }) => set('delivery_address', address)}
            />
          </TabsContent>

          {/* ── ABA ANEXOS ────────────────────────── */}
          <TabsContent value="anexos" className="space-y-6 mt-4">
            <OrderAttachments
              attachments={form.attachments}
              onChange={v => set('attachments', v)}
              label="Documentos do Pedido (PDF, JPG, Excel)"
              maxFiles={10}
            />
            <OrderAttachments
              attachments={form.delivery_photos}
              onChange={v => set('delivery_photos', v)}
              label="Fotos da Entrega (até 10)"
              maxFiles={10}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground">
            {order ? 'Salvar Alterações' : 'Criar Pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}