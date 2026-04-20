import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import KanbanColumn from '../components/orders/KanbanColumn';
import OrderFormDialog from '../components/orders/OrderFormDialog';
import OrderDetailDialog from '../components/orders/OrderDetailDialog';

const statuses = ['novo', 'em_producao', 'controle_qualidade', 'pronto', 'entregue'];

export default function Orders() {
  const { user } = useOutletContext();
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

  const filtered = orders.filter(o =>
    !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const canEdit = ['admin', 'operador'].includes(user?.role);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus pedidos no estilo Kanban</p>
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

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
        {statuses.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            orders={filtered.filter(o => o.status === status)}
            onCardClick={handleCardClick}
          />
        ))}
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
      />
    </div>
  );
}