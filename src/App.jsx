import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Production from './pages/Production';
import Scanner from './pages/Scanner';
import Finance from './pages/Finance';
import Users from './pages/Users';
import Cadastros from './pages/Cadastros';
import Receivables from './pages/Receivables';
import DeliveryCalendar from './pages/DeliveryCalendar';
import Productivity from './pages/Productivity';
import Assets from './pages/Assets';
import Supplies from './pages/Supplies';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pedidos" element={<Orders />} />
        <Route path="/producao" element={<Production />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/financeiro" element={<Finance />} />
        <Route path="/cadastros" element={<Cadastros />} />
        <Route path="/receber" element={<Receivables />} />
        <Route path="/calendario" element={<DeliveryCalendar />} />
        <Route path="/produtividade" element={<Productivity />} />
        <Route path="/patrimonio" element={<Assets />} />
        <Route path="/insumos" element={<Supplies />} />
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