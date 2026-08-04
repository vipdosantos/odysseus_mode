import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ProjetoCanvas, { polygonAreaM2 } from '@/components/projetos/ProjetoCanvas';
import ProjetoLeftPanel from '@/components/projetos/ProjetoLeftPanel';
import ProjetoRelatorio from '@/components/projetos/ProjetoRelatorio';

const newProjeto = () => ({
  name: 'Novo Projeto',
  client_name: '',
  floor_plan_url: '',
  scale_px_per_m: 100,
  floor_plan_opacity: 0.5,
  slabs: [],
  total_area_m2: 0
});

export default function Projetos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [projeto, setProjeto] = useState(newProjeto());
  const [slabs, setSlabs] = useState([]);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [tool, setTool] = useState('vertices');
  const [selectedSlabId, setSelectedSlabId] = useState(null);
  const [scalePxPerM, setScalePxPerM] = useState(100);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.5);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] = useState(null);

  const { data: projetos = [] } = useQuery({
    queryKey: ['projetos'],
    queryFn: () => base44.entities.Projeto.list('-updated_date', 50)
  });

  const changeProjeto = useCallback((patch) => {
    setProjeto(prev => ({ ...prev, ...patch }));
  }, []);

  const loadProjeto = (p) => {
    setProjeto(p);
    setSlabs(p.slabs || []);
    setScalePxPerM(p.scale_px_per_m || 100);
    setFloorPlanOpacity(p.floor_plan_opacity ?? 0.5);
    setGeneratedOrderId(p.order_id || null);
    setDrawingPoints([]);
    setSelectedSlabId(null);
  };

  const newProj = () => {
    setProjeto(newProjeto());
    setSlabs([]);
    setDrawingPoints([]);
    setSelectedSlabId(null);
    setGeneratedOrderId(null);
    setScalePxPerM(100);
    setFloorPlanOpacity(0.5);
  };

  // Add vertex while drawing
  const addPoint = (pt) => {
    setDrawingPoints(prev => [...prev, pt]);
  };

  // Finish current drawing polygon
  const finishDrawing = () => {
    if (drawingPoints.length < 3) {
      setDrawingPoints([]);
      return;
    }
    const area = polygonAreaM2(drawingPoints, scalePxPerM);
    const id = `slab_${Date.now()}`;
    const labelNum = slabs.length + 1;
    const newSlab = {
      id,
      label: `L${labelNum}`,
      vertices: drawingPoints,
      area_m2: area,
      tipo_laje: 'Laje',
      tipo_enchimento: 'Nenhum',
      truss_type: 'H8'
    };
    setSlabs(prev => [...prev, newSlab]);
    setDrawingPoints([]);
  };

  const updateSlab = (id, patch) => {
    setSlabs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const deleteSlab = (id) => {
    setSlabs(prev => prev.filter(s => s.id !== id));
    if (selectedSlabId === id) setSelectedSlabId(null);
  };

  // Upload floor plan
  const uploadPlan = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      changeProjeto({ floor_plan_url: file_url });
      toast({ title: 'Planta importada' });
    } catch (e) {
      toast({ title: 'Erro ao importar planta', variant: 'destructive' });
    }
  };

  // Save projeto
  const saveProjeto = async () => {
    setSaving(true);
    try {
      const total = slabs.reduce((a, s) => a + (s.area_m2 || 0), 0);
      const payload = {
        name: projeto.name,
        client_name: projeto.client_name,
        floor_plan_url: projeto.floor_plan_url,
        scale_px_per_m: scalePxPerM,
        floor_plan_opacity: floorPlanOpacity,
        slabs,
        total_area_m2: total,
        order_id: generatedOrderId
      };
      if (projeto.id) {
        await base44.entities.Projeto.update(projeto.id, payload);
      } else {
        const created = await base44.entities.Projeto.create(payload);
        setProjeto(prev => ({ ...prev, id: created.id }));
      }
      await qc.invalidateQueries({ queryKey: ['projetos'] });
      toast({ title: 'Projeto salvo' });
    } catch (e) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Generate orçamento (Order with tipo=orcamento)
  const generateOrcamento = async () => {
    setGenerating(true);
    try {
      const order_number = `ORC-${Date.now().toString().slice(-6)}`;
      const total = slabs.reduce((a, s) => a + (s.area_m2 || 0), 0);
      const items = slabs.map(s => ({
        size: s.label,
        truss_type: s.truss_type || 'H8',
        quantity: 1,
        unit_price: 0,
        produced: 0,
        scanned_units: [],
        delivered_units: [],
        loaded_units: [],
        stage_conferencias: {}
      }));
      const order = await base44.entities.Order.create({
        order_number,
        client_name: projeto.client_name || 'Cliente',
        tipo: 'orcamento',
        items,
        total_value: 0,
        notes: `Projeto: ${projeto.name} | Área total: ${total.toFixed(2)}m²`
      });
      setGeneratedOrderId(order.id);
      if (projeto.id) {
        await base44.entities.Projeto.update(projeto.id, { order_id: order.id });
      }
      await qc.invalidateQueries({ queryKey: ['projetos'] });
      toast({ title: 'Orçamento gerado', description: order_number });
    } catch (e) {
      toast({ title: 'Erro ao gerar orçamento', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-border px-4 py-2 flex items-center gap-3">
        <h1 className="text-base font-semibold">Projetos de Laje</h1>
        <span className="text-xs text-muted-foreground">Desenhe as lajes sobre a planta e gere o orçamento</span>
      </div>

      <div className="flex-1 flex min-h-0">
        <ProjetoLeftPanel
          projeto={projeto}
          onChangeProjeto={changeProjeto}
          slabs={slabs}
          selectedSlabId={selectedSlabId}
          onSelectSlab={setSelectedSlabId}
          tool={tool}
          setTool={setTool}
          floorPlanOpacity={floorPlanOpacity}
          setFloorPlanOpacity={setFloorPlanOpacity}
          scalePxPerM={scalePxPerM}
          setScalePxPerM={setScalePxPerM}
          onUploadPlan={uploadPlan}
          onNewProjeto={newProj}
          onSave={saveProjeto}
          saving={saving}
          projetos={projetos}
          onLoadProjeto={loadProjeto}
        />

        <div className="flex-1 min-w-0">
          <ProjetoCanvas
            slabs={slabs}
            drawingPoints={drawingPoints}
            onAddPoint={addPoint}
            onFinishDrawing={finishDrawing}
            onSelectSlab={setSelectedSlabId}
            selectedSlabId={selectedSlabId}
            floorPlanUrl={projeto.floor_plan_url}
            floorPlanOpacity={floorPlanOpacity}
            scalePxPerM={scalePxPerM}
            tool={tool}
          />
        </div>

        <ProjetoRelatorio
          projeto={projeto}
          slabs={slabs}
          onUpdateSlab={updateSlab}
          onDeleteSlab={deleteSlab}
          onGenerateOrcamento={generateOrcamento}
          generating={generating}
          generatedOrderId={generatedOrderId}
        />
      </div>
    </div>
  );
}