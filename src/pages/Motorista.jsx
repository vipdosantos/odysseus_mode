import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Truck, Package, Settings2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import DeliveryDetail from '@/components/motorista/DeliveryDetail';
import WeightConfig from '@/components/motorista/WeightConfig';
import { DEFAULT_WEIGHTS, mergeWeights } from '@/lib/trussWeights';

export default function Motorista() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [draftWeights, setDraftWeights] = useState(null);

  const isAdmin = user?.role === 'admin';

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', 'motorista'],
    queryFn: () => base44.entities.Order.list('-delivery_date', 500),
  });
  const { data: trucks = [] } = useQuery({
    queryKey: ['truckTypes'],
    queryFn: () => base44.entities.TruckType.list(),
  });
  const { data: weightsCfg } = useQuery({
    queryKey: ['pesosCarga'],
    queryFn: () => base44.entities.EmpresaConfig.filter({ tipo: 'pesos_carga' }),
  });

  const storedCfg = weightsCfg?.[0];
  const weights = mergeWeights(storedCfg?.valor);

  const saveWeightsMutation = useMutation({
    mutationFn: async (val) => {
      if (storedCfg?.id) return base44.entities.EmpresaConfig.update(storedCfg.id, { valor: val });
      return base44.entities.EmpresaConfig.create({ tipo: 'pesos_carga', valor: val });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pesosCarga'] }),
  });

  // Pedidos prontos para entrega (status "entrega")
  const deliveries = orders.filter(o => o.status === 'entrega');
  const selected = deliveries.find(o => o.id === selectedId) || deliveries[0];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entregas do Dia</h1>
          <p className="text-sm text-muted-foreground">Pedidos prontos para carregar e entregar</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowConfig(s => !s); setDraftWeights(weights); }}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border hover:bg-muted"
          >
            <Settings2 className="w-4 h-4" /> Pesos <ChevronDown className={cn("w-4 h-4 transition-transform", showConfig && "rotate-180")} />
          </button>
        )}
      </div>

      {showConfig && isAdmin && (
        <WeightConfig
          weights={draftWeights || weights}
          onChange={setDraftWeights}
          onSave={() => { saveWeightsMutation.mutate(JSON.stringify(draftWeights)); setShowConfig(false); }}
          onReset={() => setDraftWeights(DEFAULT_WEIGHTS)}
          saving={saveWeightsMutation.isPending}
        />
      )}

      {deliveries.length === 0 ? (
        <div className="bg-card rounded-2xl border p-10 text-center">
          <Truck className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum pedido com status "Entrega" no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista de entregas */}
          <div className="lg:col-span-1 space-y-2">
            {deliveries.map(o => {
              const active = o.id === (selected?.id || selectedId);
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  className={cn(
                    "w-full text-left bg-card rounded-xl border p-3 transition-colors",
                    active ? "border-primary ring-1 ring-primary" : "hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("w-1.5 h-8 rounded-full shrink-0", active ? "bg-primary" : "bg-muted-foreground/30")} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">#{o.order_number} — {o.client_name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Package className="w-3 h-3" /> {(o.items || []).reduce((a, i) => a + (i.quantity || 0), 0)} painéis
                      </p>
                      {o.delivery_address && <p className="text-xs text-muted-foreground truncate">{o.delivery_address}</p>}
                    </div>
                    {o.truck_type && o.truck_type !== 'nenhum' && (
                      <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalhe da entrega selecionada */}
          <div className="lg:col-span-2">
            <DeliveryDetail order={selected} trucks={trucks} />
          </div>
        </div>
      )}
    </div>
  );
}