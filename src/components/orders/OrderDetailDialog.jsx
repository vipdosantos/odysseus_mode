import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pencil, Printer, Calendar, Phone, User, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ALL_STATUSES, STATUS_MAP } from './KanbanColumn';

export default function OrderDetailDialog({ open, onOpenChange, order, onEdit, canEdit, onStatusChange }) {
  if (!order) return null;
  const st = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-400' };
  const currentIdx = ALL_STATUSES.findIndex(s => s.key === order.status);
  const nextStatus = ALL_STATUSES[currentIdx + 1];
  const prevStatus = ALL_STATUSES[currentIdx - 1];

  const handlePrintLabels = () => {
    const printWindow = window.open('', '_blank');
    const labels = order.items?.flatMap(item => {
      const qty = item.quantity || 0;
      // QR data contains full order context
      const qrData = JSON.stringify({
        pedido: order.order_number,
        cliente: order.client_name,
        tamanho: item.size,
        quantidade: qty,
        id: item.qr_code_id || `${order.order_number}-${item.size}`,
      });
      return Array.from({ length: qty }, (_, i) => `
        <div style="border:2px solid #333;padding:16px;margin:8px;width:320px;display:inline-block;page-break-inside:avoid;font-family:sans-serif;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <div style="background:#F47920;border-radius:6px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 40 40" width="22" height="22" fill="none"><path d="M6 32 L6 12 L20 26 L34 12 L34 32" stroke="white" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/></svg>
            </div>
            <span style="font-size:18px;font-weight:900;color:#2B3A8F;letter-spacing:2px;">MODELAJES</span>
          </div>
          <div style="font-size:13px;margin-bottom:3px;"><strong>Pedido:</strong> #${order.order_number}</div>
          <div style="font-size:13px;margin-bottom:3px;"><strong>Cliente:</strong> ${order.client_name}</div>
          <div style="font-size:15px;font-weight:bold;margin-bottom:3px;">Tamanho: ${item.size}</div>
          <div style="font-size:11px;color:#666;margin-bottom:8px;">${i + 1} de ${qty}</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrData)}" style="display:block;" />
          <div style="font-size:9px;color:#999;margin-top:4px;word-break:break-all;">${item.qr_code_id || `${order.order_number}-${item.size}`}</div>
        </div>
      `);
    }).join('');
    printWindow.document.write(`<html><head><title>Etiquetas - #${order.order_number}</title></head><body style="margin:16px;">${labels}<script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Pedido #{order.order_number}</DialogTitle>
            <span className={cn("text-xs px-3 py-1 rounded-full font-semibold text-white", st.color)}>
              {st.label}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Client info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{order.client_name}</span>
            </div>
            {order.client_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{order.client_phone}</span>
              </div>
            )}
            {order.delivery_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{format(parseISO(order.delivery_date), 'dd/MM/yyyy')}</span>
              </div>
            )}
            {order.total_value > 0 && (
              <div className="text-sm font-semibold">
                R$ {order.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {order.notes && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">{order.notes}</p>
          )}

          {/* Status pipeline */}
          {canEdit && (nextStatus || prevStatus) && (
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Mover para:</p>
              <div className="flex gap-2 flex-wrap">
                {prevStatus && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStatusChange(order, prevStatus.key)}
                    className="text-xs"
                  >
                    ← {prevStatus.label}
                  </Button>
                )}
                {nextStatus && (
                  <Button
                    size="sm"
                    onClick={() => onStatusChange(order, nextStatus.key)}
                    className="text-xs bg-primary text-primary-foreground"
                  >
                    {nextStatus.label} <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Items with QR */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Itens & QR Codes</h4>
            <div className="space-y-3">
              {order.items?.map((item, idx) => {
                const qrData = JSON.stringify({
                  pedido: order.order_number,
                  cliente: order.client_name,
                  tamanho: item.size,
                  quantidade: item.quantity,
                  id: item.qr_code_id || `${order.order_number}-${item.size}-${idx}`,
                });
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qrData)}`;
                return (
                  <div key={idx} className="p-3 rounded-xl border border-border bg-muted/30 flex gap-3 items-start">
                    <img src={qrUrl} alt="QR Code" className="rounded w-16 h-16 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{item.size}</p>
                      <p className="text-xs text-muted-foreground">{item.produced || 0}/{item.quantity} produzidas</p>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5 w-full">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.quantity > 0 ? ((item.produced || 0) / item.quantity) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1 truncate">
                        {item.qr_code_id || `${order.order_number}-${item.size}-${idx}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handlePrintLabels} variant="outline" className="flex-1">
              <Printer className="w-4 h-4 mr-2" /> Imprimir Etiquetas
            </Button>
            {canEdit && (
              <Button onClick={() => onEdit(order)} className="flex-1 bg-primary text-primary-foreground">
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}