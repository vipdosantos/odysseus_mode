import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PanelLeft, PanelRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ProjetoCanvas, { polygonAreaM2 } from '@/components/projetos/ProjetoCanvas';
import ProjetoLeftPanel from '@/components/projetos/ProjetoLeftPanel';
import ProjetoRelatorio from '@/components/projetos/ProjetoRelatorio';
import ProjetoToolbar from '@/components/projetos/ProjetoToolbar';
import ProjetoAtalhosDialog from '@/components/projetos/ProjetoAtalhosDialog';
import ProjetoNegativoDialog from '@/components/projetos/ProjetoNegativoDialog';
import ProjetoMemorialDialog from '@/components/projetos/ProjetoMemorialDialog';
import ProjetoExportDialog from '@/components/projetos/ProjetoExportDialog';
import { computeVt } from '@/lib/projetoSnap';
import { computeVigotas } from '@/lib/projetoCalculos';

const newProjeto = () => ({
  name: 'Novo Projeto', client_name: '', floor_plan_url: '',
  scale_px_per_m: 100, floor_plan_opacity: 0.5, show_grid: true, plano_escoras: false,
  slabs: [], cotas: [], textos: [], annotations: [], total_area_m2: 0
});

const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function generateAccessKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 16 }, (_, i) =>
    (i > 0 && i % 4 === 0 ? '-' : '') + chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export default function Projetos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [projeto, setProjeto] = useState(newProjeto());
  const [slabs, setSlabs] = useState([]);
  const [cotas, setCotas] = useState([]);
  const [textos, setTextos] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [tool, setTool] = useState('vertices');
  const [selectedSlabId, setSelectedSlabId] = useState(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [scalePxPerM, setScalePxPerM] = useState(100);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.5);
  const [showGrid, setShowGrid] = useState(true);
  const [ortoAtivo, setOrtoAtivo] = useState(false);
  const [contornoAtivo, setContornoAtivo] = useState(false);
  const [nucleosAtivo, setNucleosAtivo] = useState(false);
  const [activeColor, setActiveColor] = useState(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] = useState(null);
  const [history, setHistory] = useState([]);
  const [atalhosAberto, setAtalhosAberto] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [negativoDialogOpen, setNegativoDialogOpen] = useState(false);
  const [memorialOpen, setMemorialOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const canvasRef = useRef(null);
  const [negativoParams, setNegativoParams] = useState({
    tipo_aco: 'CA50', bitola: '8.0', quantidade: 10, espacamento: 15,
    acabamento: 'com_dobra', igualar_dobras: true, dobra_esq: 10, dobra_dir: 10
  });

  useEffect(() => {
    if (tool === 'negativo') setNegativoDialogOpen(true);
  }, [tool]);

  const { data: projetos = [] } = useQuery({
    queryKey: ['projetos'],
    queryFn: () => base44.entities.Projeto.list('-updated_date', 50)
  });

  const changeProjeto = useCallback((patch) => setProjeto(prev => ({ ...prev, ...patch })), []);

  const panRef = useRef(panOffset); panRef.current = panOffset;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const handleZoom = useCallback((factor, sx, sy) => {
    const prev = zoomRef.current;
    const next = Math.max(0.1, Math.min(10, prev * factor));
    const ox = panRef.current.x, oy = panRef.current.y;
    const wx = (sx - ox) / prev;
    const wy = (sy - oy) / prev;
    setPanOffset({ x: sx - wx * next, y: sy - wy * next });
    setZoom(next);
  }, []);

  const pushHistory = () => {
    setHistory(prev => [...prev.slice(-19), { slabs, cotas, textos, annotations }]);
  };

  const loadProjeto = (p) => {
    setProjeto(p);
    setSlabs(p.slabs || []); setCotas(p.cotas || []); setTextos(p.textos || []); setAnnotations(p.annotations || []);
    setScalePxPerM(p.scale_px_per_m || 100); setFloorPlanOpacity(p.floor_plan_opacity ?? 0.5);
    setShowGrid(p.show_grid !== false); setGeneratedOrderId(p.order_id || null);
    setDrawingPoints([]); setSelectedSlabId(null); setSelectedAnnotationId(null); setHistory([]);
    setZoom(1); setPanOffset({ x: 0, y: 0 });
  };

  const newProj = () => {
    setProjeto(newProjeto()); setSlabs([]); setCotas([]); setTextos([]); setAnnotations([]);
    setDrawingPoints([]); setSelectedSlabId(null); setSelectedAnnotationId(null); setGeneratedOrderId(null);
    setScalePxPerM(100); setFloorPlanOpacity(0.5); setShowGrid(true); setHistory([]);
    setZoom(1); setPanOffset({ x: 0, y: 0 });
  };

  const addPoint = (pt) => setDrawingPoints(prev => [...prev, pt]);

  const finishDrawing = () => {
    if (drawingPoints.length < 3) { setDrawingPoints([]); return; }
    pushHistory();
    const area = polygonAreaM2(drawingPoints, scalePxPerM);
    const id = uid('slab'); const labelNum = slabs.length + 1;
    setSlabs(prev => [...prev, { id, label: `L${labelNum}`, vertices: drawingPoints, area_m2: area, negativo: false, tipo_laje: 'Laje', tipo_enchimento: 'Nenhum', truss_type: 'H8' }]);
    setDrawingPoints([]);
  };

  const addSlabRect = (vertices) => {
    pushHistory();
    const area = polygonAreaM2(vertices, scalePxPerM);
    const id = uid('slab'); const labelNum = slabs.length + 1;
    setSlabs(prev => [...prev, { id, label: `L${labelNum}`, vertices, area_m2: area, negativo: false, tipo_laje: 'Laje', tipo_enchimento: 'Nenhum', truss_type: 'H8' }]);
  };

  const updateSlab = (id, patch) => setSlabs(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const setDirection = (id, direction) => {
    setSlabs(prev => prev.map(s => {
      if (s.id !== id) return s;
      const vig = computeVigotas({ ...s, direction }, scalePxPerM);
      return { ...s, direction, vt: vig.vt };
    }));
  };

  const deleteSlab = (id) => {
    pushHistory();
    setSlabs(prev => prev.filter(s => s.id !== id));
    if (selectedSlabId === id) setSelectedSlabId(null);
  };

  const moveSlab = (id, dx, dy) => {
    setSlabs(prev => prev.map(s => {
      if (s.id !== id) return s;
      const moved = { ...s, vertices: s.vertices.map(v => ({ x: v.x + dx, y: v.y + dy })) };
      if (s.direction) {
        moved.direction = {
          x1: s.direction.x1 + dx, y1: s.direction.y1 + dy,
          x2: s.direction.x2 + dx, y2: s.direction.y2 + dy
        };
      }
      return moved;
    }));
  };

  // Espelho: mirror selected slab horizontally around its centroid
  const espelhar = () => {
    if (!selectedSlabId) return;
    pushHistory();
    setSlabs(prev => prev.map(s => {
      if (s.id !== selectedSlabId) return s;
      const cx = s.vertices.reduce((a, v) => a + v.x, 0) / s.vertices.length;
      return { ...s, vertices: s.vertices.map(v => ({ x: 2 * cx - v.x, y: v.y })) };
    }));
  };

  // Girar: rotate selected slab 90° around centroid
  const girar = () => {
    if (!selectedSlabId) return;
    pushHistory();
    setSlabs(prev => prev.map(s => {
      if (s.id !== selectedSlabId) return s;
      const cx = s.vertices.reduce((a, v) => a + v.x, 0) / s.vertices.length;
      const cy = s.vertices.reduce((a, v) => a + v.y, 0) / s.vertices.length;
      const cos = 0, sin = 1;
      return { ...s, vertices: s.vertices.map(v => ({ x: cx + (v.x - cx) * cos - (v.y - cy) * sin, y: cy + (v.x - cx) * sin + (v.y - cy) * cos })) };
    }));
  };

  // Copiar: duplicate selected slab, offset
  const copiar = () => {
    if (!selectedSlabId) return;
    pushHistory();
    setSlabs(prev => {
      const orig = prev.find(s => s.id === selectedSlabId);
      if (!orig) return prev;
      const id = uid('slab'); const labelNum = prev.length + 1;
      const copy = { ...orig, id, label: `L${labelNum}`, vertices: orig.vertices.map(v => ({ x: v.x + 24, y: v.y + 24 })) };
      return [...prev, copy];
    });
  };

  // Ajuste Borda: snap selected slab vertices to nearest grid
  const ajusteBorda = () => {
    if (!selectedSlabId) return;
    pushHistory();
    const g = Math.max(10, scalePxPerM);
    setSlabs(prev => prev.map(s => {
      if (s.id !== selectedSlabId) return s;
      const snapped = s.vertices.map(v => ({ x: Math.round(v.x / g) * g, y: Math.round(v.y / g) * g }));
      return { ...s, vertices: snapped, area_m2: polygonAreaM2(snapped, scalePxPerM) };
    }));
  };

  const addCota = (c) => { pushHistory(); setCotas(prev => [...prev, c]); };
  const addTexto = (p) => {
    const text = window.prompt('Texto da etiqueta:', '');
    if (!text) return; pushHistory(); setTextos(prev => [...prev, { x: p.x, y: p.y, text }]);
  };
  const addAnnotation = (a) => { pushHistory(); setAnnotations(prev => [...prev, { id: uid('ann'), ...a }]); };
  const deleteAnnotation = (id) => {
    pushHistory();
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const undo = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setSlabs(last.slabs); setCotas(last.cotas); setTextos(last.textos); setAnnotations(last.annotations);
      setDrawingPoints([]); setSelectedSlabId(null); setSelectedAnnotationId(null);
      return prev.slice(0, -1);
    });
  };

  const deleteSelected = () => {
    if (selectedAnnotationId) deleteAnnotation(selectedAnnotationId);
    else if (selectedSlabId) deleteSlab(selectedSlabId);
  };

  // Motor: recalcula vigotas (vt) e área de todas as lajes com direção definida
  const motor = () => {
    setSlabs(prev => prev.map(s => {
      if (!s.direction) return s;
      const vig = computeVigotas(s, scalePxPerM);
      return { ...s, vt: vig.vt, area_m2: polygonAreaM2(s.vertices, scalePxPerM) };
    }));
    toast({ title: 'Motor de cálculo', description: 'Vigotas e áreas recalculadas para todas as lajes com direção.' });
  };

  const escolherCor = () => {
    const c = window.prompt('Cor para as próximas linhas (hex, ex: #ef4444):', activeColor || '#111827');
    if (c) setActiveColor(c);
  };
  const ajuda = () => toast({ title: 'Ajuda', description: 'Selecione uma ferramenta, desenhe lajes/elementos sobre a planta, calibre a escala e gere o orçamento.' });
  const atalhos = () => setAtalhosAberto(true);
  const config = () => toast({ title: 'Configurações', description: 'Use o painel esquerdo para planta, escala e visualização.' });
  const ver3D = () => toast({ title: '3D', description: 'Visualização 3D em desenvolvimento.' });
  const exportar = () => setExportOpen(true);

  const calibrate = (pxDistance) => {
    const input = window.prompt('Distância real entre os dois pontos (em metros):', '1.00');
    if (!input) return;
    const meters = parseFloat(input.replace(',', '.'));
    if (!meters || meters <= 0) { toast({ title: 'Distância inválida', variant: 'destructive' }); return; }
    const newScale = pxDistance / meters;
    setScalePxPerM(newScale);
    toast({ title: 'Escala calibrada', description: `1 m = ${Math.round(newScale)} px` });
  };

  const reloadPlan = () => {
    if (!projeto.floor_plan_url) return;
    const url = projeto.floor_plan_url;
    changeProjeto({ floor_plan_url: '' });
    setTimeout(() => changeProjeto({ floor_plan_url: url }), 50);
    toast({ title: 'Planta recarregada' });
  };

  const saveProjeto = async () => {
    setSaving(true);
    try {
      const total = slabs.filter(s => !s.negativo).reduce((a, s) => a + (s.area_m2 || 0), 0);
      const payload = {
        name: projeto.name, client_name: projeto.client_name, floor_plan_url: projeto.floor_plan_url,
        scale_px_per_m: scalePxPerM, floor_plan_opacity: floorPlanOpacity, show_grid: showGrid,
        plano_escoras: projeto.plano_escoras, slabs, cotas, textos, annotations,
        total_area_m2: total, order_id: generatedOrderId
      };
      if (projeto.id) { await base44.entities.Projeto.update(projeto.id, payload); }
      else { const created = await base44.entities.Projeto.create(payload); setProjeto(prev => ({ ...prev, id: created.id })); }
      await qc.invalidateQueries({ queryKey: ['projetos'] });
      toast({ title: 'Projeto salvo' });
    } catch (e) { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const generateOrcamento = async () => {
    setGenerating(true);
    try {
      const order_number = `ORC-${Date.now().toString().slice(-6)}`;
      const total = slabs.filter(s => !s.negativo).reduce((a, s) => a + (s.area_m2 || 0), 0);
      const items = slabs.filter(s => !s.negativo).map(s => ({
        size: s.label, truss_type: s.truss_type || 'H8', quantity: 1, unit_price: 0,
        produced: 0, scanned_units: [], delivered_units: [], loaded_units: [], stage_conferencias: {}
      }));
      const order = await base44.entities.Order.create({
        order_number, client_name: projeto.client_name || 'Cliente', tipo: 'orcamento',
        items, total_value: 0, access_key: generateAccessKey(),
        notes: `Projeto: ${projeto.name} | Área total: ${total.toFixed(2)}m²`
      });
      setGeneratedOrderId(order.id);
      if (projeto.id) await base44.entities.Projeto.update(projeto.id, { order_id: order.id });
      await qc.invalidateQueries({ queryKey: ['projetos'] });
      toast({ title: 'Orçamento gerado', description: order_number });
    } catch (e) { toast({ title: 'Erro ao gerar orçamento', variant: 'destructive' }); }
    finally { setGenerating(false); }
  };

  const actionsRef = useRef({});
  actionsRef.current = { setTool, setOrtoAtivo, escolherCor, espelhar, copiar, undo, deleteSelected, toast, setAtalhosAberto, setSelectedSlabId, setSelectedAnnotationId, setDrawingPoints, selectedSlabId, selectedAnnotationId };
  useEffect(() => {
    const onKey = (e) => {
      const a = actionsRef.current;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); a.undo(); return; }
      if (e.key === 'Escape') { a.setSelectedSlabId(null); a.setSelectedAnnotationId(null); a.setDrawingPoints([]); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (a.selectedSlabId || a.selectedAnnotationId) { e.preventDefault(); a.deleteSelected(); } return; }
      if (e.key === '?') { a.setAtalhosAberto(true); return; }
      const k = e.key.toLowerCase();
      const map = {
        s: () => a.setTool('select'), l: () => a.setTool('linha'), r: () => a.setTool('retangulo'),
        d: () => a.setTool('tracejada'), t: () => a.setTool('texto'), v: () => a.setTool('direcao'),
        n: () => a.setTool('negativo'), p: () => a.setTool('pan'), g: () => a.setTool('vigota'),
        j: () => a.setTool('nervura'), w: () => a.setTool('mover'), o: () => a.setTool('circulo'),
        '0': () => { e.stopPropagation(); a.setOrtoAtivo(v => !v); }, h: () => a.escolherCor(),
        m: () => a.espelhar(), c: () => a.copiar(),
        b: () => a.toast({ title: 'Beiral', description: 'Ferramenta em desenvolvimento.' }),
        e: () => a.toast({ title: 'Deletar Vigota', description: 'Ferramenta em desenvolvimento.' }),
      };
      if (map[k]) { e.preventDefault(); map[k](); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <div className="shrink-0 bg-white border-b border-border px-4 py-2 flex items-center gap-3">
        <h1 className="text-base font-semibold">Projetos de Laje</h1>
        <span className="text-xs text-muted-foreground">Desenhe as lajes sobre a planta, calibre a escala e gere o orçamento</span>
      </div>

      <ProjetoToolbar
        tool={tool} setTool={setTool}
        ortoAtivo={ortoAtivo} onToggleOrto={() => setOrtoAtivo(v => !v)}
        contornoAtivo={contornoAtivo} onToggleContorno={() => setContornoAtivo(v => !v)}
        nucleosAtivo={nucleosAtivo} onToggleNucleos={() => setNucleosAtivo(v => !v)}
        onUndo={undo} onEspelho={espelhar} onGirar={girar} onCopiar={copiar}
        onAjusteBorda={ajusteBorda} onCores={escolherCor} onMotor={motor}
        onAjuda={ajuda} onExportar={exportar} on3D={ver3D} onAtalhos={atalhos} onConfig={config}
        onMemorial={() => setMemorialOpen(true)}
        hasSelection={!!selectedSlabId}
      />

      <div className="flex-1 flex min-h-0 relative">
        {/* Painel esquerdo — fixo no desktop, drawer no mobile */}
        <div className="hidden lg:block w-72 shrink-0">
          <ProjetoLeftPanel
            projeto={projeto} onChangeProjeto={changeProjeto} projetos={projetos}
            onLoadProjeto={loadProjeto} onNewProjeto={newProj} onSave={saveProjeto} saving={saving}
            floorPlanOpacity={floorPlanOpacity} setFloorPlanOpacity={setFloorPlanOpacity}
            onCalibrarClick={() => setTool('calibrar')} onReloadPlan={reloadPlan}
          />
        </div>
        {leftOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setLeftOpen(false)} />
            <div className="relative z-10 h-full w-[85%] max-w-xs">
              <ProjetoLeftPanel
                projeto={projeto} onChangeProjeto={changeProjeto} projetos={projetos}
                onLoadProjeto={(p) => { loadProjeto(p); setLeftOpen(false); }}
                onNewProjeto={() => { newProj(); setLeftOpen(false); }}
                onSave={saveProjeto} saving={saving}
                floorPlanOpacity={floorPlanOpacity} setFloorPlanOpacity={setFloorPlanOpacity}
                onCalibrarClick={() => { setTool('calibrar'); setLeftOpen(false); }}
                onReloadPlan={reloadPlan}
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <ProjetoCanvas
            slabs={slabs} drawingPoints={drawingPoints} onAddPoint={addPoint}
            onFinishDrawing={finishDrawing} onSelectSlab={setSelectedSlabId}
            selectedSlabId={selectedSlabId} floorPlanUrl={projeto.floor_plan_url}
            floorPlanOpacity={floorPlanOpacity} scalePxPerM={scalePxPerM} tool={tool}
            cotas={cotas} textos={textos} annotations={annotations}
            showGrid={showGrid} contornoAtivo={contornoAtivo} ortoAtivo={ortoAtivo} activeColor={activeColor}
            panOffset={panOffset} onPan={setPanOffset}
            zoom={zoom} onZoom={handleZoom}
            onAddSlabRect={addSlabRect} onAddCota={addCota} onAddTexto={addTexto}
            onAddAnnotation={addAnnotation}
            onCalibrate={calibrate} onMoveSlab={moveSlab} onSetDirection={setDirection}
            selectedAnnotationId={selectedAnnotationId} onSelectAnnotation={setSelectedAnnotationId}
            externalRef={canvasRef}
            nucleosAtivo={nucleosAtivo}
            negativoParams={negativoParams}
            onOpenNegativoDialog={() => setNegativoDialogOpen(true)}
            planoEscoras={!!projeto.plano_escoras}
            escoraCfg={{ escoraEspacamentoM: projeto.escora_espacamento_m ?? 1, pontaleteEspacamentoM: projeto.pontalete_espacamento_m ?? 1 }}
          />
        </div>

        {/* Painel direito — fixo no desktop, drawer no mobile */}
        <div className="hidden lg:block w-80 shrink-0">
          <ProjetoRelatorio
            projeto={projeto} slabs={slabs} annotations={annotations} onUpdateSlab={updateSlab}
            onDeleteSlab={deleteSlab} onGenerateOrcamento={generateOrcamento}
            generating={generating} generatedOrderId={generatedOrderId}
            scalePxPerM={scalePxPerM}
            escoraCfg={{ escoraEspacamentoM: projeto.escora_espacamento_m ?? 1, pontaleteEspacamentoM: projeto.pontalete_espacamento_m ?? 1 }}
          />
        </div>
        {rightOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setRightOpen(false)} />
            <div className="relative z-10 h-full w-[85%] max-w-xs">
              <ProjetoRelatorio
                projeto={projeto} slabs={slabs} annotations={annotations} onUpdateSlab={updateSlab}
                onDeleteSlab={deleteSlab} onGenerateOrcamento={(...args) => { setRightOpen(false); generateOrcamento(...args); }}
                generating={generating} generatedOrderId={generatedOrderId}
                scalePxPerM={scalePxPerM}
                escoraCfg={{ escoraEspacamentoM: projeto.escora_espacamento_m ?? 1, pontaleteEspacamentoM: projeto.pontalete_espacamento_m ?? 1 }}
              />
            </div>
          </div>
        )}

        {/* Botões flutuantes para abrir os painéis no mobile */}
        <button
          onClick={() => setLeftOpen(true)}
          className="lg:hidden absolute top-2 left-2 z-30 flex items-center gap-1 bg-white border border-border rounded-md shadow px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <PanelLeft className="w-4 h-4" /> Projeto
        </button>
        <button
          onClick={() => setRightOpen(true)}
          className="lg:hidden absolute top-2 right-2 z-30 flex items-center gap-1 bg-white border border-border rounded-md shadow px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <PanelRight className="w-4 h-4" /> Lajes
        </button>
      </div>

      <ProjetoAtalhosDialog open={atalhosAberto} onOpenChange={setAtalhosAberto} />

      <ProjetoNegativoDialog
        open={negativoDialogOpen}
        onOpenChange={setNegativoDialogOpen}
        params={negativoParams}
        onConfirm={(p) => { setNegativoParams(p); setNegativoDialogOpen(false); }}
      />

      <ProjetoMemorialDialog
        open={memorialOpen}
        onOpenChange={setMemorialOpen}
        projeto={projeto}
        slabs={slabs}
        annotations={annotations}
        scalePxPerM={scalePxPerM}
        escoraCfg={{ escoraEspacamentoM: projeto.escora_espacamento_m ?? 1, pontaleteEspacamentoM: projeto.pontalete_espacamento_m ?? 1 }}
      />

      <ProjetoExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        projeto={projeto}
        canvasRef={canvasRef}
        dados={{ slabs, annotations, cotas, textos, scalePxPerM, escoraCfg: { escoraEspacamentoM: projeto.escora_espacamento_m ?? 1, pontaleteEspacamentoM: projeto.pontalete_espacamento_m ?? 1 } }}
      />
    </div>
  );
}