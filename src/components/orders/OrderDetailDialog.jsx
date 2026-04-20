import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Printer, QrCode, Calendar, Phone, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import QRCodeDisplay from '../production/QRCodeDisplay';

const statusMap = {
  novo: { label: 'Novo', class: 'bg-blue-100 text-blue-700' },
  em_producao: { label: 'Em Produção', class: 'bg-amber-100 text-amber-700' },
  controle_qualidade: { label: 'Controle de Qualidade', class: 'bg-purple-100 text-purple-700' },
  pronto: { label: 'Pronto', class: 'bg-green-100 text-green-700' },
  entregue: { label: 'Entregue', class: 'bg-gray-100 text-gray-600' },
};

export default function OrderDetailDialog({ open, onOpenChange, order, onEdit, canEdit }) {
  if (!order) return null;
  const st = statusMap[order.status] || statusMap.novo;

  const handlePrintLabels = () => {
    const printWindow = window.open('', '_blank');
    const labels = order.items?.flatMap(item => {
      const qty = item.quantity || 0;
      return Array.from({ length: qty }, (_, i) => `
        <div style="border:2px solid #333;padding:16px;margin:8px;width:300px;display:inline-block;page-break-inside:avoid;font-family:sans-serif;">
          <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">TreliçaPro</div>
          <div style="font-size:14px;margin-bottom:4px;"><strong>Pedido:</strong> #${order.order_number}</div>
          <div style="font-size:14px;margin-bottom:4px;"><strong>Cliente:</strong> ${order.client_name}</div>
          <div style="font-size:16px;font-weight:bold;margin-bottom:4px;">Tamanho: ${item.size}</div>
          <div style="font-size:12px;color:#666;">${i + 1} de ${qty}</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(item.qr_code_id || `${order.order_number}-${item.size}`)}" style="margin-top:8px;" />
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
            <span className={cn("text-xs px-3 py-1 rounded-full font-semibold", st.class)}>{st.label}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
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

          {/* Items with QR */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Itens</h4>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold">{item.size}</p>
                      <p className="text-xs text-muted-foreground">{item.produced || 0}/{item.quantity} produzidas</p>
                    </div>
                    <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${item.quantity > 0 ? ((item.produced || 0) / item.quantity) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <QRCodeDisplay value={item.qr_code_id || `${order.order_number}-${item.size}-${idx}`} size={80} />
                </div>
              ))}
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