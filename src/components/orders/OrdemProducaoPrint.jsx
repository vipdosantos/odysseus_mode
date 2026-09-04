import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { LOGO_URL } from '@/components/layout/ModelajesLogo';
import { TRUSS_TYPE_LABEL, FERRO_LABEL } from '@/lib/trussTypes';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ROWS_PER_COL = 30;

function fmtDate(d) {
  if (!d) return '';
  try { return format(parseISO(d), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return d; }
}

export default function OrdemProducaoPrint({ order, onClose }) {
  const docRef = useRef(null);
  if (!order) return null;

  const handlePrint = () => {
    const node = docRef.current;
    if (!node) return;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:0;';
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    };
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ordem de Produção ${order.order_number}</title>
      <style>
        @page { size: A4 landscape; margin: 5mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        td, th { border: 1px solid #000; padding: 2px 4px; text-align: center; }
        th { background: #f0f0f0; font-weight: bold; }
        .border-2 { border: 2px solid #000; padding: 20px; }
        .header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .header img { height: 48px; }
        .header .title { flex: 1; text-align: center; font-weight: bold; font-size: 18px; }
        .header .num { text-align: right; font-size: 12px; font-weight: bold; }
        .dados { margin-bottom: 16px; font-size: 12px; line-height: 1.8; }
        .dados .row { display: flex; gap: 32px; }
        .dados .field { flex: 1; }
        .dados .label { font-weight: bold; }
        .dados .value { border-bottom: 1px solid #000; display: inline-block; min-width: 180px; }
        .cols { display: flex; gap: 16px; margin-bottom: 16px; }
        .col { flex: 1; }
        .resumo { display: flex; gap: 24px; margin-top: 8px; font-size: 11px; }
        .resumo .qtd { font-weight: bold; }
        .total { display: flex; justify-content: flex-end; margin-bottom: 16px; font-size: 12px; gap: 8px; align-items: center; }
        .total .val { border: 2px solid #000; padding: 2px 12px; font-weight: bold; min-width: 60px; text-align: center; }
        .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding-top: 16px; border-top: 2px solid #000; font-size: 11px; }
        .assinaturas .campo { margin-bottom: 16px; }
        .assinaturas .linha { border-bottom: 1px solid #000; margin-top: 4px; height: 24px; }
      </style></head><body>${node.innerHTML}</body></html>`);
    doc.close();
  };

  const items = order.items || [];
  const half = Math.ceil(items.length / 2);
  const colA = items.slice(0, half);
  const colB = items.slice(half);

  const padCol = (col) => {
    const padded = [...col];
    while (padded.length < ROWS_PER_COL) padded.push(null);
    return padded.slice(0, ROWS_PER_COL);
  };

  const colARows = padCol(colA);
  const colBRows = padCol(colB);

  const totalQty = items.reduce((a, it) => a + (Number(it.quantity) || 0), 0);

  const renderRow = (item, idx) => {
    if (!item) {
      return (
        <tr key={idx}>
          <td className="border border-black h-6"></td>
          <td className="border border-black"></td>
          <td className="border border-black"></td>
          <td className="border border-black"></td>
          <td className="border border-black"></td>
          <td className="border border-black"></td>
          <td className="border border-black"></td>
        </tr>
      );
    }
    const ad = item.adicionais || [];
    return (
      <tr key={idx}>
        <td className="border border-black text-center h-6 font-semibold">{item.quantity || ''}</td>
        <td className="border border-black text-center">{item.truss_type ? TRUSS_TYPE_LABEL(item.truss_type) : ''}</td>
        <td className="border border-black text-center">{item.size || ''}</td>
        <td className="border border-black text-center">{ad[0]?.quantity > 0 ? ad[0].quantity : ''}</td>
        <td className="border border-black text-center">{ad[0]?.diametro ? FERRO_LABEL(ad[0].diametro) : ''}</td>
        <td className="border border-black text-center">{ad[1]?.quantity > 0 ? ad[1].quantity : ''}</td>
        <td className="border border-black text-center">{ad[1]?.diametro ? FERRO_LABEL(ad[1].diametro) : ''}</td>
      </tr>
    );
  };

  const renderColumn = (rows) => (
    <div className="flex-1">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-1 py-1 w-12">Quant.<br/>Viga</th>
            <th className="border border-black px-1 py-1 w-14">Treliça</th>
            <th className="border border-black px-1 py-1 w-20">Comp.<br/>Vigota</th>
            <th className="border border-black px-1 py-1 w-12">Quant.<br/>Ø</th>
            <th className="border border-black px-1 py-1 w-14">Reforço<br/>Ø</th>
            <th className="border border-black px-1 py-1 w-12">Quant.<br/>Ø</th>
            <th className="border border-black px-1 py-1 w-14">Reforço<br/>Ø</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => renderRow(item, idx))}
        </tbody>
      </table>
      <div className="flex items-center gap-6 mt-2 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="font-semibold">QTDE:</span>
          <span className="border-b border-black inline-block min-w-[50px]">&nbsp;</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold">CARREGAR:</span>
          <label className="flex items-center gap-1">SIM: <span className="inline-block w-3 h-3 border border-black"></span></label>
          <label className="flex items-center gap-1">NÃO: <span className="inline-block w-3 h-3 border border-black"></span></label>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/50 overflow-y-auto p-4" style={{ pointerEvents: 'auto' }} onClick={onClose}>
      <div className="max-w-[280mm] mx-auto" onClick={(e) => e.stopPropagation()}>
        <div className="no-print sticky top-0 z-10 flex items-center justify-between p-3 bg-white rounded-t-lg shadow-lg border-b">
          <h2 className="font-bold text-lg">Ordem de Produção — #{order.order_number}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted border"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div ref={docRef} className="ordem-producao-print bg-white rounded-b-lg shadow-2xl p-6">
          <div className="border-2 border-black p-5 text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div className="flex items-center gap-3 border-b-2 border-black pb-2 mb-3">
              <img src={LOGO_URL} alt="Modelajes" className="h-12 w-auto object-contain" />
              <div className="flex-1 text-center font-bold text-lg">ORDEM DE PRODUÇÃO</div>
              <div className="text-right text-xs font-semibold">Nº {order.order_number}</div>
            </div>

            <div className="space-y-1.5 mb-4 text-[12px]">
              <div className="flex gap-8">
                <div className="flex-1">
                  <span className="font-semibold">CLIENTE: </span>
                  <span className="border-b border-black inline-block min-w-[200px]">{order.client_name || ''}</span>
                </div>
                <div className="flex-1">
                  <span className="font-semibold">VENDEDOR: </span>
                  <span className="border-b border-black inline-block min-w-[180px]">{order.seller_name || ''}</span>
                </div>
              </div>
              <div>
                <span className="font-semibold">END. DA ENTREGA: </span>
                <span className="border-b border-black inline-block min-w-[440px]">{order.delivery_address || ''}</span>
              </div>
              <div className="flex gap-8">
                <div className="flex-1">
                  <span className="font-semibold">DATA DO PEDIDO: </span>
                  <span className="border-b border-black inline-block min-w-[200px]">{fmtDate(order.created_date?.slice(0, 10))}</span>
                </div>
                <div className="flex-1">
                  <span className="font-semibold">DATA DA ENTREGA: </span>
                  <span className="border-b border-black inline-block min-w-[180px]">{fmtDate(order.delivery_date)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              {renderColumn(colARows)}
              {renderColumn(colBRows)}
            </div>

            <div className="flex justify-end mb-4 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold">QTDE TOTAL DE VIGAS:</span>
                <span className="border-2 border-black px-3 py-0.5 font-bold min-w-[60px] text-center">{totalQty}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-black text-[11px]">
              <div className="space-y-4">
                <div>
                  <span className="font-semibold">Ordem de Produção:</span>
                  <div className="border-b border-black mt-1 h-6"></div>
                </div>
                <div>
                  <span className="font-semibold">Etiqueta:</span>
                  <div className="border-b border-black mt-1 h-6"></div>
                </div>
                <div>
                  <span className="font-semibold">Entregue por:</span>
                  <div className="border-b border-black mt-1 h-6"></div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="font-semibold">Recebido por:</span>
                  <div className="border-b border-black mt-1 h-6"></div>
                </div>
                <div>
                  <span className="font-semibold">RG / CPF:</span>
                  <div className="border-b border-black mt-1 h-6"></div>
                </div>
                <div>
                  <span className="font-semibold">Data de Recebimento:</span>
                  <div className="border-b border-black mt-1 h-6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}