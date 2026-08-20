import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import RelatoriosProducao from './pages/RelatoriosProducao';
import Scanner from './pages/Scanner';
import Finance from './pages/Finance';
import Users from './pages/Users';
import Cadastros from './pages/Cadastros';
import EstoquePatrimonio from './pages/EstoquePatrimonio';
import BankAccounts from './pages/BankAccounts';
import FiscalNotes from './pages/FiscalNotes';
import Orcamentos from './pages/Orcamentos';
import Projetos from './pages/Projetos';
import OrdemPedido from './pages/OrdemPedido';
import OrdemCompra from './pages/OrdemCompra';
import SobraTrelica from './pages/SobraTrelica';
import ApiConfig from './pages/ApiConfig';
import Motorista from './pages/Motorista';
import OrderStatusLookup from './pages/OrderStatusLookup';
import ContractSign from './pages/ContractSign';
import ChamadosTI from './pages/ChamadosTI';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();
  const location = useLocation();

  // Public routes — no auth required
  if (location.pathname.startsWith('/status')) {
    return (
      <Routes>
        <Route path="/status" element={<OrderStatusLookup />} />
        <Route path="/status/:accessKey" element={<OrderStatusLookup />} />
      </Routes>
    );
  }

  // Public contract signing — no auth required
  if (location.pathname.startsWith('/contrato')) {
    return (
      <Routes>
        <Route path="/contrato/:accessKey" element={<ContractSign />} />
        <Route path="/contrato" element={<ContractSign />} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // For auth_required or any other error → redirect to login
    navigateToLogin();
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
        <button className="mt-2 text-sm text-primary underline" onClick={navigateToLogin}>
          Clique aqui se não foi redirecionado
        </button>
      </div>
    );
  }

  // Not authenticated — force login
  if (!isLoadingAuth && !isAuthenticated) {
    navigateToLogin();
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
        <button className="mt-2 text-sm text-primary underline" onClick={navigateToLogin}>
          Clique aqui se não foi redirecionado
        </button>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/relatorios-producao" element={<RelatoriosProducao />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/financeiro" element={<Finance />} />
        <Route path="/cadastros" element={<Cadastros />} />

        <Route path="/estoque-patrimonio" element={<EstoquePatrimonio />} />
        <Route path="/contas-bancarias" element={<BankAccounts />} />
        <Route path="/notas-fiscais" element={<FiscalNotes />} />
        <Route path="/orcamentos" element={<Orcamentos />} />
        <Route path="/projetos" element={<Projetos />} />
        <Route path="/ordem-pedido" element={<OrdemPedido />} />
        <Route path="/aprovacoes" element={<OrdemCompra />} />
        <Route path="/sobra-trelica" element={<SobraTrelica />} />
        <Route path="/motorista" element={<Motorista />} />
        <Route path="/chamados-ti" element={<ChamadosTI />} />
        <Route path="/api-config" element={<ApiConfig />} />
        <Route path="/usuarios" element={<Users />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App