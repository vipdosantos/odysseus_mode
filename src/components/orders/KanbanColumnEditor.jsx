import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLOR_PALETTE = [
  'bg-gray-400', 'bg-blue-400', 'bg-orange-400', 'bg-amber-500', 'bg-yellow-500',
  'bg-cyan-500', 'bg-indigo-400', 'bg-violet-500', 'bg-purple-500', 'bg-teal-500',
  'bg-red-400', 'bg-green-500', 'bg-pink-500', 'bg-lime-500', 'bg-sky-500', 'bg-rose-500',
];

function slugify(label) {
  return (label || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `etapa_${Date.now().toString(36)}`;
}

export default function KanbanColumnEditor({ open, onOpenChange, columns, onSave }) {
  const [draft, setDraft] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [openPalette, setOpenPalette] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft((columns || []).map((c, i) => ({ ...c, order: c.order ?? i })));
      setNewLabel('');
    }
  }, [open, columns]);

  const move = (idx, dir) => {
    setDraft(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((c, i) => ({ ...c, order: i }));
    });
  };

  const update = (idx, patch) => {
    setDraft(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const remove = (idx) => {
    setDraft(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i })));
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = slugify(label);
    // garantir chave única
    let uniqueKey = key;
    let n = 1;
    while (draft.some(c => c.key === uniqueKey)) { uniqueKey = `${key}_${n++}`; }
    setDraft(prev => [...prev, { key: uniqueKey, label, color: 'bg-gray-400', active: true, order: prev.length, _new: true }]);
    setNewLabel('');
  };

  const handleSave = () => {
    onSave(draft.map((c, i) => ({
      id: c.id,
      key: c.key,
      label: c.label,
      color: c.color,
      active: c.active !== false,
      order: i,
    })));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Colunas do Kanban</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Reordene, renomeie, mude a cor, ative/desative ou crie novas etapas. Remover uma coluna não apaga os pedidos já nela.
        </p>

        <div className="space-y-2">
          {draft.map((col, idx) => (
            <div key={col.key} className={cn(
              "flex items-center gap-2 p-2 rounded-lg border bg-card",
              col.active === false && "opacity-50"
            )}>
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="shrink-0 relative">
                <button
                  onClick={() => setOpenPalette(openPalette === idx ? null : idx)}
                  className={cn("w-6 h-6 rounded-full border border-border cursor-pointer", col.color)}
                />
                {openPalette === idx && (
                  <div className="fixed inset-0 z-40" onClick={() => setOpenPalette(null)}>
                    <div className="absolute left-0 top-8 grid grid-cols-8 gap-1 p-2 bg-card border rounded-lg shadow-xl w-60 z-50" onClick={e => e.stopPropagation()}>
                      {COLOR_PALETTE.map(c => (
                        <button
                          key={c}
                          onClick={() => { update(idx, { color: c }); setOpenPalette(null); }}
                          className={cn("w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform", c)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Input
                value={col.label}
                onChange={e => update(idx, { label: e.target.value })}
                className="flex-1 h-8"
              />
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === draft.length - 1}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => update(idx, { active: col.active !== false ? false : true })}
                  title={col.active !== false ? 'Desativar' : 'Ativar'}
                >
                  {col.active !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => remove(idx)}
                  title="Remover coluna"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {draft.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma coluna. Adicione abaixo.</p>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="Nova etapa (ex: Pintura)"
            className="flex-1 h-8"
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!newLabel.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-primary text-primary-foreground">Salvar Colunas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}