import React from 'react';
import { Calendar, User, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const priorityColors = {
  baixa: 'border-l-gray-300',
  normal: 'border-l-blue-400',
  alta: 'border-l-amber-400',
  urgente: 'border-l-red-500',
};

export default function OrderCard({ order, onClick }) {
  const totalItems = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const totalProduced = order.items?.reduce((s, i) => s + (i.produced || 0), 0) || 0;
  const progress = totalItems > 0 ? Math.round((totalProduced / totalItems) * 100) : 0;

  return (
    <div
      onClick={() => onClick(order)}
      className={cn(
        "bg-card rounded-xl p-4 border border-border shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 border-l-4",
        priorityColors[order.priority] || priorityColors.normal
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-bold">#{order.order_number}</p>
        {order.priority === 'urgente' && (
          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">URGENTE</span>
        )}
      </div>
      <p className="text-sm text-foreground/80 mb-3">{order.client_name}</p>
      
      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{totalProduced}/{totalItems} treliças</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {order.delivery_date ? format(parseISO(order.delivery_date), 'dd/MM') : '—'}
        </span>
        {order.total_value > 0 && (
          <span className="font-medium">R$ {order.total_value.toLocaleString('pt-BR')}</span>
        )}
      </div>
    </div>
  );
}