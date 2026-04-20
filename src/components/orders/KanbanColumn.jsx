import React from 'react';
import OrderCard from './OrderCard';
import { cn } from '@/lib/utils';

export const ALL_STATUSES = [
  { key: 'of_etiquetas',       label: 'OF e Etiquetas',          color: 'bg-blue-400' },
  { key: 'corte_vigas',        label: 'Corte Vigas',             color: 'bg-orange-400' },
  { key: 'producao',           label: 'Produção',                color: 'bg-amber-500' },
  { key: 'secagem',            label: 'Secagem',                 color: 'bg-yellow-500' },
  { key: 'expedicao',          label: 'Expedição',               color: 'bg-cyan-500' },
  { key: 'aguardando_entrega', label: 'Aguardando Entrega',      color: 'bg-indigo-400' },
  { key: 'entrega',            label: 'Entrega',                 color: 'bg-violet-500' },
  { key: 'a_caminho',          label: 'A Caminho',               color: 'bg-purple-500' },
  { key: 'recebido',           label: 'Recebido',                color: 'bg-teal-500' },
  { key: 'pagamento_pendente', label: 'Pagamento Pendente',      color: 'bg-red-400' },
  { key: 'finalizado',         label: 'Finalizado',              color: 'bg-green-500' },
];

export const STATUS_MAP = Object.fromEntries(ALL_STATUSES.map(s => [s.key, s]));

export default function KanbanColumn({ status, orders, onCardClick }) {
  const config = STATUS_MAP[status] || { label: status, color: 'bg-gray-500' };

  return (
    <div className="flex-shrink-0 w-72 md:w-80">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={cn("w-2.5 h-2.5 rounded-full", config.color)} />
        <h3 className="text-sm font-semibold">{config.label}</h3>
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