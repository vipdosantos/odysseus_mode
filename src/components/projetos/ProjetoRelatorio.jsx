import React from 'react';
import { FileText, Trash2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';

const TRUSS_OPTS = ['H8', 'H12', 'H16', 'H20', 'H25', 'H30'];
const TIPO_LAJE_OPTS = ['Laje', 'Painel', 'Mista', 'Laje Treliçada Intereixo'];
const TIPO_ENCH_OPTS = ['Nenhum', 'EPS', 'Lajota', 'EPS+Lajota'];

export default function ProjetoRelatorio({
  projeto, slabs, annotations, onUpdateSlab, onDeleteSlab, onGenerateOrcamento, generating, generatedOrderId
}) {
  const totalArea = slabs.filter(s => !s.negativo).reduce((a, s) => a + (s.area_m2 || 0), 0);
  const negativoArea = slabs.filter(s => s.negativo).reduce((a, s) => a + (s.area_m2 || 0), 0);
  const negBars = (annotations || []).filter(a => a.type === 'negativo');
  const negBarTotalLen = negBars.reduce((a, b) => a + (b.comprimento || 0), 0);

  return (
    <div className="w-80 shrink-0 bg-gray-50 border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Relatório</p>
          <p className="text-sm font-semibold">{projeto.name || 'Sem nome'}</p>
        </div>
        <Maximize2 className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {slabs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8">
            Desenhe lajes na tela para vê-las aqui.
          </p>
        )}
        {slabs.map(slab => (
          <div key={slab.id} className="bg-white border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{slab.label}{slab.negativo && <span className="text-destructive"> (Neg)</span>}</span>
              <span className={`text-sm font-semibold ${slab.negativo ? 'text-destructive' : 'text-primary'}`}>
                {slab.area_m2.toFixed(2)} m²{!slab.negativo && slab.vt ? ` • ${slab.vt}vt` : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Tipo de laje</label>
                <Select
                  value={slab.tipo_laje}
                  onValueChange={(v) => onUpdateSlab(slab.id, { tipo_laje: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_LAJE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Enchimento</label>
                <Select
                  value={slab.tipo_enchimento}
                  onValueChange={(v) => onUpdateSlab(slab.id, { tipo_enchimento: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_ENCH_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-muted-foreground">Treliça</label>
                <Select
                  value={slab.truss_type || ''}
                  onValueChange={(v) => onUpdateSlab(slab.id, { truss_type: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TRUSS_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-destructive h-7"
              onClick={() => onDeleteSlab(slab.id)}
            >
              <Trash2 className="w-3.5 h-3.5" /> Remover laje
            </Button>
          </div>
        ))}

        {negBars.length > 0 && (
          <div className="bg-white border border-purple-200 rounded-lg p-3 space-y-1">
            <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">Negativos (barras de aço)</p>
            {negBars.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span>{b.tipo_aco || ''} Ø{b.bitola || b.diametro || '8.0'} • {b.quantidade || 0}x • e{b.espacamento || 0}cm{b.acabamento === 'com_dobra' ? ' • c/ dobra' : ''}</span>
                <span className="font-semibold">{(b.comprimento || 0).toFixed(2)} m</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-100">
              <span className="font-semibold">Total ({negBars.length} barras)</span>
              <span className="font-semibold">{negBarTotalLen.toFixed(2)} m</span>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t border-border p-3 bg-white space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Orçado (Resumo)</p>
        <div className="flex justify-between text-sm">
          <span>Área total</span>
          <span className="font-semibold">{totalArea.toFixed(2)} m²</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Lajes</span>
          <span className="font-semibold">{slabs.length}</span>
        </div>
        {negativoArea > 0 && (
          <div className="flex justify-between text-sm text-destructive">
            <span>Aberturas (vãos)</span>
            <span className="font-semibold">- {negativoArea.toFixed(2)} m²</span>
          </div>
        )}
        {generatedOrderId ? (
          <Button size="sm" className="w-full" variant="outline" asChild>
            <a href={`/orcamentos`}>Orçamento gerado — ver</a>
          </Button>
        ) : (
          <Button size="sm" className="w-full" onClick={onGenerateOrcamento} disabled={generating || slabs.length === 0}>
            <FileText className="w-4 h-4" /> {generating ? 'Gerando...' : 'Gerar Orçamento'}
          </Button>
        )}
      </div>
    </div>
  );
}