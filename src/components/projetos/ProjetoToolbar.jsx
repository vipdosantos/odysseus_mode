import React from 'react';
import { cn } from '@/lib/utils';
import {
  MousePointer2, PenLine, Square, Ruler, Type, Undo2, Frame, Move, RotateCw,
  Minus, Slash, Spline, GitBranch, Ban, Lightbulb, Crosshair, Copy, FlipHorizontal2, Magnet,
  Hand, Palette, HelpCircle, FileDown, Box, Keyboard, Settings
} from 'lucide-react';

// Linha superior (21 ferramentas) — ordem conforme print ProjLAJE
const TOP_TOOLS = [
  { key: 'select', label: 'Seleção', icon: MousePointer2, kind: 'tool' },
  { key: 'linha', label: 'Linha', icon: Minus, kind: 'tool' },
  { key: 'tracejada', label: 'Tracejada', icon: Slash, kind: 'tool' },
  { key: 'retangulo', label: 'Lançar Laje', icon: Square, kind: 'tool' },
  { key: 'vigota', label: 'Lançar Vigota', icon: Spline, kind: 'tool' },
  { key: 'nervura', label: 'Incluir Nervura', icon: GitBranch, kind: 'tool' },
  { key: 'negativo', label: 'Adicionar Negativo', icon: Ban, kind: 'tool' },
  { key: 'vertices', label: 'Laje Vértice', icon: PenLine, kind: 'tool' },
  { key: 'ponto_luz', label: 'Ponto de Luz', icon: Lightbulb, kind: 'tool' },
  { key: 'cotas', label: 'Cotas', icon: Ruler, kind: 'tool' },
  { key: 'texto', label: 'Texto', icon: Type, kind: 'tool' },
  { key: 'contorno', label: 'Contorno', icon: Frame, kind: 'toggle' },
  { key: 'pan', label: 'Pan', icon: Hand, kind: 'tool' },
  { key: 'desfazer', label: 'Desfazer', icon: Undo2, kind: 'action' },
  { key: 'orto', label: 'ORTHO', icon: Crosshair, kind: 'toggle' },
  { key: 'cores', label: 'Cores', icon: Palette, kind: 'action' },
  { key: 'espelho', label: 'Espelho', icon: FlipHorizontal2, kind: 'action', needSelection: true },
  { key: 'girar', label: 'Girar', icon: RotateCw, kind: 'action', needSelection: true },
  { key: 'copiar', label: 'Copiar', icon: Copy, kind: 'action', needSelection: true },
  { key: 'mover', label: 'Mover', icon: Move, kind: 'tool' },
  { key: 'ajuste_borda', label: 'Ajuste Borda', icon: Magnet, kind: 'action', needSelection: true },
];

// Linha inferior (5 utilitários)
const BOTTOM_TOOLS = [
  { key: 'ajuda', label: 'Ajuda', icon: HelpCircle },
  { key: 'exportar', label: 'Exportar', icon: FileDown },
  { key: '3d', label: '3D', icon: Box, accent: true },
  { key: 'atalhos', label: 'Atalhos', icon: Keyboard },
  { key: 'config', label: 'Config', icon: Settings },
];

export default function ProjetoToolbar({
  tool, setTool, ortoAtivo, onToggleOrto, contornoAtivo, onToggleContorno,
  onUndo, onEspelho, onGirar, onCopiar, onAjusteBorda, onCores,
  onAjuda, onExportar, on3D, onAtalhos, onConfig, hasSelection
}) {
  const handleAction = (key) => {
    if (key === 'desfazer') return onUndo();
    if (key === 'cores') return onCores();
    if (key === 'espelho') return onEspelho();
    if (key === 'girar') return onGirar();
    if (key === 'copiar') return onCopiar();
    if (key === 'ajuste_borda') return onAjusteBorda();
  };

  const renderBtn = (t) => {
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
      const active = t.key === 'orto' ? ortoAtivo : contornoAtivo;
      const onTog = t.key === 'orto' ? onToggleOrto : onToggleContorno;
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
          active ? "bg-white shadow-sm text-gray-900" : "hover:bg-gray-200 text-gray-700"
        )}
      >
        <Icon className="w-4 h-4" />
        {t.label}
      </button>
    );
  };

  return (
    <div className="shrink-0 bg-gradient-to-b from-gray-100 to-gray-200 border-b border-border flex flex-col">
      <div className="px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
        {TOP_TOOLS.map(renderBtn)}
      </div>
      <div className="px-2 pb-1.5 flex items-center gap-1 overflow-x-auto border-t border-gray-300/50">
        {BOTTOM_TOOLS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              title={t.label}
              onClick={() => {
                if (t.key === 'ajuda') return onAjuda();
                if (t.key === 'exportar') return onExportar();
                if (t.key === '3d') return on3D();
                if (t.key === 'atalhos') return onAtalhos();
                if (t.key === 'config') return onConfig();
              }}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap hover:bg-gray-200 text-gray-700",
                t.accent && "text-[#5D5DFF]"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}