import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

function FormField({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <Select value={String(value ?? field.default ?? true)} onValueChange={v => onChange(v === 'true')}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Sim</SelectItem>
          <SelectItem value="false">Não</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (field.enum) {
    return (
      <Select value={value || field.default || ''} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {field.enum.map(opt => (
            <SelectItem key={opt} value={opt}>{field.enumLabels?.[opt] || opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.key === 'notes') {
    return <Textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2} />;
  }
  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value ?? ''}
      onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
    />
  );
}

export default function CadastroTable({ entity, entityKey, fields, title, columns }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const { data: items = [] } = useQuery({
    queryKey: [entityKey],
    queryFn: () => entity.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => entity.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [entityKey] }); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => entity.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [entityKey] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entity.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [entityKey] }),
  });

  const openNew = () => {
    const defaults = {};
    fields.forEach(f => { if (f.default !== undefined) defaults[f.key] = f.default; });
    setEditing(null);
    setForm(defaults);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const filtered = items.filter(item =>
    !search || columns.some(col => String(item[col.key] || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar ${title.toLowerCase()}...`} className="pl-9" />
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Novo
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{col.label}</th>
              ))}
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</td></tr>
            )}
            {filtered.map(item => (
              <tr key={item.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(item[col.key], item) : (item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '—')}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)} className="h-7 w-7">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
            <DialogTitle>{editing ? `Editar ${title}` : `Novo ${title}`}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {fields.map(field => (
              <div key={field.key} className={field.fullWidth ? 'col-span-2' : ''}>
                <Label className="mb-1 block">{field.label}</Label>
                <FormField field={field} value={form[field.key]} onChange={v => setForm(f => ({ ...f, [field.key]: v }))} />
              </div>
            ))}
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