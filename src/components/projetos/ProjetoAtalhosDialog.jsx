import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MousePointer2, Minus, Square, Slash, Type, MoveVertical, Ban, Hand, Crosshair,
  Trash2, Spline, Palette, GitBranch, Home, FlipHorizontal2, Copy, Move,
  X, Undo2, HelpCircle
} from 'lucide-react';

const DESENHO = [
  { icon: MousePointer2, label: 'Seleção', k: 'S' },
  { icon: Minus, label: 'Linha', k: 'L' },
  { icon: Square, label: 'Lançar Laje', k: 'R' },
  { icon: Slash, label: 'Tracejada', k: 'D' },
  { icon: Type, label: 'Texto', k: 'T' },
  { icon: MoveVertical, label: 'Lançar Vigota', k: 'V' },
  { icon: Ban, label: 'Adicionar Negativo', k: 'N' },
  { icon: Hand, label: 'Pan', k: 'P' },
  { icon: Crosshair, label: 'ORTHO', k: '0' },
  { icon: Trash2, label: 'Deletar Vigota', k: 'E' },
  { icon: Spline, label: 'Adicionar Vigota', k: 'G' },
  { icon: Palette, label: 'Cores', k: 'H' },
  { icon: GitBranch, label: 'Incluir Nervura', k: 'J' },
  { icon: Home, label: 'Beiral', k: 'B' },
  { icon: FlipHorizontal2, label: 'Espelho', k: 'M' },
  { icon: Copy, label: 'Copiar', k: 'C' },
  { icon: Move, label: 'Mover', k: 'W' },
];

const SISTEMA = [
  { icon: X, label: 'Cancelar / Deselecionar', k: 'Esc' },
  { icon: Trash2, label: 'Remover Elemento', k: 'Del' },
  { icon: Undo2, label: 'Desfazer', k: 'Ctrl+Z' },
  { icon: HelpCircle, label: 'Abrir Esta Ajuda', k: '?' },
];

function Linha({ icon: Icon, label, k }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Icon className="w-4 h-4 text-gray-500" />
        <span>{label}</span>
      </div>
      <kbd className="min-w-7 h-7 px-2 inline-flex items-center justify-center rounded-md bg-gray-100 border border-gray-300 text-xs font-semibold text-gray-700">
        {k}
      </kbd>
    </div>
  );
}

export default function ProjetoAtalhosDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atalhos do Teclado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Ferramentas de Desenho
            </p>
            {DESENHO.map((r) => (
              <Linha key={r.label} icon={r.icon} label={r.label} k={r.k} />
            ))}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Comandos do Sistema
            </p>
            {SISTEMA.map((r) => (
              <Linha key={r.label} icon={r.icon} label={r.label} k={r.k} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}