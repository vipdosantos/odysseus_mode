import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import ImportPriceTableDialog from './ImportPriceTableDialog';

export default function SellerPriceTables() {
  const queryClient = useQueryClient();
  const [selectedSeller, setSelectedSeller] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ seller_id: '', seller_name: '', product_size: '', price: 0, discount_pct: 0, notes: '' });
  const [importOpen, setImportOpen] = useState(false);

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers'],
    queryFn: () => base44.entities.Seller.list('name', 200),
  });

  const { data: priceTables = [] } = useQuery({
    queryKey: ['price_tables'],
    queryFn: () => base44.entities.SellerPriceTable.list('seller_name', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SellerPriceTable.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['price_tables'] }); setDialogOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SellerPriceTable.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['price_tables'] }); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SellerPriceTable.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price_tables'] }),
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const openNew = () => {
    const seller = sellers.find(s => s.id === selectedSeller);
    setEditing(null);
    setForm({ seller_id: selectedSeller, seller_name: seller?.name || '', product_size: '', price: 0, discount_pct: 0, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (pt) => { setEditing(pt); setForm({ ...pt }); setDialogOpen(true); };
  const handleSave = () => editing ? updateMutation.mutate({ id: editing.id, data: form }) : createMutation.mutate(form);

  const filtered = selectedSeller ? priceTables.filter(p => p.seller_id === selectedSeller) : priceTables;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-64">
          <Select value={selectedSeller} onValueChange={setSelectedSeller}>
            <SelectTrigger><SelectValue placeholder="Filtrar por vendedor..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>— Todos os vendedores —</SelectItem>
              {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground" disabled={!selectedSeller}>
          <Plus className="w-4 h-4 mr-1" /> Novo Preço
        </Button>
        <Button onClick={() => setImportOpen(true)} variant="outline" disabled={!selectedSeller}>
          <Upload className="w-4 h-4 mr-1" /> Importar Excel
        </Button>
        {!selectedSeller && <p className="text-xs text-muted-foreground">Selecione um vendedor para adicionar/importar preços</p>}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Vendedor</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Produto / Tamanho</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Preço</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Desconto</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Preço Final</th>
              <th className="p-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma tabela de preço cadastrada</td></tr>
            )}
            {filtered.map(pt => {
              const finalPrice = pt.price * (1 - (pt.discount_pct || 0) / 100);
              return (
                <tr key={pt.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{pt.seller_name}</td>
                  <td className="p-3">{pt.product_size}</td>
                  <td className="p-3">R$ {(pt.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-muted-foreground">{pt.discount_pct || 0}%</td>
                  <td className="p-3 font-bold text-primary">R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(pt)} className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(pt.id)} className="h-7 w-7"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Preço' : 'Novo Preço'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2">
              <Label>Vendedor</Label>
              <Select value={form.seller_id} onValueChange={v => {
                const s = sellers.find(sel => sel.id === v);
                f('seller_id', v); f('seller_name', s?.name || '');
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                <SelectContent>{sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Produto / Tamanho</Label>
              <Input value={form.product_size} onChange={e => f('product_size', e.target.value)} placeholder="Ex: Treliça 8cm x 3m" />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" value={form.price} onChange={e => f('price', Number(e.target.value))} />
            </div>
            <div>
              <Label>Desconto (%)</Label>
              <Input type="number" value={form.discount_pct} onChange={e => f('discount_pct', Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground">{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedSeller && (
        <ImportPriceTableDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          sellerId={selectedSeller}
          sellerName={sellers.find(s => s.id === selectedSeller)?.name || ''}
        />
      )}
    </div>
  );
}