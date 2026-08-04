import React from 'react';
import { cn } from '@/lib/utils';
import {
  MousePointer2, PenLine, Square, Ruler, Type, Undo2, Trash2, Grid3x3, Move, RotateCw,
  Minus, Slash, Spline, GitBranch, Ban, Lightbulb, Frame, Crosshair, Copy, FlipHorizontal2, Magnet,
  Circle, CircleDot
} from 'lucide-react';

const TOOLS = [
  { key: 'select', label: 'Seleção', icon: MousePointer2, kind: 'tool' },
  { key: 'linha', label: 'Linha', icon: Minus, kind: 'tool' },
  { key: 'tracejada', label: 'Tracejada', icon: Slash, kind: 'tool' },
  { key: 'retangulo', label: 'Lançar Laje', icon: Square, kind: 'tool' },
  { key: 'vigota', label: 'Lançar Vigota', icon: Spline, kind: 'tool' },
  { key: 'nervura', label: 'Incluir Nervura', icon: GitBranch, kind: 'tool' },
  { key: 'negativo', label: 'Negativo', icon: Ban, kind: 'tool' },
  { key: 'vertices', label: 'Laje Vértices', icon: PenLine, kind: 'tool' },
  { key: 'ponto_luz', label: 'Ponto de Luz', icon: Lightbulb, kind: 'tool' },
  { key: 'cotas', label: 'Cotas', icon: Ruler, kind: 'tool' },
  { key: 'texto', label: 'Texto', icon: Type, kind: 'tool' },
  { key: 'contorno', label: 'Contorno', icon: Frame, kind: 'toggle' },
  { key: 'frigideira', label: 'Frigideira', icon: Circle, kind: 'tool' },
  { key: 'desfazer', label: 'Desfazer', icon: Undo2, kind: 'action' },
  { key: 'orto', label: 'ORTO', icon: Crosshair, kind: 'toggle' },
  { key: 'nucleos', label: 'Núcleos', icon: CircleDot, kind: 'tool' },
  { key: 'espelho', label: 'Espelho', icon: FlipHorizontal2, kind: 'action', needSelection: true },
  { key: 'girar', label: 'Girar', icon: RotateCw, kind: 'action', needSelection: true },
  { key: 'copiar', label: 'Copiar', icon: Copy, kind: 'action', needSelection: true },
  { key: 'mover', label: 'Mover', icon: Move, kind: 'tool' },
  { key: 'ajuste_borda', label: 'Ajuste Borda', icon: Magnet, kind: 'action', needSelection: true },
  { key: 'excluir', label: 'Excluir', icon: Trash2, kind: 'action', needSelection: true },
  { key: 'malha', label: 'Malha', icon: Grid3x3, kind: 'toggle' },
];

export default function ProjetoToolbar({
  tool, setTool, showGrid, onToggleGrid, ortoAtivo, onToggleOrto, contornoAtivo, onToggleContorno,
  onUndo, onEspelho, onGirar, onCopiar, onAjusteBorda, onDeleteSelected, hasSelection
}) {
  const handleAction = (key) => {
    if (key === 'desfazer') return onUndo();
    if (key === 'espelho') return onEspelho();
    if (key === 'girar') return onGirar();
    if (key === 'copiar') return onCopiar();
    if (key === 'ajuste_borda') return onAjusteBorda();
    if (key === 'excluir') return onDeleteSelected();
  };

  return (
    <div className="shrink-0 bg-gray-100 border-b border-border px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        if (t.kind === 'action') {
          return (
            <button
              key={t.key}
              title={t.label}
              onClick={() => handleAction(t.key)}
              disabled={t.needSelection && !hasSelection}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        }
        if (t.kind === 'toggle') {
          let active = false;
          if (t.key === 'malha') active = showGrid;
          if (t.key === 'orto') active = ortoAtivo;
          if (t.key === 'contorno') active = contornoAtivo;
          const onTog = () => {
            if (t.key === 'malha') return onToggleGrid();
            if (t.key === 'orto') return onToggleOrto();
            if (t.key === 'contorno') return onToggleContorno();
          };
          return (
            <button
              key={t.key}
              title={t.label}
              onClick={onTog}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap",
                active ? "bg-primary text-primary-foreground" : "hover:bg-gray-200 text-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        }
        const active = tool === t.key;
        return (
          <button
            key={t.key}
            title={t.label}
            onClick={() => setTool(t.key)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap",
              active ? "bg-primary text-primary-foreground" : "hover:bg-gray-200 text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}