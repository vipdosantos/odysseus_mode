import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Pencil, Printer, Calendar, Phone, User, ChevronRight, Trash2, Archive } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ALL_STATUSES, STATUS_MAP } from './KanbanColumn';
import OrderPaymentTab from './OrderPaymentTab';
import OrderNFTab from './OrderNFTab';
import QRZoomModal from './QRZoomModal';

export default function OrderDetailDialog({ open, onOpenChange, order, onEdit, canEdit, onStatusChange, onDelete, onArchive }) {
  const [zoomQR, setZoomQR] = useState(null); // { url, label }
  if (!order) return null;
  const st = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-400' };
  const currentIdx = ALL_STATUSES.findIndex(s => s.key === order.status);
  const nextStatus = ALL_STATUSES[currentIdx + 1];
  const prevStatus = ALL_STATUSES[currentIdx - 1];

  const handlePrintLabels = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Each unit gets a UNIQUE QR with its unit index to prevent double-scan errors
    const labels = (order.items || []).flatMap(item => {
      const qty = item.quantity || 0;
      return Array.from({ length: qty }, (_, i) => {
        const unitId = `${order.order_number}-${item.size}-UN${i + 1}`;
        const qrData = JSON.stringify({
          pedido: order.order_number,
          tamanho: item.size,
          unidade: i + 1,
          total: qty,
          id: unitId,
        });
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrData)}`;
        const phone = order.client_phone ? `(${order.client_phone})` : '';
        return `
        <div class="label">
          <div class="size-top">${item.size}</div>
          <div class="phone-row">${phone}</div>
          <div class="brand-block">
            <div class="brand-inner">
              <div class="truss-icon">
                <svg viewBox="0 0 80 20" width="52" height="13" fill="none">
                  <polyline points="0,18 10,2 20,18 30,2 40,18 50,2 60,18 70,2 80,18" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="brand-name">MODELAJES</div>
            </div>
          </div>
          <div class="qr-block">
            <img src="${qrUrl}" class="qr-img" />
          </div>
          <div class="desc-row">${item.size}</div>
          <div class="size-bottom">${item.size}</div>
          <div class="client-row">${order.client_name}</div>
          <div class="unit-row">${i + 1} / ${qty}</div>
        </div>`;
      });
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas #${order.order_number}</title>
    <style>
      @page { size: 60mm 100mm portrait; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }
      .label {
        width: 60mm; height: 100mm;
        display: flex; flex-direction: column; align-items: center;
        border: 0.3mm solid #000;
        page-break-after: always;
        overflow: hidden;
        padding: 0;
      }
      .size-top {
        font-size: 13mm; font-weight: 900; line-height: 1;
        text-align: center; padding: 2mm 0 1mm;
        letter-spacing: -0.5mm;
      }
      .phone-row {
        font-size: 4.5mm; font-weight: 500;
        text-align: center; padding-bottom: 1mm;
      }
      .brand-block {
        background: #000; color: #fff;
        width: 100%; display: flex; justify-content: center; align-items: center;
        padding: 2mm 3mm;
      }
      .brand-inner { display: flex; flex-direction: column; align-items: center; gap: 0.5mm; }
      .truss-icon { display: flex; align-items: center; }
      .brand-name { font-size: 6mm; font-weight: 900; letter-spacing: 1.5px; }
      .qr-block {
        flex: 1; display: flex; align-items: center; justify-content: center;
        padding: 2mm;
      }
      .qr-img { width: 38mm; height: 38mm; display: block; }
      .desc-row {
        font-size: 4mm; font-weight: 700; text-align: center;
        text-decoration: underline; padding: 0 2mm 1mm;
        border-bottom: 0.3mm solid #000; width: 100%;
      }
      .size-bottom {
        font-size: 11mm; font-weight: 900; text-align: center;
        padding: 1mm 0; line-height: 1; letter-spacing: -0.5mm;
      }
      .client-row {
        font-size: 4mm; font-weight: 700; text-align: center;
        text-decoration: underline; padding-bottom: 1mm;
        letter-spacing: 0.2mm;
      }
      .unit-row {
        font-size: 3.5mm; color: #333; text-align: center; padding-bottom: 1.5mm;
      }
      @media print {
        body { margin: 0; }
      }
    </style></head>
    <body>${labels}<script>window.onload=function(){setTimeout(function(){window.print();},800);}<\/script></body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Pedido #{order.order_number}</DialogTitle>
            <span className={cn("text-xs px-3 py-1 rounded-full font-semibold text-white", st.color)}>
              {st.label}
            </span>
          </div>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="detalhes" className="flex-1 text-xs">Detalhes</TabsTrigger>
            <TabsTrigger value="pagamento" className="flex-1 text-xs">Pagamento</TabsTrigger>
            <TabsTrigger value="nota" className="flex-1 text-xs">Nota Fiscal</TabsTrigger>
          </TabsList>

          {/* ── ABA DETALHES ── */}
          <TabsContent value="detalhes">
            <div className="space-y-4 mt-4">
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

              {canEdit && (nextStatus || prevStatus) && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Mover para:</p>
                  <div className="flex gap-2 flex-wrap">
                    {prevStatus && (
                      <Button size="sm" variant="outline" onClick={() => onStatusChange(order, prevStatus.key)} className="text-xs">
                        ← {prevStatus.label}
                      </Button>
                    )}
                    {nextStatus && (
                      <Button size="sm" onClick={() => onStatusChange(order, nextStatus.key)} className="text-xs bg-primary text-primary-foreground">
                        {nextStatus.label} <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

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
                        <img
                          src={qrUrl}
                          alt="QR Code"
                          className="rounded w-16 h-16 shrink-0 cursor-zoom-in hover:scale-105 transition-transform border border-border"
                          title="Clique para ampliar"
                          onClick={() => setZoomQR({ url: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`, label: item.qr_code_id || `${order.order_number}-${item.size}-${idx}` })}
                        />
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

              <div className="flex gap-2 pt-2 flex-wrap">
                <Button onClick={handlePrintLabels} variant="outline" className="flex-1 min-w-[140px]">
                  <Printer className="w-4 h-4 mr-2" /> Imprimir Etiquetas
                </Button>
                {canEdit && (
                  <Button onClick={() => onEdit(order)} className="flex-1 min-w-[100px] bg-primary text-primary-foreground">
                    <Pencil className="w-4 h-4 mr-2" /> Editar
                  </Button>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={() => { onArchive && onArchive(order); onOpenChange(false); }}
                  >
                    <Archive className="w-4 h-4 mr-2" /> Arquivar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => { if (window.confirm('Excluir este pedido? Essa ação não pode ser desfeita.')) { onDelete && onDelete(order); onOpenChange(false); } }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── ABA PAGAMENTO ── */}
          <TabsContent value="pagamento">
            <OrderPaymentTab order={order} />
          </TabsContent>

          {/* ── ABA NOTA FISCAL ── */}
          <TabsContent value="nota">
            <OrderNFTab order={order} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* QR Zoom */}
    {zoomQR && (
      <QRZoomModal
        open={!!zoomQR}
        onClose={() => setZoomQR(null)}
        qrUrl={zoomQR.url}
        label={zoomQR.label}
      />
    )}
  </>
  );
}