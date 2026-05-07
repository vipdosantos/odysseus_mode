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
    // 10cm x 5cm label — each on its own page for label printers
    const labels = order.items?.flatMap(item => {
      const qty = item.quantity || 0;
      const qrId = item.qr_code_id || `${order.order_number}-${item.size}`;
      const qrData = JSON.stringify({
        pedido: order.order_number,
        cliente: order.client_name,
        tamanho: item.size,
        quantidade: qty,
        id: qrId,
      });
      return Array.from({ length: qty }, (_, i) => `
        <div class="label">
          <div class="label-header">
            <div class="logo-box">
              <svg viewBox="0 0 40 40" width="18" height="18" fill="none">
                <path d="M6 32 L6 12 L20 26 L34 12 L34 32" stroke="white" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
              </svg>
            </div>
            <div>
              <div class="brand">MODELAJES</div>
              <div class="brand-sub">Treliças Metálicas</div>
            </div>
            <div class="seq">${i + 1}/${qty}</div>
          </div>
          <div class="label-body">
            <div class="label-info">
              <div class="size-big">${item.size}</div>
              <div class="info-row"><span class="lbl">Pedido</span> <span class="val">#${order.order_number}</span></div>
              <div class="info-row"><span class="lbl">Cliente</span> <span class="val">${order.client_name}</span></div>
              <div class="info-row"><span class="lbl">Qtd Total</span> <span class="val">${qty} un</span></div>
            </div>
            <div class="qr-col">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrData)}" class="qr-img" />
            </div>
          </div>
          <div class="label-footer">${qrId}</div>
        </div>
      `);
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Etiquetas #${order.order_number}</title>
    <style>
      @page { size: 100mm 50mm landscape; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }
      .label {
        width: 100mm; height: 50mm;
        display: flex; flex-direction: column;
        border: 0.5mm solid #000;
        page-break-after: always;
        overflow: hidden;
      }
      .label-header {
        background: #000;
        color: #fff;
        display: flex; align-items: center; gap: 3mm;
        padding: 1.5mm 3mm;
        height: 11mm;
      }
      .logo-box {
        background: #fff;
        border-radius: 1mm;
        width: 8mm; height: 8mm;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .logo-box svg path { stroke: #000; }
      .brand { font-size: 5mm; font-weight: 900; letter-spacing: 1px; line-height: 1; }
      .brand-sub { font-size: 2mm; opacity: 0.7; }
      .seq { margin-left: auto; font-size: 3.5mm; font-weight: bold; background: #fff; color: #000; padding: 1mm 2mm; border-radius: 1mm; }
      .label-body {
        flex: 1; display: flex; padding: 2mm 3mm; gap: 2mm;
      }
      .label-info { flex: 1; display: flex; flex-direction: column; gap: 1mm; }
      .size-big { font-size: 8mm; font-weight: 900; color: #000; line-height: 1; }
      .info-row { display: flex; gap: 1mm; align-items: baseline; }
      .lbl { font-size: 2mm; color: #555; min-width: 10mm; }
      .val { font-size: 2.5mm; font-weight: bold; color: #000; }
      .qr-col { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .qr-img { width: 24mm; height: 24mm; }
      .label-footer {
        background: #f0f0f0; border-top: 0.2mm solid #999;
        padding: 0.8mm 3mm;
        font-size: 1.8mm; color: #555;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        height: 5mm; display: flex; align-items: center;
      }
      @media print {
        body { margin: 0; }
        .label { border: 0.3mm solid #000; }
      }
    </style></head>
    <body>${labels}<script>setTimeout(()=>window.print(),800)<\/script></body></html>`;

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