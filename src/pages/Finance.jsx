import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DollarSign, TrendingUp } from 'lucide-react';
import ContasPagarPanel from '@/components/finance/ContasPagarPanel';
import ContasReceberPanel from '@/components/finance/ContasReceberPanel';

export default function Finance() {
  const [tab, setTab] = useState('pagar');

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Contas a pagar e a receber</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pagar" className="gap-2">
            <DollarSign className="w-4 h-4" /> Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="receber" className="gap-2">
            <TrendingUp className="w-4 h-4" /> Contas a Receber
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pagar" className="mt-4">
          <ContasPagarPanel />
        </TabsContent>
        <TabsContent value="receber" className="mt-4">
          <ContasReceberPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}