import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Printer, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const categoryLabels = { maquina:'Máquina', veiculo:'Veículo', ferramenta:'Ferramenta', movel:'Móvel', eletronico:'Eletrônico', outros:'Outros' };
const conditionLabels = { otimo:'Ótimo', bom:'Bom', regular:'Regular', ruim:'Ruim', inativo:'Inativo' };
const conditionColors = { otimo:'text-green-600 bg-green-50', bom:'text-blue-600 bg-blue-50', regular:'text-amber-600 bg-amber-50', ruim:'text-red-600 bg-red-50', inativo:'text-gray-400 bg-gray-50' };

const emptyForm = { name:'', code:'', category:'outros', acquisition_date:'', acquisition_value:0, current_value:0, location:'', responsible:'', condition:'bom', serial_number:'', notes:'' };

export default function Assets() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Asset.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); setDialogOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Asset.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Asset.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({ ...a }); setDialogOpen(true); };
  const handleSave = () => editing ? updateMutation.mutate({ id: editing.id, data: form }) : createMutation.mutate(form);

  const filtered = assets.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.code?.toLowerCase().includes(search.toLowerCase()) ||
    a.location?.toLowerCase().includes(search.toLowerCase())
  );

  const printLabel = (asset) => {
    const w = window.open('', '_blank');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(JSON.stringify({ codigo: asset.code, nome: asset.name, local: asset.location }))}`;
    w.document.write(`
      <html><head><title>Etiqueta ${asset.code}</title></head>
      <body style="margin:16px;font-family:sans-serif;">
        <div style="border:2px solid #333;padding:16px;width:300px;border-radius:8px;display:inline-block;">
          <div style="text-align:center;font-size:10px;color:#666;margin-bottom:4px;">PATRIMÔNIO</div>
          <div style="font-size:20px;font-weight:900;letter-spacing:2px;text-align:center;margin-bottom:4px;">${asset.code}</div>
          <div style="font-size:13px;font-weight:bold;text-align:center;margin-bottom:2px;">${asset.name}</div>
          <div style="font-size:11px;color:#555;text-align:center;margin-bottom:8px;">${asset.location || ''}</div>
          <div style="text-align:center;"><img src="${qrUrl}" /></div>
          ${asset.serial_number ? `<div style="font-size:9px;color:#999;text-align:center;margin-top:4px;">S/N: ${asset.serial_number}</div>` : ''}
        </div>
        <script>setTimeout(()=>window.print(),500)<\/script>
      </body></html>
    `);
    w.document.close();
  };

  const totalValue = assets.reduce((s, a) => s + (a.current_value || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Package className="w-6 h-6 text-primary" /> Patrimônio</h1>
          <p className="text-sm text-muted-foreground">Total: R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — {assets.length} bens</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> Novo Bem</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar patrimônio..." className="pl-9" />
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Código','Nome','Categoria','Local','Responsável','Valor Atual','Estado',''].map(h => (
                  <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum bem cadastrado</td></tr>
              )}
              {filtered.map(asset => (
                <tr key={asset.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono font-bold text-xs">{asset.code}</td>
                  <td className="p-3 font-medium">{asset.name}</td>
                  <td className="p-3 text-muted-foreground">{categoryLabels[asset.category] || '—'}</td>
                  <td className="p-3 text-muted-foreground">{asset.location || '—'}</td>
                  <td className="p-3 text-muted-foreground">{asset.responsible || '—'}</td>
                  <td className="p-3 font-semibold">R$ {(asset.current_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3">
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium", conditionColors[asset.condition] || '')}>{conditionLabels[asset.condition] || '—'}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => printLabel(asset)} className="h-7 w-7" title="Imprimir etiqueta"><Printer className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(asset)} className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(asset.id)} className="h-7 w-7"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Bem' : 'Novo Bem Patrimonial'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div><Label>Código Patrimônio</Label><Input value={form.code} onChange={e => f('code', e.target.value)} placeholder="PAT-001" /></div>
            <div><Label>Nº de Série</Label><Input value={form.serial_number} onChange={e => f('serial_number', e.target.value)} /></div>
            <div><Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => f('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(categoryLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Estado</Label>
              <Select value={form.condition} onValueChange={v => f('condition', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(conditionLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data de Aquisição</Label><Input type="date" value={form.acquisition_date} onChange={e => f('acquisition_date', e.target.value)} /></div>
            <div><Label>Valor de Aquisição (R$)</Label><Input type="number" value={form.acquisition_value} onChange={e => f('acquisition_value', Number(e.target.value))} /></div>
            <div><Label>Valor Atual (R$)</Label><Input type="number" value={form.current_value} onChange={e => f('current_value', Number(e.target.value))} /></div>
            <div><Label>Localização</Label><Input value={form.location} onChange={e => f('location', e.target.value)} /></div>
            <div><Label>Responsável</Label><Input value={form.responsible} onChange={e => f('responsible', e.target.value)} /></div>
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