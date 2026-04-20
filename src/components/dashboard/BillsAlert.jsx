import React from 'react';
import { AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { format, differenceInDays, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function BillsAlert({ bills }) {
  const today = new Date();
  const upcomingBills = bills
    .filter(b => b.status === 'pendente')
    .map(b => ({ ...b, daysUntil: differenceInDays(parseISO(b.due_date), today) }))
    .filter(b => b.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (upcomingBills.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Contas Próximas do Vencimento</h3>
      </div>
      <div className="space-y-3">
        {upcomingBills.map(bill => (
          <div key={bill.id} className={cn(
            "flex items-center justify-between p-3 rounded-xl border",
            bill.daysUntil < 0 ? "bg-red-50 border-red-200" :
            bill.daysUntil === 0 ? "bg-amber-50 border-amber-200" :
            "bg-muted/50 border-border"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                bill.daysUntil < 0 ? "bg-red-100" : bill.daysUntil === 0 ? "bg-amber-100" : "bg-muted"
              )}>
                {bill.daysUntil < 0 ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <Clock className="w-4 h-4 text-amber-600" />}
              </div>
              <div>
                <p className="text-sm font-medium">{bill.description}</p>
                <p className="text-xs text-muted-foreground">
                  {bill.daysUntil < 0 ? `Atrasado ${Math.abs(bill.daysUntil)} dia(s)` :
                   bill.daysUntil === 0 ? "Vence hoje!" :
                   bill.daysUntil === 1 ? "Vence amanhã" :
                   `Vence em ${bill.daysUntil} dias`}
                </p>
              </div>
            </div>
            <p className="text-sm font-bold">
              R$ {bill.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}