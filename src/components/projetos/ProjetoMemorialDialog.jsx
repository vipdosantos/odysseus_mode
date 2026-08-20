import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { computeVigotas, computeEscoras } from '@/lib/projetoCalculos';
import { computeEstrutural, pesoProprio, cargaTotal } from '@/lib/projetoEstrutural';

export default function ProjetoMemorialDialog({
  open, onOpenChange, projeto, slabs, annotations, scalePxPerM, escoraCfg
}) {
  const est = computeEstrutural(slabs, annotations, scalePxPerM);
  const totalArea = slabs.filter(s => !s.negativo).reduce((a, s) => a + (s.area_m2 || 0), 0);
  const negArea = slabs.filter(s => s.negativo).reduce((a, s) => a + (s.area_m2 || 0), 0);
  const slabsPos = slabs.filter(s => !s.negativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Memorial de Cálculo — {projeto.name || 'Projeto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Resumo geral */}
          <div className="bg-gray-50 border border-border rounded-lg p-3 space-y-1">
            <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Resumo Geral</p>
            <div className="flex justify-between"><span>Cliente</span><span className="font-medium">{projeto.client_name || '-'}</span></div>
            <div className="flex justify-between"><span>Área total de laje</span><span className="font-medium">{totalArea.toFixed(2)} m²</span></div>
            {negArea > 0 && <div className="flex justify-between text-destructive"><span>Aberturas (vãos)</span><span className="font-medium">- {negArea.toFixed(2)} m²</span></div>}
            <div className="flex justify-between"><span>Área líquida</span><span className="font-medium">{(totalArea - negArea).toFixed(2)} m²</span></div>
          </div>

          {/* Cargas */}
          <div className="bg-gray-50 border border-border rounded-lg p-3 space-y-1">
            <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Cargas</p>
            <div className="flex justify-between"><span>Carga média (peso + revest. + sobrecarga)</span><span className="font-medium">{est.cargaMedia_kN_m2.toFixed(2)} kN/m²</span></div>
            <div className="flex justify-between"><span>Peso total da estrutura</span><span className="font-medium">{est.pesoTotal_kN.toFixed(2)} kN</span></div>
            <div className="text-[11px] text-muted-foreground pt-1">
              Sobrecarga mínima: 2.0 kN/m² (NBR 6120) • Revestimento: 1.0 kN/m²
            </div>
          </div>

          {/* Materiais */}
          <div className="bg-gray-50 border border-border rounded-lg p-3 space-y-1">
            <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Quantitativo de Materiais</p>
            <div className="flex justify-between"><span>Aço da treliça</span><span className="font-medium">{est.acoTrelica_kg.toFixed(1)} kg</span></div>
            <div className="flex justify-between"><span>Aço de negativos</span><span className="font-medium">{est.acoNegativos_kg.toFixed(1)} kg</span></div>
            <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Aço total</span><span>{est.acoTotal_kg.toFixed(1)} kg</span></div>
            <div className="flex justify-between"><span>Concreto (capa)</span><span className="font-medium">{est.concreto_m3.toFixed(2)} m³</span></div>
          </div>

          {/* Detalhe por laje */}
          <div>
            <p className="font-semibold text-xs uppercase text-muted-foreground mb-2">Detalhe por Laje</p>
            <div className="space-y-2">
              {slabsPos.map(s => {
                const vig = computeVigotas(s, scalePxPerM);
                const esc = computeEscoras(s, scalePxPerM, escoraCfg || {});
                const peso = pesoProprio(s);
                const carga = cargaTotal(s);
                return (
                  <div key={s.id} className="border border-border rounded-lg p-2.5 space-y-1 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span>{s.label} — {s.truss_type || 'H8'} • {s.tipo_enchimento || 'Nenhum'}</span>
                      <span>{s.area_m2.toFixed(2)} m²</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                      <span>Peso próprio: <b className="text-foreground">{peso.toFixed(2)} kN/m²</b></span>
                      <span>Carga total: <b className="text-foreground">{carga.toFixed(2)} kN/m²</b></span>
                      <span>Vigotas: <b className="text-foreground">{vig.vt} un ({vig.totalLinearM.toFixed(1)} m)</b></span>
                      <span>Intereixo: <b className="text-foreground">{(vig.intereixoM || 0.42).toFixed(2)} m</b></span>
                      {esc.pontaletes > 0 && (
                        <>
                          <span>Linhas de escora: <b className="text-foreground">{esc.linhas}</b></span>
                          <span>Pontaletes: <b className="text-foreground">{esc.pontaletes} un</b></span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}