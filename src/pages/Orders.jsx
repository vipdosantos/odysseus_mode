import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import KanbanColumn, { ALL_STATUSES, STATUS_MAP } from '../components/orders/KanbanColumn';
import OrderFormDialog from '../components/orders/OrderFormDialog';
import OrderDetailDialog from '../components/orders/OrderDetailDialog';
import { cn } from '@/lib/utils';

// "Pedidos" tab = all statuses (kanban), others = filtered single-column view
const TABS = [
  { key: 'pedidos', label: 'Pedidos' },
  ...ALL_STATUSES.map(s => ({ key: s.key, label: s.label })),
];

export default function Orders() {
  const { user } = useOutletContext();
  const [activeTab, setActiveTab] = useState('pedidos');
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null); setShowForm(false); },
  });

  const handleSave = (data) => {
    if (editOrder) {
      updateMutation.mutate({ id: editOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCardClick = (order) => setDetailOrder(order);

  const handleEditFromDetail = (order) => {
    setDetailOrder(null);
    setEditOrder(order);
    setShowForm(true);
  };

  const handleStatusChange = (order, newStatus) => {
    updateMutation.mutate({ id: order.id, data: { ...order, status: newStatus } });
    setDetailOrder(null);
  };

  const filtered = orders.filter(o =>
    !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const canEdit = ['admin', 'operador'].includes(user?.role);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-6 pb-0 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus pedidos por etapa de produção</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido..." className="pl-9" />
            </div>
            {canEdit && (
              <Button onClick={() => { setEditOrder(null); setShowForm(true); }} className="bg-primary text-primary-foreground shrink-0">
                <Plus className="w-4 h-4 mr-1" /> Novo Pedido
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map(tab => {
            const count = tab.key === 'pedidos'
              ? filtered.length
              : filtered.filter(o => o.status === tab.key).length;
            const cfg = STATUS_MAP[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {cfg && <span className={cn("w-2 h-2 rounded-full", cfg.color)} />}
                {tab.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  activeTab === tab.key ? "bg-white/20" : "bg-background"
                )}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-x-auto p-4 md:p-6 pt-4">
        {activeTab === 'pedidos' ? (
          // Full Kanban view
          <div className="flex gap-4 pb-4">
            {ALL_STATUSES.map(s => (
              <KanbanColumn
                key={s.key}
                status={s.key}
                orders={filtered.filter(o => o.status === s.key)}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        ) : (
          // Single status filtered view
          <div className="max-w-2xl">
            <SingleStatusView
              orders={filtered.filter(o => o.status === activeTab)}
              status={activeTab}
              onCardClick={handleCardClick}
              canEdit={canEdit}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}
      </div>

      <OrderFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        order={editOrder}
        onSave={handleSave}
      />

      <OrderDetailDialog
        open={!!detailOrder}
        onOpenChange={() => setDetailOrder(null)}
        order={detailOrder}
        onEdit={handleEditFromDetail}
        canEdit={canEdit}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

function SingleStatusView({ orders, status, onCardClick, canEdit, onStatusChange }) {
  const cfg = STATUS_MAP[status];
  const currentIdx = ALL_STATUSES.findIndex(s => s.key === status);
  const nextStatus = ALL_STATUSES[currentIdx + 1];

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">Nenhum pedido em <strong>{cfg?.label}</strong></p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <SingleOrderRow
          key={order.id}
          order={order}
          onCardClick={onCardClick}
          canEdit={canEdit}
          onStatusChange={onStatusChange}
          nextStatus={nextStatus}
        />
      ))}
    </div>
  );
}

function SingleOrderRow({ order, onCardClick, canEdit, onStatusChange, nextStatus }) {
  const totalItems = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const totalProduced = order.items?.reduce((s, i) => s + (i.produced || 0), 0) || 0;
  const progress = totalItems > 0 ? Math.round((totalProduced / totalItems) * 100) : 0;

  const priorityColors = {
    baixa: 'border-l-gray-300',
    normal: 'border-l-blue-400',
    alta: 'border-l-amber-400',
    urgente: 'border-l-red-500',
  };

  return (
    <div className={cn(
      "bg-card rounded-xl p-4 border border-border shadow-sm border-l-4 flex flex-col sm:flex-row sm:items-center gap-4",
      priorityColors[order.priority] || 'border-l-blue-400'
    )}>
      <div className="flex-1 cursor-pointer" onClick={() => onCardClick(order)}>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold">#{order.order_number}</p>
          {order.priority === 'urgente' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">URGENTE</span>
          )}
        </div>
        <p className="text-sm text-foreground/80">{order.client_name}</p>
        {totalItems > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>{totalProduced}/{totalItems} treliças</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full max-w-xs">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
      {canEdit && nextStatus && (
        <Button
          size="sm"
          onClick={() => onStatusChange(order, nextStatus.key)}
          className="shrink-0 bg-primary text-primary-foreground text-xs"
        >
          Avançar → {nextStatus.label}
        </Button>
      )}
    </div>
  );
}