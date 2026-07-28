import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TRUSS_TYPES, FERRO_DIAMETERS } from '@/lib/trussTypes';
import { Save, RotateCcw } from 'lucide-react';

export default function WeightConfig({ weights, onChange, onSave, onReset, saving }) {
  const set = (patch) => onChange({ ...weights, ...patch });
  const setTrelica = (type, v) =>
    set({ trelica: { ...weights.trelica, [type]: Number(v) || 0 } });
  const setFerro = (d, v) => set({ ferro: { ...weights.ferro, [d]: Number(v) || 0 } });

  return (
    <div className="bg-card rounded-2xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Tabela de Pesos (referência)</h3>
          <p className="text-xs text-muted-foreground">Valores em kg por painel/unidade</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="w-3.5 h-3.5" /> Padrão
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {TRUSS_TYPES.map(type => (
          <div key={type}>
            <Label className="text-xs">Treliça {type}</Label>
            <Input
              type="number"
              value={weights.trelica[type] ?? 0}
              onChange={e => setTrelica(type, e.target.value)}
              className="mt-1 h-8"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Tijolo / painel (kg)</Label>
          <Input type="number" value={weights.tijolo} onChange={e => set({ tijolo: Number(e.target.value) || 0 })} className="mt-1 h-8" />
        </div>
        <div>
          <Label className="text-xs">Tela / painel (kg)</Label>
          <Input type="number" value={weights.telas} onChange={e => set({ telas: Number(e.target.value) || 0 })} className="mt-1 h-8" />
        </div>
        {FERRO_DIAMETERS.map(f => (
          <div key={f.code}>
            <Label className="text-xs">Ferro {f.label} (kg/un)</Label>
            <Input
              type="number"
              value={weights.ferro[f.code] ?? 0}
              onChange={e => setFerro(f.code, e.target.value)}
              className="mt-1 h-8"
            />
          </div>
        ))}
      </div>
    </div>
  );
}