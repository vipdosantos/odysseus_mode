import React, { useRef } from 'react';
import { Upload, Trash2, Save, Plus, FolderOpen, MousePointer2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { base44 } from '@/api/base44Client';

const TIPO_LAJE_OPTS = ['Laje', 'Painel', 'Mista', 'Laje Treliçada Intereixo'];
const TIPO_ENCH_OPTS = ['Nenhum', 'EPS', 'Lajota', 'EPS+Lajota'];

export default function ProjetoLeftPanel({
  projeto, onChangeProjeto, slabs, selectedSlabId, onSelectSlab,
  tool, setTool, floorPlanOpacity, setFloorPlanOpacity, scalePxPerM, setScalePxPerM,
  onUploadPlan, onNewProjeto, onSave, saving, projetos, onLoadProjeto
}) {
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUploadPlan(file);
    e.target.value = '';
  };

  return (
    <div className="w-72 shrink-0 bg-gray-50 border-r border-border overflow-y-auto p-4 space-y-5">
      {/* Projeto header */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Projeto</p>
        <Input
          className="mt-1 font-semibold"
          value={projeto.name || ''}
          onChange={(e) => onChangeProjeto({ name: e.target.value })}
          placeholder="Nome do projeto"
        />
        <Input
          className="mt-2"
          value={projeto.client_name || ''}
          onChange={(e) => onChangeProjeto({ client_name: e.target.value })}
          placeholder="Cliente"
        />
      </div>

      {/* Projetos salvos */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Projetos salvos</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {projetos.map(p => (
            <button
              key={p.id}
              onClick={() => onLoadProjeto(p)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded border ${projeto.id === p.id ? 'bg-primary/10 border-primary' : 'bg-white border-border hover:bg-gray-100'}`}
            >
              {p.name} <span className="text-muted-foreground">— {p.client_name || 's/ cliente'}</span>
            </button>
          ))}
          {projetos.length === 0 && <p className="text-xs text-muted-foreground px-1">Nenhum projeto.</p>}
        </div>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onNewProjeto}>
            <Plus className="w-4 h-4" /> Novo
          </Button>
          <Button size="sm" variant="outline" onClick={onSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Ferramentas */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ferramentas</p>
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            variant={tool === 'vertices' ? 'default' : 'outline'}
            onClick={() => setTool('vertices')}
          >
            <PenLine className="w-4 h-4" /> Laje por Vértices
          </Button>
          <Button
            size="sm"
            variant={tool === 'select' ? 'default' : 'outline'}
            onClick={() => setTool('select')}
          >
            <MousePointer2 className="w-4 h-4" /> Selecionar
          </Button>
        </div>
      </div>

      {/* Planta de fundo */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Planta de fundo</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <Button size="sm" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> Importar planta
        </Button>
        <div className="mt-2">
          <Label className="text-xs">Opacidade: {Math.round(floorPlanOpacity * 100)}%</Label>
          <Slider
            value={[Math.round(floorPlanOpacity * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => setFloorPlanOpacity(v[0] / 100)}
            className="mt-1"
          />
        </div>
        <div className="mt-2">
          <Label className="text-xs">Calibrar escala (px por metro)</Label>
          <Input
            type="number"
            value={Math.round(scalePxPerM)}
            onChange={(e) => setScalePxPerM(Number(e.target.value) || 100)}
            className="mt-1"
          />
        </div>
        {projeto.floor_plan_url && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full mt-2 text-destructive"
            onClick={() => onChangeProjeto({ floor_plan_url: '' })}
          >
            <Trash2 className="w-4 h-4" /> Remover planta
          </Button>
        )}
      </div>
    </div>
  );
}