import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, FileSpreadsheet } from 'lucide-react';
import { exportarPDF, exportarDXF, capturarCanvas } from '@/lib/projetoExport';

export default function ProjetoExportDialog({
  open, onOpenChange, projeto, dados, canvasRef
}) {
  const [busy, setBusy] = useState(null);

  const handlePDF = async () => {
    setBusy('pdf');
    try {
      const img = capturarCanvas(canvasRef?.current);
      exportarPDF(projeto, { ...dados, canvasImage: img });
    } finally { setBusy(null); }
  };

  const handleDXF = () => {
    setBusy('dxf');
    try { exportarDXF(projeto, dados); } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <button
            onClick={handlePDF}
            disabled={!!busy}
            className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
          >
            <FileText className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium">PDF Técnico</p>
              <p className="text-xs text-muted-foreground">Desenho + memorial de cálculo</p>
            </div>
          </button>
          <button
            onClick={handleDXF}
            disabled={!!busy}
            className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
          >
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium">DXF (AutoCAD)</p>
              <p className="text-xs text-muted-foreground">Geometria vetorial para CAD</p>
            </div>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}