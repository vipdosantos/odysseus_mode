import React from 'react';
import { X, Printer } from 'lucide-react';
import { LOGO_URL } from '@/components/layout/ModelajesLogo';
import { buildCargo, orderTotalWeight } from '@/lib/trussWeights';

const PRIORITY_RANK = { urgente: 4, alta: 3, normal: 2, baixa: 1 };

function Field({ label, value, wide }) {
  return (
    <div className={wide ? "flex-1" : ""}>
      <span className="font-semibold text-xs">{label}: </span>
      <span className="border-b border-dashed border-gray-400 inline-block min-w-[80px] px-1">{value || '\u00A0'}</span>
    </div>
  );
}

function RomaneioPage({ driverName, ordered, trucks, weights }) {
  const totalWeight = ordered.reduce((a, o) => a + orderTotalWeight(o, weights), 0);
  const truck = ordered.length ? trucks.find(t => (t.code || '').trim() === ordered[0].truck_type) : null;
  const cap = Number(truck?.capacity_kg) || 0;
  const remaining = cap - totalWeight;

  return (
    <div className="romaneio-page border border-gray-800 p-5 mb-6 text-[11px] text-gray-900" style={{ breakAfter: 'page' }}>
      <div className="flex items-center gap-3 border-b border-gray-800 pb-2 mb-2">
        <img src={LOGO_URL} alt="Modelajes" className="h-12 w-auto object-contain" />
        <div className="flex-1 text-center font-bold text-base">ROMANEIO DE ENTREGA</div>
      </div>

      {/* Cabeçalho */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-2">
        <div className="flex"><Field label="Data" value={new Date().toLocaleDateString('pt-BR')} /></div>
        <div className="flex"><Field label="Placa" /></div>
        <div className="flex"><Field label="Motorista" value={driverName} /></div>
        <div className="flex"><Field label="Ajudantes" /></div>
        <div className="flex"><Field label="Km Inicial" /></div>
        <div className="flex gap-4"><Field label="Hora Inicial" /><Field label="Hora Final" /></div>
      </div>

      {/* Resumo de carga */}
      <div className="text-[10px] text-gray-600 mb-2 flex flex-wrap gap-3">
        <span>Caminhão: <b>{truck?.name || ordered[0]?.truck_type || '—'}</b>{cap > 0 ? ` (${cap.toLocaleString('pt-BR')} kg)` : ''}</span>
        <span>Peso total: <b>{totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</b></span>
        {cap > 0 && (remaining >= 0
          ? <span className="text-green-700">Cabe mais {remaining.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</span>
          : <span className="text-red-700">Excede {Math.abs(remaining).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</span>)}
      </div>

      {/* Tabela de paradas */}
      <table className="w-full border-collapse border border-gray-800">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-800 px-1 py-1 w-6">#</th>
            <th className="border border-gray-800 px-1 py-1 text-left">Pedido</th>
            <th className="border border-gray-800 px-1 py-1 text-left">Cliente</th>
            <th className="border border-gray-800 px-1 py-1 w-16">Hora<br/>Chegada</th>
            <th className="border border-gray-800 px-1 py-1 w-16">Hora<br/>Saída</th>
            <th className="border border-gray-800 px-1 py-1 w-16">Mode<br/>(peso kg)</th>
            <th className="border border-gray-800 px-1 py-1 w-40">Carimbo ou Assinatura</th>
            <th className="border border-gray-800 px-1 py-1 w-28">Ocorrência (opcional)</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((o, i) => {
            const cargo = buildCargo(o, weights);
            return (
              <tr key={o.id} className="align-top">
                <td className="border border-gray-800 px-1 py-1 text-center font-semibold">{i + 1}</td>
                <td className="border border-gray-800 px-1 py-1">
                  <div className="font-semibold">#{o.order_number}</div>
                  <div className="text-[9px] text-gray-500">Prior: {o.delivery_priority || 0}</div>
                </td>
                <td className="border border-gray-800 px-1 py-1">
                  <div className="font-semibold">{o.client_name}</div>
                  {o.delivery_address && <div className="text-[9px] text-gray-600">{o.delivery_address}</div>}
                  <div className="text-[9px] text-gray-500">{cargo.map(c => `${c.quantity}× ${c.truss_type}${c.size ? ' ' + c.size : ''}`).join(', ')}</div>
                </td>
                <td className="border border-gray-800" style={{ height: 52 }}></td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800 px-1 py-1 text-center font-semibold">
                  {orderTotalWeight(o, weights).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                </td>
                <td className="border border-gray-800"></td>
                <td className="border border-gray-800"></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Observação */}
      <div className="mt-2">
        <span className="font-semibold text-xs">Observação:</span>
        <div className="border border-gray-400 mt-1" style={{ height: 44 }}></div>
      </div>

      {/* Rodapé */}
      <div className="flex gap-6 mt-3 text-xs">
        <div><span className="font-semibold">Km por dia:</span> <span className="border-b border-dashed border-gray-400 inline-block min-w-[70px]">&nbsp;</span></div>
        <div><span className="font-semibold">Litros por dia:</span> <span className="border-b border-dashed border-gray-400 inline-block min-w-[70px]">&nbsp;</span></div>
        <div><span className="font-semibold">Km/L por dia:</span> <span className="border-b border-dashed border-gray-400 inline-block min-w-[70px]">&nbsp;</span></div>
      </div>
    </div>
  );
}

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

      <div className="romaneio-print p-4 max-w-[210mm] mx-auto">
        {groupEntries.length === 0 && (
          <p className="text-center text-muted-foreground py-10">Nenhuma entrega atribuída a motoristas.</p>
        )}
        {groupEntries.map(([driverId, list]) => {
          const driverName = driverId === 'sem'
            ? 'Sem motorista'
            : (drivers.find(d => d.id === driverId)?.full_name || 'Motorista');
          return (
            <RomaneioPage
              key={driverId}
              driverName={driverName}
              ordered={sortList(list)}
              trucks={trucks}
              weights={weights}
            />
          );
        })}
      </div>
    </div>
  );
}