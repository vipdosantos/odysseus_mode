import React from 'react';
import OrderCard from './OrderCard';
import { cn } from '@/lib/utils';

const columnConfig = {
  novo: { title: 'Novo', color: 'bg-blue-500' },
  em_producao: { title: 'Em Produção', color: 'bg-amber-500' },
  controle_qualidade: { title: 'Controle de Qualidade', color: 'bg-purple-500' },
  pronto: { title: 'Pronto', color: 'bg-green-500' },
  entregue: { title: 'Entregue', color: 'bg-gray-400' },
};

export default function KanbanColumn({ status, orders, onCardClick }) {
  const config = columnConfig[status] || { title: status, color: 'bg-gray-500' };

  return (
    <div className="flex-shrink-0 w-72 md:w-80">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={cn("w-2.5 h-2.5 rounded-full", config.color)} />
        <h3 className="text-sm font-semibold">{config.title}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{orders.length}</span>
      </div>
      <div className="space-y-3 min-h-[200px] p-2 rounded-xl bg-muted/30">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} onClick={onCardClick} />
        ))}
        {orders.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum pedido</p>
        )}
      </div>
    </div>
  );
}