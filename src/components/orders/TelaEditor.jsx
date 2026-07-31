import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const TELA_OPTIONS = [
  { modelo: 'Q.45', especificacao: '20\\20 2X3 Ø 3,4mm' },
  { modelo: 'Q.61', especificacao: '15\\15 2X3 Ø 3,4mm' },
  { modelo: 'Q.92', especificacao: '15\\15 2X3 Ø 4,2mm' },
  { modelo: 'Q.138', especificacao: '10\\10 2X3 Ø 4,2mm' },
];

export function getTelaEspecificacao(modelo) {
  return TELA_OPTIONS.find(t => t.modelo === modelo)?.especificacao || '';
}

export default function TelaEditor({ value = [], onChange, totalSquareMeters = 0 }) {
  const telas = value || [];
  const calcQty = Math.ceil((Number(totalSquareMeters) || 0) / 5.2);

  const addTela = () => {
    onChange([...telas, { modelo: 'Q.45', especificacao: getTelaEspecificacao('Q.45'), quantity: calcQty }]);
  };

  const updateTela = (idx, modelo) => {
    const updated = [...telas];
    updated[idx] = { ...updated[idx], modelo, especificacao: getTelaEspecificacao(modelo) };
    onChange(updated);
  };

  const removeTela = (idx) => {
    onChange(telas.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-xl bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Telas (Malhas)</Label>
        <Button type="button" variant="outline" size="sm" onClick={addTela}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar Tela
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>m² total: {(Number(totalSquareMeters) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²</span>
        <span>Qtd. calculada: m² ÷ 5,2 = <strong className="text-foreground">{calcQty} un</strong></span>
      </div>
      {telas.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhuma tela adicionada.</p>
      ) : (
        telas.map((tela, idx) => (
          <div key={idx} className="flex items-end gap-3">
            <div className="w-28">
              <Label className="text-xs">Modelo</Label>
              <Select value={tela.modelo || 'Q.45'} onValueChange={v => updateTela(idx, v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TELA_OPTIONS.map(t => (
                    <SelectItem key={t.modelo} value={t.modelo}>{t.modelo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Especificação</Label>
              <Input value={tela.especificacao || ''} readOnly className="bg-muted/50 text-xs" />
            </div>
            <div className="w-32">
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min={0} value={calcQty} readOnly className="bg-muted/50" />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeTela(idx)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}