import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';

const BITOLAS = ['5.0', '6.3', '8.0', '10.0', '12.5'];

export default function ProjetoNegativoDialog({ open, onOpenChange, params, onConfirm }) {
  const [form, setForm] = useState(params || {
    tipo_aco: 'CA50', bitola: '8.0', quantidade: 10, espacamento: 15,
    acabamento: 'com_dobra', igualar_dobras: true, dobra_esq: 10, dobra_dir: 10
  });

  useEffect(() => { if (open) setForm(params); }, [open, params]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleEqualar = (checked) => {
    set('igualar_dobras', checked);
    if (checked) set('dobra_dir', form.dobra_esq);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-left">Negativo</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Tipo de Aço */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#1A1D24]">Tipo de Aço</Label>
            <RadioGroup
              value={form.tipo_aco}
              onValueChange={(v) => set('tipo_aco', v)}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="CA50" id="aco-ca50" />
                <Label htmlFor="aco-ca50" className="text-sm font-normal cursor-pointer">CA50</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="CA60" id="aco-ca60" />
                <Label htmlFor="aco-ca60" className="text-sm font-normal cursor-pointer">CA60</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Bitola */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#1A1D24]">Bitola (mm)</Label>
            <Select value={form.bitola} onValueChange={(v) => set('bitola', v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BITOLAS.map(b => <SelectItem key={b} value={b}>{b.replace('.', ',')} mm</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#1A1D24]">quantidade</Label>
            <Input
              type="number"
              value={form.quantidade}
              onChange={(e) => set('quantidade', +e.target.value)}
              className="h-9"
            />
          </div>

          {/* Espaçamento */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#1A1D24]">Espaçamento (cm)</Label>
            <Input
              type="number"
              value={form.espacamento}
              onChange={(e) => set('espacamento', +e.target.value)}
              className="h-9"
            />
          </div>

          {/* Comprimento (Automático) */}
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-[#1A1D24]">Comprimento (m)</Label>
            <Input
              readOnly
              placeholder="Automático"
              className="h-9 bg-gray-50 text-[#A0AEC0] cursor-not-allowed"
            />
          </div>

          {/* Acabamento das Pontas */}
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs text-[#1A1D24]">Acabamento das Pontas</Label>
            <RadioGroup
              value={form.acabamento}
              onValueChange={(v) => set('acabamento', v)}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="reto" id="acab-reto" />
                <Label htmlFor="acab-reto" className="text-sm font-normal cursor-pointer">Reto</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="com_dobra" id="acab-dobra" />
                <Label htmlFor="acab-dobra" className="text-sm font-normal cursor-pointer">Com Dobra</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Igualar dobras */}
          {form.acabamento === 'com_dobra' && (
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                id="igualar-dobras"
                checked={form.igualar_dobras}
                onCheckedChange={handleEqualar}
              />
              <Label htmlFor="igualar-dobras" className="text-sm font-normal cursor-pointer">Igualar dobras</Label>
            </div>
          )}

          {/* Dobras */}
          {form.acabamento === 'com_dobra' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1A1D24]">Dobra Esq. (cm)</Label>
                <Input
                  type="number"
                  value={form.dobra_esq}
                  onChange={(e) => {
                    set('dobra_esq', +e.target.value);
                    if (form.igualar_dobras) set('dobra_dir', +e.target.value);
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#1A1D24]">Dobra Dir. (cm)</Label>
                <Input
                  type="number"
                  value={form.dobra_dir}
                  disabled={form.igualar_dobras}
                  onChange={(e) => set('dobra_dir', +e.target.value)}
                  className="h-9"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(form)} className="bg-[#121926] hover:bg-[#121926]/90 text-white">Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}