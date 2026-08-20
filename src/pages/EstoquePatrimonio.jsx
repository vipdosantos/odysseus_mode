import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Boxes } from 'lucide-react';
import InsumosPanel from '@/components/estoque/InsumosPanel';
import PatrimonioPanel from '@/components/estoque/PatrimonioPanel';

export default function EstoquePatrimonio() {
  const [tab, setTab] = useState('insumos');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Boxes className="w-6 h-6 text-primary" /> Estoque & Patrimônio
        </h1>
        <p className="text-sm text-muted-foreground">Gerencie insumos de fabricação e bens patrimoniais</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="patrimonio">Patrimônio</TabsTrigger>
        </TabsList>
        <TabsContent value="insumos"><InsumosPanel /></TabsContent>
        <TabsContent value="patrimonio"><PatrimonioPanel /></TabsContent>
      </Tabs>
    </div>
  );
}