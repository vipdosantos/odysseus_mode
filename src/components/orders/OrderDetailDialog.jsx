import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Pencil, Printer, Calendar, Phone, User, ChevronRight, Trash2, Archive, Link2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { ALL_STATUSES, STATUS_MAP } from './KanbanColumn';
import OrderPaymentTab from './OrderPaymentTab';
import OrderNFTab from './OrderNFTab';
import QRZoomModal from './QRZoomModal';
import DeliveryReceiptTab from './DeliveryReceiptTab';
import { TRUSS_TYPE_LABEL, FERRO_LABEL } from '@/lib/trussTypes';

export default function OrderDetailDialog({ open, onOpenChange, order, onEdit, canEdit, onStatusChange, onDelete, onArchive }) {
  const [zoomQR, setZoomQR] = useState(null); // { url, label }
  const [linkCopied, setLinkCopied] = useState(false);
  if (!order) return null;

  const handleCopyStatusLink = () => {
    const url = `${window.location.origin}/status/${order.access_key}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  const st = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-400' };
  const currentIdx = ALL_STATUSES.findIndex(s => s.key === order.status);
  const nextStatus = ALL_STATUSES[currentIdx + 1];
  const prevStatus = ALL_STATUSES[currentIdx - 1];

  const handlePrintLabels = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Each unit gets a UNIQUE QR with its unit index to prevent double-scan errors
    const labels = (order.items || []).flatMap((item, idx) => {
      const qty = item.quantity || 0;
      return Array.from({ length: qty }, (_, i) => {
        const unitId = `${order.order_number}-I${idx}-${item.size}-UN${i + 1}`;
        const qrData = JSON.stringify({
          pedido: order.order_number,
          item_idx: idx,
          tamanho: item.size,
          unidade: i + 1,
          total: qty,
          id: unitId,
        });
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrData)}`;
        const phone = order.seller_phone ? order.seller_phone : (order.client_phone || '');
        return `
        <div class="label">
          <div class="label-inner">
          <div class="label-header">
            <img src="https://media.base44.com/images/public/69e67ee13ca6bee2db939472/a733a5b7d_graph-paper-5mm-1-en.png" class="brand-logo" alt="Modelajes" />
            <span class="size-band">${item.size}</span>
          </div>
          <div class="label-body">
            <div class="qr-block">
              <img src="${qrUrl}" class="qr-img" />
            </div>
            <div class="info-stack">
              <div class="info-cell">
                <span class="info-label">Cliente</span>
                <span class="info-value client-name">${order.client_name}</span>
              </div>
              <div class="info-cell unit-cell">
                <span class="info-label">Unidade</span>
                <span class="info-value unit-value">${i + 1} / ${qty}</span>
              </div>
              <div class="phone-row">${phone}</div>
            </div>
          </div>
          </div>
        </div>`;
      });
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas #${order.order_number}</title>
    <style>
      @page { size: 50mm 100mm portrait; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', Arial, Helvetica, sans-serif; background: #fff; color: #1a1d23; }
      .label {
        width: 50mm; height: 100mm;
        position: relative;
        page-break-after: always;
        overflow: hidden;
      }
      .label-inner {
        width: 100mm; height: 50mm;
        display: flex; flex-direction: column;
        border: 0.3mm solid #1a1d23;
        position: absolute;
        top: 0; left: 50mm;
        transform: rotate(90deg);
        transform-origin: top left;
        overflow: hidden;
      }
      .label-header {
        background: #1a1d23;
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.2mm 3mm;
      }
      .brand-logo { height: 5mm; width: auto; object-fit: contain; filter: brightness(0) invert(1); }
      .size-band {
        background: #f59e0b; color: #1a1d23;
        font-size: 8mm; font-weight: 900; line-height: 1;
        padding: 0.6mm 3mm; border-radius: 1mm;
      }
      .label-body {
        flex: 1; display: flex; align-items: stretch;
      }
      .qr-block {
        display: flex; align-items: center; justify-content: center;
        padding: 2mm;
        border-right: 0.3mm solid #1a1d23;
      }
      .qr-img {
        width: 33mm; height: 33mm; display: block;
        border: 0.4mm solid #1a1d23; border-radius: 1.5mm; padding: 0.5mm;
      }
      .info-stack {
        flex: 1; display: flex; flex-direction: column; justify-content: space-between;
        padding: 1.2mm 2mm; gap: 0.8mm;
      }
      .info-cell {
        display: flex; align-items: center; gap: 1.5mm;
      }
      .info-label {
        font-size: 2.4mm; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.2mm;
        min-width: 11mm;
      }
      .info-value { font-size: 3.6mm; font-weight: 800; }
      .client-name {
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 44mm;
      }
      .unit-cell .info-label { color: #1a1d23; }
      .unit-value {
        background: #1a1d23; color: #f59e0b;
        padding: 0.4mm 2mm; border-radius: 1mm; font-size: 3.2mm;
      }
      .phone-row {
        font-size: 3.2mm; font-weight: 700; text-align: left;
        letter-spacing: 0.2mm; border-top: 0.3mm solid #ddd; padding-top: 0.8mm;
      }
      @media print { body { margin: 0; } }
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
            <TabsTrigger value="recibo" className="flex-1 text-xs">Recibo</TabsTrigger>
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
                          <div className="flex items-center gap-2">
                            {item.truss_type && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{TRUSS_TYPE_LABEL(item.truss_type)}</span>
                            )}
                            <p className="text-sm font-bold">{item.size}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.produced || 0}/{item.quantity} produzidas</p>
                          {item.adicionais?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-[10px] text-muted-foreground self-center">Adicionais:</span>
                              {item.adicionais.map((a, i) => (
                                <span key={i} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                  {FERRO_LABEL(a.diametro)} ×{a.quantity}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5 w-full">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${item.quantity > 0 ? ((item.produced || 0) / item.quantity) * 100 : 0}%` }} />
                          </div>
                          {item.quantity > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Array.from({ length: item.quantity }, (_, u) => {
                                const done = (item.scanned_units || []).includes(u + 1);
                                return (
                                  <span
                                    key={u}
                                    title={`Unidade ${u + 1}${done ? ' (escaneada)' : ' (pendente)'}`}
                                    className={cn(
                                      "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                                      done
                                        ? "bg-green-100 text-green-700 border-green-200"
                                        : "bg-muted text-muted-foreground border-border"
                                    )}
                                  >
                                    {done ? '✓' : u + 1}
                                  </span>
                                );
                              })}
                            </div>
                          )}
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
                {order.access_key && (
                  <Button onClick={handleCopyStatusLink} variant="outline" className="flex-1 min-w-[140px]">
                    {linkCopied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Link2 className="w-4 h-4 mr-2" />}
                    {linkCopied ? 'Link Copiado!' : 'Link de Status'}
                  </Button>
                )}
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

          {/* ── ABA RECIBO ── */}
          <TabsContent value="recibo">
            <DeliveryReceiptTab order={order} />
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