import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Pencil, Printer, Calendar, Phone, Mail, User, ChevronRight, Trash2, Archive } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DEFAULT_STATUSES } from './KanbanColumn';
import OrderPaymentTab from './OrderPaymentTab';
import OrderNFTab from './OrderNFTab';
import QRZoomModal from './QRZoomModal';
import DeliveryReceiptTab from './DeliveryReceiptTab';
import OrderQuoteTab from './OrderQuoteTab';
import OrdemProducaoPrint from './OrdemProducaoPrint';
import { TRUSS_TYPE_LABEL, FERRO_LABEL } from '@/lib/trussTypes';
import { calcSquareMeters, calcTotalSquareMeters, calcEpsPlates, calcTotalEpsPlates, fmtM2, fmtQty } from '@/lib/squareMeters';
import { LOGO_URL } from '@/components/layout/ModelajesLogo';

export default function OrderDetailDialog({ open, onOpenChange, order, onEdit, canEdit, onStatusChange, onDelete, onArchive, columns }) {
  const [zoomQR, setZoomQR] = useState(null); // { url, label }
  const [showOrdemProducao, setShowOrdemProducao] = useState(false);
  if (!order) return null;
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_STATUSES;
  const STATUS_MAP = Object.fromEntries(cols.map(c => [c.key, c]));

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
        const seller = order.seller_name || '';
        const enchLabel = order.tipo_enchimento && order.tipo_enchimento !== 'Nenhum' ? ` - ${order.tipo_enchimento}` : '';
        const trussLabel = item.truss_type ? TRUSS_TYPE_LABEL(item.truss_type) : '';
        const specLabel = `Laje ${trussLabel}${enchLabel}`;
        const localMontagem = item.local_montagem || '';
        const adics = (item.adicionais || []).filter(a => a.quantity > 0).map(a => `${FERRO_LABEL(a.diametro)} ×${a.quantity}`).join('   ');
        return `
        <div class="label">
          <div class="top-section">
            <div class="logo-section">
              <img src="${LOGO_URL}" class="brand-logo" />
            </div>
            <div class="qr-row">
              <span class="local-mont">${localMontagem}</span>
              <img src="${qrUrl}" class="qr" />
            </div>
          </div>
          <div class="spacer"></div>
          <div class="footer">
            <div class="spec-row">
              <span class="spec">${specLabel}</span>
              <span class="adicionais">${adics}</span>
            </div>
            <div class="size">${item.size || ''}</div>
            <div class="seller">${seller}</div>
            <div class="qty-vigota">QTDE VIGOTA: ${item.quantity || ''}</div>
          </div>
        </div>`;
      });
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas #${order.order_number}</title>
    <style>
      @page { size: 50mm 100mm; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', Arial, Helvetica, sans-serif; background: #fff; color: #000; }
      .label {
        width: 50mm; height: 100mm;
        page-break-after: always; overflow: hidden;
        background: #fff; position: relative;
        display: flex; flex-direction: column;
        align-items: center;
        padding: 3mm 2mm;
      }
      .top-section {
        flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; width: 100%;
        transform: rotate(180deg);
        margin-bottom: 2mm;
      }
      .logo-section {
        width: 100%; display: flex; justify-content: center;
        margin-bottom: 1mm;
      }
      .brand-logo { height: 6mm; width: auto; }
      .qr-row {
        display: flex; align-items: center; justify-content: center; gap: 2mm; width: 100%;
      }
      .local-mont {
        font-size: 10mm; font-weight: 800; line-height: 1; text-align: center;
      }
      .qr { width: 18mm; height: 18mm; display: block; }
      .spacer { flex: 1; }
      .footer { flex: 0 0 auto; width: 100%; }
      .spec-row {
        width: 100%; display: flex; align-items: baseline; justify-content: center; gap: 2mm;
        border-bottom: 0.3mm solid #000; padding-bottom: 0.5mm;
        margin-bottom: 2mm;
      }
      .spec { font-size: 4mm; font-weight: 700; }
      .adicionais { font-size: 3.5mm; font-weight: 600; }
      .size {
        font-size: 18mm; font-weight: 800; line-height: 1; text-align: center;
        margin-bottom: 2mm;
      }
      .seller {
        font-size: 4mm; font-weight: 600; text-align: center;
        border-bottom: 0.3mm solid #000; padding-bottom: 0.5mm;
        margin-bottom: 1mm;
      }
      .qty-vigota {
        font-size: 4mm; font-weight: 700; text-align: center;
      }
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
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => { if (showOrdemProducao) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (showOrdemProducao) e.preventDefault(); }}
      >
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
            <TabsTrigger value="orcamento" className="flex-1 text-xs">Orçamento</TabsTrigger>
            <TabsTrigger value="pagamento" className="flex-1 text-xs">Pagamento</TabsTrigger>
            <TabsTrigger value="nota" className="flex-1 text-xs">Nota Fiscal</TabsTrigger>
            <TabsTrigger value="recibo" className="flex-1 text-xs">Recibo</TabsTrigger>
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
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">m² (interno):</span>
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{fmtM2(calcSquareMeters(item, order.quote_tipo_laje))} m²</span>
                            {order.tipo_enchimento === 'EPS' && (
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-1">
                                Placas EPS: {fmtQty(calcEpsPlates(item, order.quote_tipo_laje))}
                              </span>
                            )}
                          </div>
                          {order.tipo_enchimento && order.tipo_enchimento !== 'Nenhum' && item.enchimento_dimension && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] text-muted-foreground">Dimensão {order.tipo_enchimento}:</span>
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">{item.enchimento_dimension}</span>
                            </div>
                          )}
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

              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600">Total m² ({order.quote_tipo_laje || 'Laje'}) — interno</span>
                <span className="text-sm font-bold text-slate-800">{fmtM2(calcTotalSquareMeters(order.items, order.quote_tipo_laje))} m²</span>
              </div>
              {order.tipo_enchimento === 'EPS' && (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <span className="text-xs font-semibold text-amber-800">Total Placas EPS ({order.quote_tipo_laje || 'Laje'}) — m² × {(order.quote_tipo_laje === 'Painel') ? '3,9' : (order.quote_tipo_laje === 'Laje Treliçada Intereixo') ? '1,9' : '2,3'}</span>
                  <span className="text-sm font-bold text-amber-900">{fmtQty(calcTotalEpsPlates(order.items, order.quote_tipo_laje))} placas</span>
                </div>
              )}

              <div className="flex gap-2 pt-2 flex-wrap">
                <Button onClick={handlePrintLabels} variant="outline" className="flex-1 min-w-[140px]">
                  <Printer className="w-4 h-4 mr-2" /> Imprimir Etiquetas
                </Button>
                <Button onClick={() => setShowOrdemProducao(true)} variant="outline" className="flex-1 min-w-[140px]">
                  <Printer className="w-4 h-4 mr-2" /> Ordem de Produção
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

          {/* ── ABA ORÇAMENTO ── */}
          <TabsContent value="orcamento">
            <OrderQuoteTab order={order} />
          </TabsContent>

          {/* ── ABA NOTA FISCAL ── */}
          <TabsContent value="nota">
            <OrderNFTab order={order} />
          </TabsContent>

          {/* ── ABA RECIBO ── */}
          <TabsContent value="recibo">
            <DeliveryReceiptTab order={order} />
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

    {/* Ordem de Produção (imprimível) */}
    {showOrdemProducao && (
      <OrdemProducaoPrint order={order} onClose={() => setShowOrdemProducao(false)} />
    )}
  </>
  );
}