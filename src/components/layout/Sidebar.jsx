import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, Factory, DollarSign, Users, 
  ChevronLeft, ChevronRight, ScanLine, LogOut, BookUser,
  TrendingUp, CalendarDays, ClipboardList, Wrench, FlaskConical,
  Landmark, FileText
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import ModelajesLogo from './ModelajesLogo';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'operador', 'financeiro', 'visualizador'] },
  { path: '/pedidos', icon: Package, label: 'Pedidos', roles: ['admin', 'operador', 'visualizador'] },
  { path: '/producao', icon: Factory, label: 'Produção', roles: ['admin', 'operador'] },
  { path: '/scanner', icon: ScanLine, label: 'Scanner QR', roles: ['admin', 'operador'] },
  { path: '/financeiro', icon: DollarSign, label: 'Contas a Pagar', roles: ['admin', 'financeiro'] },
  { path: '/receber', icon: TrendingUp, label: 'Contas a Receber', roles: ['admin', 'financeiro'] },
  { path: '/contas-bancarias', icon: Landmark, label: 'Contas Bancárias', roles: ['admin', 'financeiro'] },
  { path: '/notas-fiscais', icon: FileText, label: 'Notas Fiscais', roles: ['admin', 'financeiro'] },
  { path: '/calendario', icon: CalendarDays, label: 'Calendário', roles: ['admin', 'operador', 'visualizador'] },
  { path: '/insumos', icon: FlaskConical, label: 'Insumos', roles: ['admin', 'operador'] },
  { path: '/patrimonio', icon: Wrench, label: 'Patrimônio', roles: ['admin'] },
  { path: '/produtividade', icon: ClipboardList, label: 'Produtividade', roles: ['admin', 'operador'] },
  { path: '/cadastros', icon: BookUser, label: 'Cadastros', roles: ['admin', 'operador'] },
  { path: '/usuarios', icon: Users, label: 'Usuários', roles: ['admin'] },
];

export default function Sidebar({ user }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const userRole = user?.role || 'visualizador';

  const filteredNav = navItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className={cn(
      "h-screen sticky top-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300 no-print",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="h-20 flex items-center px-3 border-b border-sidebar-border">
        <ModelajesLogo collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredNav.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive && "drop-shadow-sm")} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && (
          <div className="px-2 py-1">
            <p className="text-xs font-medium truncate">{user?.full_name || 'Usuário'}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{userRole}</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => base44.auth.logout()}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Sair"}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}