import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, Factory, DollarSign, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/pedidos', icon: Package, label: 'Pedidos' },
  { path: '/scanner', icon: ScanLine, label: 'Scanner' },
  { path: '/producao', icon: Factory, label: 'Produção' },
  { path: '/financeiro', icon: DollarSign, label: 'Finanças' },
];

export default function MobileNav({ user }) {
  const location = useLocation();
  const userRole = user?.role || 'visualizador';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 no-print">
      <div className="flex items-center justify-around py-2">
        {items.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}