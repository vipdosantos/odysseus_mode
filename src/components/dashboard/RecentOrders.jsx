import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const statusMap = {
  novo: { label: 'Novo', class: 'bg-blue-100 text-blue-700' },
  em_producao: { label: 'Produção', class: 'bg-amber-100 text-amber-700' },
  controle_qualidade: { label: 'Qualidade', class: 'bg-purple-100 text-purple-700' },
  pronto: { label: 'Pronto', class: 'bg-green-100 text-green-700' },
  entregue: { label: 'Entregue', class: 'bg-gray-100 text-gray-600' },
};

export default function RecentOrders({ orders }) {
  const recent = orders.slice(0, 5);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Pedidos Recentes
        </h3>
        <Link to="/pedidos" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum pedido ainda</p>
      ) : (
        <div className="space-y-3">
          {recent.map(order => {
            const st = statusMap[order.status] || statusMap.novo;
            return (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div>
                  <p className="text-sm font-medium">#{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">{order.client_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-1 rounded-full font-medium", st.class)}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}