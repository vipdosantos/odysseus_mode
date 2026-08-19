import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileText, BarChart3 } from 'lucide-react';
import NotasFiscaisList from '@/components/fiscal/NotasFiscaisList';
import RelatorioFiscalPanel from '@/components/fiscal/RelatorioFiscalPanel';

export default function FiscalNotes() {
  const [tab, setTab] = useState('notas');

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-sm text-muted-foreground">Emita notas e acompanhe o relatório fiscal de impostos</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="notas" className="gap-2">
            <FileText className="w-4 h-4" /> Notas
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Relatório Fiscal
          </TabsTrigger>
        </TabsList>
        <TabsContent value="notas" className="mt-4">
          <NotasFiscaisList />
        </TabsContent>
        <TabsContent value="relatorio" className="mt-4">
          <RelatorioFiscalPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}