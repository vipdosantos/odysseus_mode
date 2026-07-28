import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Truck, Package, Settings2, ChevronDown, FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DeliveryDetail from '@/components/motorista/DeliveryDetail';
import WeightConfig from '@/components/motorista/WeightConfig';
import RomaneioPrint from '@/components/motorista/RomaneioPrint';
import { DEFAULT_WEIGHTS, mergeWeights } from '@/lib/trussWeights';

export default function Motorista() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isMotorista = user?.role === 'motorista';
  const [selectedId, setSelectedId] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [draftWeights, setDraftWeights] = useState(null);
  const [driverFilter, setDriverFilter] = useState('all');
  const [showRomaneio, setShowRomaneio] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders', 'motorista'],
    queryFn: () => base44.entities.Order.list('-delivery_date', 500),
  });
  const { data: trucks = [] } = useQuery({
    queryKey: ['truckTypes'],
    queryFn: () => base44.entities.TruckType.list(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });
  const { data: weightsCfg } = useQuery({
    queryKey: ['pesosCarga'],
    queryFn: () => base44.entities.EmpresaConfig.filter({ tipo: 'pesos_carga' }),
  });

  const motoristas = users.filter(u => u.role === 'motorista');
  const storedCfg = weightsCfg?.[0];
  const weights = mergeWeights(storedCfg?.valor);

  const saveWeightsMutation = useMutation({
    mutationFn: async (val) => {
      if (storedCfg?.id) return base44.entities.EmpresaConfig.update(storedCfg.id, { valor: val });
      return base44.entities.EmpresaConfig.create({ tipo: 'pesos_carga', valor: val });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pesosCarga'] }),
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });

  const assignDriver = (order, motoristaId) => {
    const m = motoristas.find(u => u.id === motoristaId);
    updateOrderMutation.mutate({
      id: order.id,
      data: { motorista_id: motoristaId || null, motorista_name: m?.full_name || null },
    });
  };

  // Pedidos prontos para entrega (status "entrega")
  let deliveries = orders.filter(o => o.status === 'entrega');
  if (isMotorista) {
    deliveries = deliveries.filter(o => o.motorista_id === user.id);
  } else if (isAdmin) {
    if (driverFilter === 'unassigned') deliveries = deliveries.filter(o => !o.motorista_id);
    else if (driverFilter !== 'all') deliveries = deliveries.filter(o => o.motorista_id === driverFilter);
  }

  const selected = deliveries.find(o => o.id === selectedId) || deliveries[0];

  // Entregas atribuídas para o romaneio
  let romaneioDeliveries = orders.filter(o => o.status === 'entrega' && o.motorista_id);
  if (isMotorista) romaneioDeliveries = romaneioDeliveries.filter(o => o.motorista_id === user.id);
  else if (driverFilter !== 'all' && driverFilter !== 'unassigned')
    romaneioDeliveries = romaneioDeliveries.filter(o => o.motorista_id === driverFilter);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isMotorista ? 'Minhas Entregas' : 'Entregas do Dia'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isMotorista ? 'Pedidos atribuídos a você' : 'Atribua motoristas e gere o romaneio'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unassigned">Não atribuídos</SelectItem>
                {motoristas.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button
            onClick={() => setShowRomaneio(true)}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <FileText className="w-4 h-4" /> Romaneio
          </button>
          {isAdmin && (
            <button
              onClick={() => { setShowConfig(s => !s); setDraftWeights(weights); }}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border hover:bg-muted"
            >
              <Settings2 className="w-4 h-4" /> Pesos
              <ChevronDown className={cn("w-4 h-4 transition-transform", showConfig && "rotate-180")} />
            </button>
          )}
        </div>
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
          <p className="text-sm text-muted-foreground">
            {isMotorista ? 'Nenhuma entrega atribuída a você no momento.' : 'Nenhum pedido com status "Entrega" no momento.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold text-sm truncate">#{o.order_number} — {o.client_name}</p>
                        {o.delivery_priority > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0">P{o.delivery_priority}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Package className="w-3 h-3" /> {(o.items || []).reduce((a, i) => a + (i.quantity || 0), 0)} painéis
                      </p>
                      {o.delivery_address && <p className="text-xs text-muted-foreground truncate">{o.delivery_address}</p>}
                      {isAdmin && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" /> {o.motorista_name || 'Não atribuído'}
                        </p>
                      )}
                    </div>
                    {o.truck_type && o.truck_type !== 'nenhum' && (
                      <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2">
            {isAdmin && selected && (
              <div className="bg-card rounded-2xl border p-3 mb-3 flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">Atribuir motorista</Label>
                  <Select
                    value={selected.motorista_id || 'none'}
                    onValueChange={v => assignDriver(selected, v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Não atribuído" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não atribuído</SelectItem>
                      {motoristas.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Prioridade de entrega</Label>
                  <Input
                    type="number"
                    min={0}
                    value={selected.delivery_priority ?? 0}
                    onChange={e => updateOrderMutation.mutate({
                      id: selected.id,
                      data: { delivery_priority: Number(e.target.value) || 0 },
                    })}
                    className="w-28 h-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground self-center">Maior número = entregue primeiro</p>
              </div>
            )}
            <DeliveryDetail order={selected} trucks={trucks} />
          </div>
        </div>
      )}

      {showRomaneio && (
        <RomaneioPrint
          deliveries={romaneioDeliveries}
          drivers={motoristas}
          trucks={trucks}
          weights={weights}
          onClose={() => setShowRomaneio(false)}
        />
      )}
    </div>
  );
}