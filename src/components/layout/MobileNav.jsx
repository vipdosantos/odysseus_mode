import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { LayoutDashboard, Package, Factory, DollarSign, ScanLine, Menu, X, Calendar, BarChart2, Boxes, Landmark, FileText, Users, Settings, Wrench, ClipboardList, ShoppingCart, ClipboardCheck, BookUser, LogOut, Truck, Receipt, PencilRuler, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canView } from '@/lib/userPermissions';

const allItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/pedidos', icon: Package, label: 'Pedidos' },
  { path: '/relatorios-producao', icon: Factory, label: 'Relatórios' },
  { path: '/scanner', icon: ScanLine, label: 'Scanner QR' },
  { path: '/motorista', icon: Truck, label: 'Entregas' },
  { path: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { path: '/ordem-pedido', icon: ShoppingCart, label: 'Ordem de Compras' },
  { path: '/aprovacoes', icon: ClipboardCheck, label: 'Aprovações' },
  { path: '/estoque', icon: Boxes, label: 'Controle Estoque' },
  { path: '/calendario', icon: Calendar, label: 'Calendário' },
  { path: '/estoque-patrimonio', icon: Boxes, label: 'Estoque & Patrim.' },
  { path: '/projetos', icon: PencilRuler, label: 'Projetos' },
  { path: '/orcamentos', icon: Receipt, label: 'Orçamentos' },
  { path: '/notas-fiscais', icon: FileText, label: 'Notas Fiscais' },
  { path: '/contas-bancarias', icon: Landmark, label: 'Contas Bancárias' },
  { path: '/chamados-ti', icon: Headphones, label: 'Chamados TI' },
  { path: '/cadastros', icon: BookUser, label: 'Cadastros' },
  { path: '/usuarios', icon: Users, label: 'Usuários' },
];

// mainItems is computed per-user inside the component (see below)

export default function MobileNav({ user }) {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const accessibleItems = allItems.filter(item => canView(user, item.path));
  const mainItems = accessibleItems.slice(0, 4);

  return (
    <>
      {/* Full-screen "more" menu overlay */}
      {showMore && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-border">
            <span className="font-bold text-lg">Menu Completo</span>
            <button onClick={() => setShowMore(false)} className="p-2 rounded-full hover:bg-muted">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-3 content-start">
            {accessibleItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl transition-colors border",
                    isActive
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-card border-border text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 no-print">
        <div className="flex items-center justify-around py-2">
          {mainItems.map(item => {
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
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
          <button
            onClick={() => base44.auth.logout()}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-muted-foreground"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </div>
      </nav>
    </>
  );
}