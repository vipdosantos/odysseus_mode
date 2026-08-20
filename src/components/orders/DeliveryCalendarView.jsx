import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS = {
  urgente: 'bg-red-500',
  alta: 'bg-amber-500',
  normal: 'bg-blue-500',
  baixa: 'bg-gray-400',
};

export default function DeliveryCalendarView({ orders, onOpenOrder }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const ordersWithDate = orders.filter(o => o.delivery_date);

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });

  const firstDow = start.getDay();
  const blanks = Array(firstDow).fill(null);

  const getOrdersForDay = (day) =>
    ordersWithDate.filter(o => isSameDay(parseISO(o.delivery_date), day));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Calendário de Entregas</h2>
          <p className="text-sm text-muted-foreground">Pedidos agendados para entrega</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold capitalize px-2">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {blanks.map((_, i) => <div key={`b${i}`} className="min-h-[100px] border-b border-r bg-muted/20" />)}
          {days.map(day => {
            const dayOrders = getOrdersForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[100px] border-b border-r p-1.5 overflow-hidden",
                  isToday && "bg-primary/5"
                )}
              >
                <p className={cn(
                  "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                  isToday ? "bg-primary text-white" : "text-foreground"
                )}>
                  {format(day, 'd')}
                </p>
                <div className="space-y-1">
                  {dayOrders.slice(0, 3).map(order => (
                    <div
                      key={order.id}
                      onClick={() => onOpenOrder(order)}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded text-white font-medium truncate flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                        PRIORITY_COLORS[order.priority] || 'bg-blue-500'
                      )}
                      title={`#${order.order_number} - ${order.client_name}`}
                    >
                      <Package className="w-2.5 h-2.5 shrink-0" />
                      #{order.order_number}
                    </div>
                  ))}
                  {dayOrders.length > 3 && (
                    <p className="text-[9px] text-muted-foreground pl-1">+{dayOrders.length - 3} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const todayOrders = ordersWithDate.filter(o => isSameDay(parseISO(o.delivery_date), new Date()));
        if (!todayOrders.length) return null;
        return (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" /> Entregas de Hoje ({todayOrders.length})
            </h3>
            <div className="space-y-2">
              {todayOrders.map(order => (
                <div key={order.id} onClick={() => onOpenOrder(order)} className="flex items-center gap-3 bg-card rounded-xl p-3 border cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className={cn("w-2 h-8 rounded-full shrink-0", PRIORITY_COLORS[order.priority] || 'bg-blue-500')} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">#{order.order_number} — {order.client_name}</p>
                    {order.delivery_address && <p className="text-xs text-muted-foreground truncate">{order.delivery_address}</p>}
                    {order.truck_type && order.truck_type !== 'nenhum' && (
                      <p className="text-xs text-muted-foreground capitalize">🚚 {order.truck_type}</p>
                    )}
                  </div>
                  {order.seller_name && <p className="text-xs text-muted-foreground shrink-0">{order.seller_name}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}