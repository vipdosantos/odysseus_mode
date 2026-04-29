import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

export default function ProductsWithCategory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', code: '', size: '', unit: 'un', price: 0,
    stock: 0, min_stock: 0, category: '', active: true, notes: '',
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 200),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product_categories'],
    queryFn: () => base44.entities.SupplyCategory.filter({ active: true }, 'name', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', code: '', size: '', unit: 'un', price: 0, stock: 0, min_stock: 0, category: categories[0]?.name || '', active: true, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const data = { ...form, price: Number(form.price) || 0, stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = products.filter(p =>
    !search || [p.name, p.code, p.size, p.category].some(v => String(v || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Novo
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Código</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Tamanho</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Categoria</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Preço</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Estoque</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Ativo</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum produto encontrado</td></tr>
            )}
            {filtered.map(item => (
              <tr key={item.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">{item.code || '—'}</td>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">{item.size || '—'}</td>
                <td className="px-4 py-3">
                  {item.category
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{item.category}</span>
                    : '—'
                  }
                </td>
                <td className="px-4 py-3">{item.price ? `R$ ${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`font-medium ${(item.stock || 0) <= (item.min_stock || 0) ? 'text-red-600' : ''}`}>{item.stock ?? 0}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)} className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2">
              <Label className="mb-1 block">Nome</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Código</Label>
              <Input value={form.code} onChange={e => set('code', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Tamanho / Dimensão</Label>
              <Input value={form.size} onChange={e => set('size', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Categoria</Label>
              <Select value={form.category || ''} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Nenhuma —</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Cadastre categorias na aba "Cat. Produtos"</p>
              )}
            </div>
            <div>
              <Label className="mb-1 block">Unidade</Label>
              <Input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="un, m, kg..." />
            </div>
            <div>
              <Label className="mb-1 block">Preço (R$)</Label>
              <Input type="number" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Estoque Atual</Label>
              <Input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Estoque Mínimo</Label>
              <Input type="number" value={form.min_stock} onChange={e => set('min_stock', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Ativo</Label>
              <Select value={String(form.active ?? true)} onValueChange={v => set('active', v === 'true')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="mb-1 block">Observações</Label>
              <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground">
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}