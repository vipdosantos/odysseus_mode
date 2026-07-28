import React from 'react';
import { X, Printer, Truck, Weight } from 'lucide-react';
import { buildCargo, orderTotalWeight } from '@/lib/trussWeights';

const PRIORITY_RANK = { urgente: 4, alta: 3, normal: 2, baixa: 1 };

export default function RomaneioPrint({ deliveries, drivers, trucks, weights, onClose }) {
  const groups = {};
  deliveries.forEach(o => {
    const key = o.motorista_id || 'sem';
    (groups[key] = groups[key] || []).push(o);
  });

  const sortList = (list) => [...list].sort((a, b) => {
    const dp = (b.delivery_priority || 0) - (a.delivery_priority || 0);
    if (dp) return dp;
    return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
  });

  const truckCap = (order) => {
    const t = trucks.find(t => (t.code || '').trim() === order.truck_type);
    return Number(t?.capacity_kg) || 0;
  };

  const groupEntries = Object.entries(groups);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="no-print sticky top-0 bg-white/90 backdrop-blur border-b flex items-center justify-between p-3 z-10">
        <h2 className="font-bold">Romaneio de Entrega</h2>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="romaneio-print p-6 space-y-6 max-w-4xl mx-auto">
        {groupEntries.length === 0 && (
          <p className="text-center text-muted-foreground py-10">Nenhuma entrega atribuída a motoristas.</p>
        )}
        {groupEntries.map(([driverId, list]) => {
          const driverName = driverId === 'sem'
            ? 'Sem motorista'
            : (drivers.find(d => d.id === driverId)?.full_name || 'Motorista');
          const ordered = sortList(list);
          const totalWeight = ordered.reduce((a, o) => a + orderTotalWeight(o, weights), 0);
          const cap = ordered.length ? truckCap(ordered[0]) : 0;
          const remaining = cap - totalWeight;
          return (
            <div key={driverId} className="border rounded-lg p-4">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <h3 className="font-bold text-lg">Motorista: {driverName}</h3>
                <span className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-BR')}</span>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Pedido / Cliente</th>
                    <th className="text-left p-2">Endereço</th>
                    <th className="text-left p-2">Carga</th>
                    <th className="text-right p-2">Peso (kg)</th>
                    <th className="text-center p-2">Prior.</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((o, i) => {
                    const cargo = buildCargo(o, weights);
                    const w = orderTotalWeight(o, weights);
                    return (
                      <tr key={o.id} className="border-b">
                        <td className="p-2 font-medium">{i + 1}</td>
                        <td className="p-2">#{o.order_number} — {o.client_name}</td>
                        <td className="p-2 text-gray-600 align-top">{o.delivery_address || '—'}</td>
                        <td className="p-2 text-xs align-top">{cargo.map(c => `${c.quantity}× ${c.truss_type}${c.size ? ' ' + c.size : ''}`).join(', ')}</td>
                        <td className="p-2 text-right font-medium">{w.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                        <td className="p-2 text-center">{o.delivery_priority || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span className="font-medium flex items-center gap-1"><Weight className="w-4 h-4" /> Total: {totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</span>
                {cap > 0 && (
                  <>
                    <span className="flex items-center gap-1"><Truck className="w-4 h-4" /> Caminhão: {cap.toLocaleString('pt-BR')} kg</span>
                    {remaining >= 0 ? (
                      <span className="text-green-700 font-medium">✓ Cabe mais {remaining.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</span>
                    ) : (
                      <span className="text-red-700 font-medium">⚠ Excede {Math.abs(remaining).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg — caminhão adicional</span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}