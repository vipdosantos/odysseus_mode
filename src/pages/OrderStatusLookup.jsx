import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Package, Truck, Calendar, Phone, User, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const STATUS_FLOW = [
  { key: 'of_etiquetas',       label: 'OF e Etiquetas' },
  { key: 'corte_vigas',        label: 'Corte Vigas' },
  { key: 'producao',           label: 'Produção' },
  { key: 'secagem',             label: 'Secagem' },
  { key: 'expedicao',          label: 'Expedição' },
  { key: 'aguardando_entrega', label: 'Aguardando Entrega' },
  { key: 'entrega',            label: 'Entrega' },
  { key: 'a_caminho',          label: 'A Caminho' },
  { key: 'recebido',           label: 'Recebido' },
];

export default function OrderStatusLookup() {
  const { accessKey } = useParams();
  const [keyInput, setKeyInput] = useState(accessKey || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lookup = async (key) => {
    if (!key || key.trim().length < 4) {
      setError('Digite uma chave de acesso válida.');
      return;
    }
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const results = await base44.entities.Order.filter({ access_key: key.trim() }, '-created_date', 1);
      if (results && results.length > 0) {
        setOrder(results[0]);
      } else {
        setError('Nenhum pedido encontrado com esta chave de acesso. Verifique e tente novamente.');
      }
    } catch (err) {
      setError('Não foi possível consultar o status no momento. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessKey) {
      setKeyInput(accessKey);
      lookup(accessKey);
    }
  }, [accessKey]);

  const handleSubmit = (e) => {
    e.preventDefault();
    lookup(keyInput);
  };

  const currentIdx = order ? STATUS_FLOW.findIndex(s => s.key === order.status) : -1;
  const isFinished = order?.status === 'finalizado';
  const isPaymentPending = order?.status === 'pagamento_pendente';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white py-5 px-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-400" />
          <div>
            <h1 className="text-lg font-bold">Modelajes — Acompanhar Pedido</h1>
            <p className="text-xs text-slate-400">Consulte o status do seu pedido com a chave de acesso</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Search form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
          <label className="text-sm font-semibold text-slate-700 block mb-2">Chave de Acesso</label>
          <div className="flex gap-2">
            <Input
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="Ex: ABCD-1234-EFGH-5678"
              className="font-mono tracking-wider"
              autoComplete="off"
            />
            <Button type="submit" disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-1 hidden sm:inline">Consultar</span>
            </Button>
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Consultando seu pedido...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Order found */}
        {order && !loading && (
          <div className="space-y-4">
            {/* Order header */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Pedido</p>
                  <h2 className="text-2xl font-bold text-slate-900">#{order.order_number}</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Cliente</p>
                  <p className="font-semibold text-slate-700">{order.client_name}</p>
                </div>
              </div>

              {/* Status timeline */}
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Status do Pedido</p>
                {isPaymentPending ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Pagamento Pendente</p>
                      <p className="text-xs text-red-600">Aguardando confirmação do pagamento para prosseguir.</p>
                    </div>
                  </div>
                ) : isFinished ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    <p className="text-sm font-semibold text-green-700">Pedido Finalizado</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    {STATUS_FLOW.map((s, idx) => {
                      const isDone = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <React.Fragment key={s.key}>
                          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                isCurrent
                                  ? 'bg-amber-500 text-white ring-4 ring-amber-200 scale-110'
                                  : isDone
                                  ? 'bg-green-500 text-white'
                                  : 'bg-slate-200 text-slate-400'
                              }`}
                            >
                              {isDone && !isCurrent ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
                            </div>
                            <span className={`text-[8px] sm:text-[9px] text-center leading-tight ${isCurrent ? 'font-bold text-amber-600' : isDone ? 'text-green-600' : 'text-slate-400'}`}>
                              {s.label}
                            </span>
                          </div>
                          {idx < STATUS_FLOW.length - 1 && (
                            <div className={`h-0.5 flex-1 mt-[-12px] ${idx < currentIdx ? 'bg-green-400' : 'bg-slate-200'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            {order.items && order.items.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Itens do Pedido</p>
                <div className="space-y-3">
                  {order.items.map((item, idx) => {
                    const pct = item.quantity > 0 ? Math.min(((item.produced || 0) / item.quantity) * 100, 100) : 0;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{item.size}</span>
                            <span className="text-xs text-slate-400">{item.produced || 0}/{item.quantity} un</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-400' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery info */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Entrega</p>
              <div className="space-y-2">
                {order.delivery_date && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Previsão: {format(parseISO(order.delivery_date), 'dd/MM/yyyy')}</span>
                  </div>
                )}
                {order.delivery_address && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Truck className="w-4 h-4 text-slate-400" />
                    <span>{order.delivery_address}</span>
                  </div>
                )}
                {order.seller_name && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Vendedor: {order.seller_name}</span>
                  </div>
                )}
                {order.seller_phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <a href={`tel:${order.seller_phone}`} className="text-amber-600 font-medium hover:underline">{order.seller_phone}</a>
                  </div>
                )}
                {!order.delivery_date && !order.delivery_address && !order.seller_name && (
                  <p className="text-sm text-slate-400">Sem informações de entrega cadastradas.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state (no search yet) */}
        {!order && !loading && !error && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Digite sua chave de acesso para acompanhar seu pedido.</p>
          </div>
        )}
      </main>

      <footer className="py-6 text-center">
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Modelajes. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}