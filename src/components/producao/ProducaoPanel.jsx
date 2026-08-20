import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Factory, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ProducaoPanel() {
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['production-logs'],
    queryFn: () => base44.entities.ProductionLog.list('-created_date', 100),
  });

  const inProduction = orders.filter(o => o.status === 'em_producao');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Factory className="w-5 h-5 text-primary" />
          Em Produção ({inProduction.length})
        </h2>
        {inProduction.length === 0 ? (
          <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">
            <Factory className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum pedido em produção</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inProduction.map(order => {
              const totalItems = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
              const totalProduced = order.items?.reduce((s, i) => s + (i.produced || 0), 0) || 0;
              const progress = totalItems > 0 ? Math.round((totalProduced / totalItems) * 100) : 0;

              return (
                <div key={order.id} className="bg-card rounded-2xl border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold">#{order.order_number}</p>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">
                      {progress}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{order.client_name}</p>

                  <div className="space-y-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>{item.size}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{item.produced || 0}/{item.quantity}</span>
                          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", (item.produced || 0) >= item.quantity ? "bg-green-500" : "bg-primary")}
                              style={{ width: `${item.quantity > 0 ? ((item.produced || 0) / item.quantity) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Registros Recentes
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de produção ainda</p>
        ) : (
          <div className="bg-card rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Pedido</th>
                    <th className="text-left p-3 font-medium">Tamanho</th>
                    <th className="text-left p-3 font-medium">Operador</th>
                    <th className="text-left p-3 font-medium">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">#{log.order_number}</td>
                      <td className="p-3">{log.truss_size}</td>
                      <td className="p-3 flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {log.operator_name || log.operator_email}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {log.created_date ? format(new Date(log.created_date), 'dd/MM HH:mm') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}