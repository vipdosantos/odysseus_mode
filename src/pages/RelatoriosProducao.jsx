import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, Factory, ClipboardList } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ProducaoPanel from '@/components/producao/ProducaoPanel';
import ProdutividadePanel from '@/components/producao/ProdutividadePanel';

export default function RelatoriosProducao() {
  const { user } = useOutletContext();
  const [tab, setTab] = useState('producao');

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Relatórios de Produção
        </h1>
        <p className="text-sm text-muted-foreground">Acompanhe a fabricação e a produtividade da equipe</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="producao" className="gap-1.5">
            <Factory className="w-4 h-4" /> Produção
          </TabsTrigger>
          <TabsTrigger value="produtividade" className="gap-1.5">
            <ClipboardList className="w-4 h-4" /> Produtividade
          </TabsTrigger>
        </TabsList>
        <TabsContent value="producao" className="mt-6">
          <ProducaoPanel />
        </TabsContent>
        <TabsContent value="produtividade" className="mt-6">
          <ProdutividadePanel user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}