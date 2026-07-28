import React from 'react';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Navigation, ExternalLink, Package, Weight, Pen } from 'lucide-react';
import { buildCargo, distributeCargo } from '@/lib/trussWeights';
import LoadChecklist from '@/components/motorista/LoadChecklist';
import DeliveryReceiptTab from '@/components/orders/DeliveryReceiptTab';

export default function DeliveryDetail({ order, trucks }) {
  if (!order) return null;

  const cargo = buildCargo(order);
  const totalWeight = cargo.reduce((a, c) => a + c.totalWeight, 0);

  // caminhão principal do pedido + demais ativos como excedente
  const primary = trucks.find(t => (t.code || '').trim() === order.truck_type);
  const others = trucks.filter(t => t !== primary);
  const truckPool = primary ? [primary, ...others] : trucks;
  const loads = distributeCargo(cargo, truckPool);

  const coords = order.delivery_lat && order.delivery_lng
    ? `${order.delivery_lat},${order.delivery_lng}`
    : null;
  const q = coords || order.delivery_address || '';
  const embedUrl = q
    ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed&z=15`
    : null;
  const wazeUrl = coords
    ? `https://waze.com/ul?ll=${coords}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(order.delivery_address || '')}`;
  const gmapsUrl = q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg">#{order.order_number} — {order.client_name}</h2>
            {order.delivery_address && (
              <p className="text-sm text-muted-foreground flex items-start gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {order.delivery_address}
              </p>
            )}
            {order.delivery_date && (
              <p className="text-xs text-muted-foreground mt-0.5">Entrega: {new Date(order.delivery_date).toLocaleDateString('pt-BR')}</p>
            )}
          </div>
          {order.seller_name && (
            <span className="text-xs text-muted-foreground shrink-0">Vendedor: {order.seller_name}</span>
          )}
        </div>

        {embedUrl ? (
          <div className="relative rounded-xl overflow-hidden border" style={{ height: 220 }}>
            <iframe title="Mapa de entrega" src={embedUrl} width="100%" height="220" style={{ border: 0 }} allowFullScreen loading="lazy" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Endereço não informado para este pedido.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-primary text-primary-foreground">
            <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="w-4 h-4" /> Abrir no Waze
            </a>
          </Button>
          {gmapsUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={gmapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" /> Google Maps
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Carga a carregar */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> O que carregar
          </h3>
          <span className="text-sm font-semibold flex items-center gap-1">
            <Weight className="w-4 h-4" /> {totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2.5 font-medium">Treliça</th>
              <th className="text-left p-2.5 font-medium">Tamanho</th>
              <th className="text-right p-2.5 font-medium">Qtd</th>
              <th className="text-right p-2.5 font-medium">Peso/un</th>
              <th className="text-right p-2.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {cargo.map(c => (
              <tr key={c.idx} className="border-b last:border-0">
                <td className="p-2.5">{c.truss_type}</td>
                <td className="p-2.5 text-muted-foreground">{c.size || '—'}</td>
                <td className="p-2.5 text-right">{c.quantity}</td>
                <td className="p-2.5 text-right text-muted-foreground">{c.unitWeight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                <td className="p-2.5 text-right font-medium">{c.totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Distribuição por caminhão */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" /> Distribuição por caminhão
        </h3>
        {loads.map((load, i) => {
          const cap = Number(load.truck.capacity_kg) || 0;
          const pct = cap > 0 ? Math.round((load.weight / cap) * 100) : 0;
          const overload = load.weight > cap;
          return (
            <div key={i} className="bg-card rounded-2xl border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{load.truck.name}{load.truck.code ? ` (${load.truck.code.trim()})` : ''}</p>
                  <p className="text-xs text-muted-foreground">Capacidade: {cap.toLocaleString('pt-BR')} kg</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{load.weight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</p>
                  <p className={`text-xs font-medium ${overload ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {overload ? 'SOBRECARGA ' : ''}{pct}%
                  </p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${overload ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {load.items.map((it, j) => (
                  <span key={j} className={`text-xs px-2 py-1 rounded-full border ${it.overload ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-border bg-muted/40'}`}>
                    {it.quantity}× {it.truss_type}{it.size ? ` ${it.size}` : ''}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Conferência de carga no caminhão (bipagem) */}
      <LoadChecklist order={order} />

      {/* Confirmação de entrega: fotos + assinatura do recebedor (CPF/RG) */}
      <div className="bg-card rounded-2xl border p-4">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-1">
          <Pen className="w-4 h-4 text-primary" /> Confirmação de Entrega
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Anexe fotos da entrega e colete a assinatura do cliente com CPF/RG.
        </p>
        <DeliveryReceiptTab order={order} />
      </div>
    </div>
  );
}