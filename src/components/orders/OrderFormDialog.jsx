import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const emptyItem = { size: '', quantity: 1, produced: 0, qr_code_id: '' };

export default function OrderFormDialog({ open, onOpenChange, order, onSave }) {
  const [form, setForm] = useState({
    order_number: '',
    client_name: '',
    client_phone: '',
    status: 'novo',
    priority: 'normal',
    delivery_date: '',
    total_value: 0,
    notes: '',
    items: [{ ...emptyItem }],
  });

  useEffect(() => {
    if (order) {
      setForm({ ...order, items: order.items?.length ? order.items : [{ ...emptyItem }] });
    } else {
      setForm({
        order_number: `PED-${Date.now().toString().slice(-6)}`,
        client_name: '', client_phone: '', status: 'novo', priority: 'normal',
        delivery_date: '', total_value: 0, notes: '',
        items: [{ ...emptyItem }],
      });
    }
  }, [order, open]);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (!items[idx].qr_code_id) {
      items[idx].qr_code_id = `${form.order_number}-${items[idx].size}-${idx}`;
    }
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const handleSave = () => {
    const items = form.items.map((item, idx) => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      produced: Number(item.produced) || 0,
      qr_code_id: item.qr_code_id || `${form.order_number}-${item.size}-${idx}`,
    }));
    onSave({ ...form, total_value: Number(form.total_value) || 0, items });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Label>Nº do Pedido</Label>
            <Input value={form.order_number} onChange={e => setForm({ ...form, order_number: e.target.value })} />
          </div>
          <div>
            <Label>Cliente</Label>
            <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} />
          </div>
          <div>
            <Label>Data de Entrega</Label>
            <Input type="date" value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
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
            <Input type="number" value={form.total_value} onChange={e => setForm({ ...form, total_value: e.target.value })} />
          </div>
          {order && (
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_producao">Em Produção</SelectItem>
                  <SelectItem value="controle_qualidade">Controle de Qualidade</SelectItem>
                  <SelectItem value="pronto">Pronto</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mt-4">
          <Label>Observações</Label>
          <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>

        {/* Items */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold">Itens (Treliças)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex items-end gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="flex-1">
                  <Label className="text-xs">Tamanho</Label>
                  <Input value={item.size} onChange={e => updateItem(idx, 'size', e.target.value)} placeholder="Ex: 8cm x 3m" />
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
            ))}
          </div>
        </div>

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