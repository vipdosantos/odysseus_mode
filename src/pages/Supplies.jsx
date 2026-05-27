import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, AlertTriangle, FlaskConical, FileUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const categoryLabels = { arame:'Arame', madeira:'Madeira', prego:'Prego/Grampo', cola:'Cola/Resina', tinta:'Tinta', outros:'Outros' };

const emptyForm = { name:'', code:'', unit:'un', stock:0, min_stock:0, cost_per_unit:0, supplier_name:'', category:'outros', notes:'' };

export default function Supplies() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supply.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplies'] }); setDialogOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supply.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['supplies'] }); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supply.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplies'] }),
  });

  const [importLoading, setImportLoading] = useState(false);
  const fileRef = React.useRef();

  const handleNFImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                code: { type: 'string' },
                unit: { type: 'string' },
                quantity: { type: 'number' },
                cost_per_unit: { type: 'number' },
                supplier_name: { type: 'string' }
              }
            }
          }
        }
      }
    });
    if (result.status === 'success' && result.output?.items?.length) {
      const items = result.output.items;
      for (const item of items) {
        const existing = supplies.find(s =>
          s.code && item.code && s.code.toLowerCase() === item.code.toLowerCase() ||
          s.name?.toLowerCase() === item.name?.toLowerCase()
        );
        if (existing) {
          await base44.entities.Supply.update(existing.id, {
            stock: (existing.stock || 0) + (item.quantity || 0),
            cost_per_unit: item.cost_per_unit || existing.cost_per_unit,
          });
        } else {
          await base44.entities.Supply.create({
            name: item.name || 'Insumo NF',
            code: item.code || '',
            unit: item.unit || 'un',
            stock: item.quantity || 0,
            min_stock: 0,
            cost_per_unit: item.cost_per_unit || 0,
            supplier_name: item.supplier_name || '',
            category: 'outros',
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      toast.success(`${items.length} insumo(s) atualizados da NF!`);
    } else {
      toast.error('Não foi possível ler os itens da nota fiscal');
    }
    setImportLoading(false);
    e.target.value = '';
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s }); setDialogOpen(true); };
  const handleSave = () => editing ? updateMutation.mutate({ id: editing.id, data: form }) : createMutation.mutate(form);

  const filtered = supplies.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase()) ||
    s.supplier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = supplies.filter(s => (s.stock || 0) <= (s.min_stock || 0));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FlaskConical className="w-6 h-6 text-primary" /> Insumos de Fabricação</h1>
          <p className="text-sm text-muted-foreground">{supplies.length} insumos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xml,.xlsx,.csv" className="hidden" onChange={handleNFImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importLoading}>
            {importLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileUp className="w-4 h-4 mr-1" />}
            Importar NF
          </Button>
          <Button onClick={openNew} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Novo Insumo</Button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-700">Estoque Baixo ({lowStock.length} insumos)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(s => (
              <span key={s.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                {s.name}: {s.stock} {s.unit} (mín: {s.min_stock})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar insumo..." className="pl-9" />
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Código','Nome','Categoria','Unidade','Estoque','Mínimo','Custo Unit.','Fornecedor',''].map(h => (
                  <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhum insumo cadastrado</td></tr>
              )}
              {filtered.map(s => {
                const isLow = (s.stock || 0) <= (s.min_stock || 0);
                return (
                  <tr key={s.id} className={cn("border-t hover:bg-muted/30", isLow && "bg-red-50/50")}>
                    <td className="p-3 font-mono text-xs">{s.code || '—'}</td>
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-muted-foreground">{categoryLabels[s.category] || '—'}</td>
                    <td className="p-3">{s.unit}</td>
                    <td className="p-3">
                      <span className={cn("font-bold", isLow ? "text-red-600" : "text-foreground")}>{s.stock ?? 0}</span>
                      {isLow && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                    </td>
                    <td className="p-3 text-muted-foreground">{s.min_stock ?? 0}</td>
                    <td className="p-3">R$ {(s.cost_per_unit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-muted-foreground">{s.supplier_name || '—'}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)} className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)} className="h-7 w-7"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Insumo' : 'Novo Insumo'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div><Label>Código</Label><Input value={form.code} onChange={e => f('code', e.target.value)} /></div>
            <div><Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => f('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(categoryLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Unidade</Label><Input value={form.unit} onChange={e => f('unit', e.target.value)} placeholder="kg, m, un..." /></div>
            <div><Label>Estoque Atual</Label><Input type="number" value={form.stock} onChange={e => f('stock', Number(e.target.value))} /></div>
            <div><Label>Estoque Mínimo</Label><Input type="number" value={form.min_stock} onChange={e => f('min_stock', Number(e.target.value))} /></div>
            <div><Label>Custo por Unidade (R$)</Label><Input type="number" value={form.cost_per_unit} onChange={e => f('cost_per_unit', Number(e.target.value))} /></div>
            <div><Label>Fornecedor</Label><Input value={form.supplier_name} onChange={e => f('supplier_name', e.target.value)} /></div>
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