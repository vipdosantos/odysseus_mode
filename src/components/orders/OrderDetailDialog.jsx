import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Pencil, Printer, Calendar, Phone, Mail, User, ChevronRight, Trash2, Archive, Link2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DEFAULT_STATUSES } from './KanbanColumn';
import OrderPaymentTab from './OrderPaymentTab';
import OrderNFTab from './OrderNFTab';
import QRZoomModal from './QRZoomModal';
import DeliveryReceiptTab from './DeliveryReceiptTab';
import ContractTab from './ContractTab';
import { TRUSS_TYPE_LABEL, FERRO_LABEL } from '@/lib/trussTypes';
import { LOGO_URL } from '@/components/layout/ModelajesLogo';

export default function OrderDetailDialog({ open, onOpenChange, order, onEdit, canEdit, onStatusChange, onDelete, onArchive, columns }) {
  const [zoomQR, setZoomQR] = useState(null); // { url, label }
  const [linkCopied, setLinkCopied] = useState(false);
  if (!order) return null;
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_STATUSES;
  const STATUS_MAP = Object.fromEntries(cols.map(c => [c.key, c]));

  const handleCopyStatusLink = () => {
    const url = `${window.location.origin}/status/${order.access_key}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  const st = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-400' };
  const currentIdx = cols.findIndex(s => s.key === order.status);
  const nextStatus = cols[currentIdx + 1];
  const prevStatus = cols[currentIdx - 1];

  const handlePrintLabels = () => {
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
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=000000&bgcolor=ffffff&margin=0&data=${encodeURIComponent(qrData)}`;
        const phone = order.seller_phone || '';
        const seller = order.seller_name || '';
        const extras = [];
        if (item.truss_type) extras.push(TRUSS_TYPE_LABEL(item.truss_type));
        (item.adicionais || []).forEach(a => { if (a.quantity > 0) extras.push(`${FERRO_LABEL(a.diametro)} ×${a.quantity}`); });
        const specs = extras.join('   ·   ');
        return `
        <div class="label">
          <div class="accent"></div>
          <div class="body">
            <div class="main">
              <div class="top">
                <img src="${LOGO_URL}" class="logo" />
                <span class="meta">Pedido ${order.order_number}</span>
              </div>
              <div class="client">${order.client_name}</div>
              <div class="specs">${specs}</div>
              <div class="footer">
                <div class="unit"><span class="u-label">Unidade</span><span class="u-val">${i + 1} / ${qty}</span></div>
                <span class="dot">·</span>
                <span class="seller">${seller}${phone ? ' · ' + phone : ''}</span>
              </div>
            </div>
            <div class="side">
              <img src="${qrUrl}" class="qr" />
              <span class="badge">${item.size}</span>
            </div>
          </div>
        </div>`;
      });
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas #${order.order_number}</title>
    <style>
      @page { size: 100mm 50mm; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', Arial, Helvetica, sans-serif; background: #fff; color: #111; }
      .label {
        width: 100mm; height: 50mm;
        page-break-after: always; overflow: hidden;
        background: #fff; position: relative;
        border: 0.2mm solid #e5e7eb;
      }
      .accent { position: absolute; top: 0; left: 0; right: 0; height: 1.6mm; background: #f59e0b; }
      .body { position: absolute; top: 1.6mm; left: 0; right: 0; bottom: 0; display: flex; flex-direction: row; }
      .main { flex: 1; padding: 2.4mm 3.2mm; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
      .top { display: flex; align-items: center; gap: 2mm; }
      .logo { height: 4.2mm; width: auto; }
      .meta { font-size: 2.4mm; font-weight: 600; color: #9ca3af; letter-spacing: 0.3mm; text-transform: uppercase; margin-left: auto; }
      .client { font-size: 6mm; font-weight: 700; color: #111; line-height: 1.05; word-break: break-word; }
      .specs { font-size: 2.8mm; font-weight: 600; color: #6b7280; margin-top: 0.6mm; }
      .footer { display: flex; align-items: baseline; gap: 2mm; margin-top: auto; }
      .unit { display: flex; align-items: baseline; gap: 1.2mm; }
      .u-label { font-size: 2.2mm; font-weight: 700; color: #9ca3af; letter-spacing: 0.3mm; text-transform: uppercase; }
      .u-val { font-size: 3.6mm; font-weight: 800; color: #111; }
      .dot { color: #d1d5db; font-size: 2.6mm; }
      .seller { font-size: 2.6mm; font-weight: 600; color: #6b7280; }
      .side { width: 30mm; padding: 2.4mm 3mm 2.4mm 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.4mm; }
      .qr { width: 22mm; height: 22mm; display: block; }
      .badge { font-size: 4.6mm; font-weight: 800; color: #111; background: #f3f4f6; border-radius: 1.4mm; padding: 0.3mm 2.2mm; letter-spacing: 0.1mm; }
      @media print { body { margin: 0; } }
    </style></head>
    <body>${labels}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:0;';
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 800);
    };
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
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
            <TabsTrigger value="contrato" className="flex-1 text-xs">Contrato</TabsTrigger>
            <TabsTrigger value="log" className="flex-1 text-xs">Log Bipagem</TabsTrigger>
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
                {order.client_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">{order.client_email}</span>
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

          {/* ── ABA CONTRATO ── */}
          <TabsContent value="contrato">
            <ContractTab order={order} canEdit={canEdit} />
          </TabsContent>

          {/* ── ABA LOG DE BIPAGEM ── */}
          <TabsContent value="log">
            {(() => {
              const items = order.items || [];
              const logByKey = {};
              (order.scan_log || []).forEach(e => {
                logByKey[`${e.item_idx}:${e.unit}:${e.stage}`] = e;
              });
              const entries = [];
              items.forEach((it, idx) => {
                const sc = it.stage_conferencias || {};
                const stages = new Set(Object.keys(sc));
                if (Array.isArray(it.scanned_units) && it.scanned_units.length) stages.add('producao');
                if (Array.isArray(it.delivered_units) && it.delivered_units.length) stages.add('entrega');
                stages.forEach(stage => {
                  let units = Array.isArray(sc[stage]) ? sc[stage]
                    : (stage === 'producao' && Array.isArray(it.scanned_units) ? it.scanned_units
                    : (stage === 'entrega' && Array.isArray(it.delivered_units) ? it.delivered_units : []));
                  units.forEach(u => {
                    const log = logByKey[`${idx}:${u}:${stage}`];
                    entries.push({
                      stage,
                      stage_label: log?.stage_label || (stage || '').replace(/_/g, ' '),
                      size: it.size,
                      unit: u,
                      operator_name: log?.operator_name || '',
                      operator_email: log?.operator_email || '',
                      at: log?.at || '',
                    });
                  });
                });
              });
              entries.sort((a, b) => {
                if (a.at && b.at) return b.at.localeCompare(a.at);
                if (a.at) return -1;
                if (b.at) return 1;
                return 0;
              });
              if (entries.length === 0) {
                return <p className="text-sm text-muted-foreground mt-4">Nenhuma bipagem registrada ainda.</p>;
              }
              return (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {entries.length} bipagem(ns) registrada(s)
                  </p>
                  {entries.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm border rounded-lg p-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0">{e.unit}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{e.size} · unidade {e.unit}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {e.stage_label}
                          {e.operator_name ? ` · ${e.operator_name}${e.operator_email ? ` (${e.operator_email})` : ''}` : ' · sem registro de operador'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {e.at ? format(new Date(e.at), 'dd/MM/yyyy HH:mm') : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
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