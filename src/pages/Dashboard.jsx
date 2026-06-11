import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Package, Factory, DollarSign, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import StatsCard from '../components/dashboard/StatsCard';
import BillsAlert from '../components/dashboard/BillsAlert';
import RecentOrders from '../components/dashboard/RecentOrders';

export default function Dashboard() {
  const { user } = useOutletContext();

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 100),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () => base44.entities.Bill.list('-due_date', 100),
  });

  const stats = {
    totalOrders: orders.length,
    inProduction: orders.filter(o => o.status === 'producao').length,
    pendingBills: bills.filter(b => b.status === 'pendente').length,
    totalPending: bills.filter(b => b.status === 'pendente').reduce((s, b) => s + (b.amount || 0), 0),
    overdueBills: bills.filter(b => b.status === 'pendente' && new Date(b.due_date) < new Date()).length,
    revenue: orders.reduce((s, o) => s + (o.total_value || 0), 0),
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Olá, {user?.full_name?.split(' ')[0] || 'Usuário'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Aqui está o resumo da sua operação</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Pedidos Ativos" value={stats.totalOrders} icon={Package} />
        <StatsCard title="Em Produção" value={stats.inProduction} icon={Factory} />
        <StatsCard title="Contas Pendentes" value={stats.pendingBills} icon={Clock} />
        <StatsCard title="Total a Pagar" value={`R$ ${stats.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <BillsAlert bills={bills} />
        <RecentOrders orders={orders} />
      </div>
    </div>
  );
}