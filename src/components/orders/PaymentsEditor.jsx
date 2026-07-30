import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const PAG_OPTIONS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
];

/**
 * Editor de múltiplas formas de pagamento.
 * @param {Array} value - [{ method, value, installments }]
 * @param {(v: Array) => void} onChange
 * @param {number} totalValue - valor total do pedido (para sugerir distribuição)
 */
export default function PaymentsEditor({ value = [], onChange, totalValue = 0, compact = false }) {
  const payments = Array.isArray(value) ? value : [];

  const update = (idx, field, v) => {
    const next = payments.map((p, i) =>
      i === idx ? { ...p, [field]: field === 'value' || field === 'installments' ? Number(v) || 0 : v } : p
    );
    onChange(next);
  };

  const add = () => {
    const remaining = Math.max(0, Number(totalValue) - payments.reduce((s, p) => s + (Number(p.value) || 0), 0));
    onChange([...payments, { method: 'pix', value: remaining, installments: 1 }]);
  };

  const remove = (idx) => onChange(payments.filter((_, i) => i !== idx));

  const sum = payments.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const diff = Number(totalValue) - sum;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className={compact ? 'text-xs' : ''}>Formas de Pagamento</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {payments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhuma forma de pagamento adicionada. Clique em "Adicionar".</p>
      ) : (
        <div className="space-y-2">
          {payments.map((p, idx) => (
            <div key={idx} className={`flex items-end gap-2 rounded-lg border border-border bg-muted/30 ${compact ? 'p-2' : 'p-3'}`}>
              <div className="flex-1 min-w-0">
                <Label className="text-[10px] text-muted-foreground">Forma</Label>
                <Select value={p.method || 'pix'} onValueChange={v => update(idx, 'method', v)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                <Input type="number" min={0} step="0.01" className="h-8 text-sm" value={p.value || 0} onChange={e => update(idx, 'value', e.target.value)} />
              </div>
              <div className="w-20">
                <Label className="text-[10px] text-muted-foreground">Parcelas</Label>
                <Input type="number" min={1} className="h-8 text-sm" value={p.installments || 1} onChange={e => update(idx, 'installments', e.target.value)} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(idx)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {payments.length > 0 && Number(totalValue) > 0 && (
        <div className={`flex justify-between text-xs pt-1 border-t border-border ${Math.abs(diff) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
          <span>Total pago: R$ {sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <span>{Math.abs(diff) < 0.01 ? '✓ Valor completo' : `Faltam: R$ ${Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
        </div>
      )}
    </div>
  );
}