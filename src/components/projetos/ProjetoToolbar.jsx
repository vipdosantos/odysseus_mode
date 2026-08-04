import React from 'react';
import { cn } from '@/lib/utils';
import {
  MousePointer2, PenLine, Square, Ruler, Type, Undo2, Scale, Trash2, Grid3x3, Move, RotateCw
} from 'lucide-react';

const TOOLS = [
  { key: 'select', label: 'Seleção', icon: MousePointer2 },
  { key: 'vertices', label: 'Laje por Vértices', icon: PenLine },
  { key: 'retangulo', label: 'Lançar Laje', icon: Square },
  { key: 'cotas', label: 'Cotas', icon: Ruler },
  { key: 'texto', label: 'Texto', icon: Type },
  { key: 'mover', label: 'Mover', icon: Move },
  { key: 'girar', label: 'Girar', icon: RotateCw },
  { key: 'desfazer', label: 'Desfazer', icon: Undo2, action: true },
  { key: 'excluir', label: 'Excluir', icon: Trash2, action: true },
  { key: 'calibrar', label: 'Calibrar Escala', icon: Scale },
  { key: 'malha', label: 'Malha', icon: Grid3x3, toggle: true },
];

export default function ProjetoToolbar({ tool, setTool, showGrid, onToggleGrid, onUndo, onDeleteSelected, hasSelection }) {
  return (
    <div className="shrink-0 bg-gray-100 border-b border-border px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        if (t.action) {
          return (
            <button
              key={t.key}
              title={t.label}
              onClick={t.key === 'desfazer' ? onUndo : onDeleteSelected}
              disabled={t.key === 'excluir' && !hasSelection}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap",
                "hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        }
        if (t.toggle) {
          const active = showGrid;
          return (
            <button
              key={t.key}
              title={t.label}
              onClick={onToggleGrid}
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