import React, { useRef, useState } from 'react';
import { Upload, Trash2, Save, Plus, RefreshCw, Scale, Ruler, Type, Square, MousePointer2, PenLine, Move, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { convertPlanToPng } from '@/lib/projetoImport';

export default function ProjetoLeftPanel({
  projeto, onChangeProjeto, projetos, onLoadProjeto, onNewProjeto, onSave, saving,
  floorPlanOpacity, setFloorPlanOpacity, onCalibrarClick, onReloadPlan
}) {
  const fileRef = useRef(null);
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const png = await convertPlanToPng(file);
      let file_url;
      if (png) {
        // PDF/DXF convertido → envia o PNG
        const blob = await (await fetch(png)).blob();
        const pngFile = new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' });
        const res = await base44.integrations.Core.UploadFile({ file: pngFile });
        file_url = res.file_url;
      } else {
        // imagem comum
        const res = await base44.integrations.Core.UploadFile({ file });
        file_url = res.file_url;
      }
      onChangeProjeto({ floor_plan_url: file_url });
      toast({ title: 'Planta importada', description: file.name });
    } catch (err) {
      toast({ title: 'Erro ao importar planta', description: err?.message || '', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
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

      {/* Planta de fundo */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Planta de fundo</p>
        <input ref={fileRef} type="file" accept="image/*,.pdf,.dxf,.dwg" onChange={handleFile} className="hidden" />
        <Button size="sm" variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={importing}>
          <Upload className="w-4 h-4" /> {importing ? 'Importando...' : 'Importar planta'}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1">Formatos: imagem, PDF, DXF (AutoCAD). DWG deve ser convertido.</p>
        {projeto.floor_plan_url && (
          <Button size="sm" variant="outline" className="w-full mt-2" onClick={onReloadPlan}>
            <RefreshCw className="w-4 h-4" /> Recarregar planta
          </Button>
        )}
        <div className="mt-3">
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
        <Button size="sm" variant="outline" className="w-full mt-3" onClick={onCalibrarClick}>
          <Scale className="w-4 h-4" /> Calibrar Escala
        </Button>
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

      {/* Modo de visualização */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Modo de visualização</p>
        <div className="flex items-center justify-between bg-white border border-border rounded-md px-3 py-2">
          <Label className="text-xs font-medium cursor-pointer">Plano de Escoras</Label>
          <Switch
            checked={!!projeto.plano_escoras}
            onCheckedChange={(v) => onChangeProjeto({ plano_escoras: v })}
          />
        </div>
      </div>
    </div>
  );
}