import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { Printer, MessageCircle, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { LOGO_URL } from '@/components/layout/ModelajesLogo';
import { TRUSS_TYPE_LABEL, FERRO_LABEL } from '@/lib/trussTypes';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrderQuoteTab({ order }) {
  const [validade, setValidade] = useState(15);
  const [obs, setObs] = useState(order?.notes || '');
  const [sending, setSending] = useState(false);

  const today = new Date();
  const validUntil = addDays(today, Number(validade) || 15);

  const totalItems = useMemo(
    () => (order?.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
    [order]
  );

  const valor = Number(order?.total_value) || 0;
  const valorTexto = valor > 0 ? `R$ ${fmtBRL(valor)}` : 'A combinar';

  const buildHtml = () => {
    const itemsRows = (order.items || []).map((it, i) => {
      const extras = [];
      if (it.truss_type) extras.push(TRUSS_TYPE_LABEL(it.truss_type));
      (it.adicionais || []).forEach(a => { if (a.quantity > 0) extras.push(`${FERRO_LABEL(a.diametro)} ×${a.quantity}`); });
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${it.size || '—'}</strong>${extras.length ? `<br/><span class="muted">${extras.join(' · ')}</span>` : ''}</td>
          <td class="center">${it.quantity || 0}</td>
          <td class="right">${valor > 0 ? fmtBRL(valor / totalItems || 0) : '—'}</td>
        </tr>`;
    }).join('');

    const parcelasTxt = Number(order.installments) > 1
      ? `${order.installments}x de R$ ${fmtBRL(valor / order.installments)}`
      : 'À vista';

    const pagMap = { boleto: 'Boleto', pix: 'PIX', transferencia: 'Transferência', cartao: 'Cartão', dinheiro: 'Dinheiro', cheque: 'Cheque' };
    const pag = pagMap[order.payment_method] || order.payment_method || '—';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento #${order.order_number}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; font-size: 12px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 14px; }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand img { height: 42px; }
      .brand .name { font-size: 16px; font-weight: 800; letter-spacing: 1px; color: #1e293b; }
      .brand .sub { font-size: 10px; color: #64748b; margin-top: 2px; }
      .doc-title { text-align: right; }
      .doc-title h1 { font-size: 20px; color: #f59e0b; }
      .doc-title .num { font-size: 13px; font-weight: 700; margin-top: 2px; }
      .doc-title .dates { font-size: 10px; color: #64748b; margin-top: 4px; }
      .section { margin-bottom: 12px; }
      .section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #f59e0b; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 6px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .box { background: #f8fafc; border-radius: 6px; padding: 8px 10px; }
      .box p { margin: 1px 0; font-size: 11px; }
      .box .lbl { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th { background: #1e293b; color: #fff; font-size: 10px; padding: 5px 7px; text-align: left; }
      th.center, td.center { text-align: center; }
      th.right, td.right { text-align: right; }
      td { padding: 5px 7px; border-bottom: 1px solid #e5e7eb; font-size: 11px; vertical-align: top; }
      .muted { color: #94a3b8; font-size: 10px; }
      .totals { margin-top: 10px; display: flex; justify-content: flex-end; }
      .totals .row { min-width: 240px; }
      .totals .row div { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
      .totals .row .grand { border-top: 2px solid #1e293b; margin-top: 4px; padding-top: 6px; font-size: 15px; font-weight: 800; }
      .cond { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 10px; margin-top: 10px; }
      .cond p { font-size: 11px; margin: 2px 0; }
      .cond .lbl { font-weight: 700; color: #b45309; }
      .obs { margin-top: 8px; font-size: 11px; color: #475569; white-space: pre-wrap; }
      .footer { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
      .sign { margin-top: 24px; text-align: center; }
      .sign .line { border-top: 1px solid #1e293b; width: 280px; margin: 0 auto; padding-top: 4px; font-size: 10px; color: #64748b; }
      @media print { body { margin: 0; } }
    </style></head>
    <body>
      <div class="header">
        <div class="brand">
          <img src="${LOGO_URL}" alt="Modelajes" />
          <div>
            <div class="name">MODELAJES</div>
            <div class="sub">Treliças para telhado · Fabricação própria</div>
          </div>
        </div>
        <div class="doc-title">
          <h1>ORÇAMENTO</h1>
          <div class="num">Nº ${order.order_number}</div>
          <div class="dates">Emissão: ${format(today, 'dd/MM/yyyy')} · Válido até: ${format(validUntil, 'dd/MM/yyyy')}</div>
        </div>
      </div>

      <div class="section">
        <h2>Cliente</h2>
        <div class="grid2">
          <div class="box">
            <p><span class="lbl">Nome</span><br/>${order.client_name || '—'}</p>
            ${order.client_phone ? `<p><span class="lbl">Telefone</span><br/>${order.client_phone}</p>` : ''}
          </div>
          <div class="box">
            ${order.client_email ? `<p><span class="lbl">E-mail</span><br/>${order.client_email}</p>` : ''}
            ${order.delivery_address ? `<p><span class="lbl">Endereço de entrega</span><br/>${order.delivery_address}</p>` : ''}
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Itens</h2>
        <table>
          <thead><tr><th style="width:24px">#</th><th>Descrição</th><th class="center" style="width:60px">Qtd</th><th class="right" style="width:90px">Unitário</th></tr></thead>
          <tbody>${itemsRows || `<tr><td colspan="4" class="muted center">Sem itens</td></tr>`}</tbody>
        </table>
        <div class="totals">
          <div class="row">
            <div><span>Forma de pagamento</span><span>${pag}</span></div>
            <div><span>Condição</span><span>${parcelasTxt}</span></div>
            <div class="grand"><span>Total</span><span>${valorTexto}</span></div>
          </div>
        </div>
      </div>

      <div class="cond">
        <p><span class="lbl">Condições:</span> Orçamento válido por ${validade} dias a partir da emissão. Frete e montagem não inclusos salvo combinação. Confirmação sujeita a disponibilidade de agenda.</p>
      </div>

      ${obs ? `<div class="obs">${obs.replace(/</g, '&lt;')}</div>` : ''}

      <div class="sign">
        <div class="line">Modelajes — ${format(today, 'dd/MM/yyyy')}</div>
      </div>

      <div class="footer">
        <span>Modelajes · Treliças</span>
        <span>Orçamento gerado automaticamente</span>
      </div>
    </body></html>`;
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(buildHtml());
    w.document.close();
    w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  const handleWhatsApp = async () => {
    if (!order.client_phone) { toast.error('Pedido sem telefone do cliente.'); return; }
    setSending(true);
    try {
      // Generate a short quote summary link
      const lines = (order.items || []).map((it, i) =>
        `${i + 1}. ${it.size || ''}${it.truss_type ? ` (${TRUSS_TYPE_LABEL(it.truss_type)})` : ''} — ${it.quantity} un`
      ).join('\n');
      const msg =
        `*Orçamento #${order.order_number} — Modelajes*\n` +
        `Olá ${order.client_name}! Segue o orçamento solicitado:\n\n` +
        `${lines}\n\n` +
        `*Total: ${valorTexto}*\n` +
        `Pagamento: ${order.payment_method || '—'}\n` +
        `Válido até: ${format(validUntil, 'dd/MM/yyyy')}\n\n` +
        `Aguardamos seu retorno. Obrigado!`;
      const phone = order.client_phone.replace(/\D/g, '');
      const fullPhone = phone.length === 11 || phone.length === 10 ? `55${phone}` : phone;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      toast.success('Abrindo WhatsApp...');
    } catch (e) {
      toast.error('Não foi possível abrir o WhatsApp.');
    } finally {
      setSending(false);
    }
  };

  const handleEmail = async () => {
    if (!order.client_email) { toast.error('Pedido sem e-mail do cliente.'); return; }
    setSending(true);
    try {
      // Upload printable quote to get a shareable link to attach reference
      const lines = (order.items || []).map((it, i) =>
        `${i + 1}. ${it.size || ''}${it.truss_type ? ` (${TRUSS_TYPE_LABEL(it.truss_type)})` : ''} — ${it.quantity} un`
      ).join('%0D%0A');
      const subject = `Orçamento #${order.order_number} — Modelajes`;
      const body =
        `Olá ${order.client_name},%0D%0A%0D%0A` +
        `Segue o orçamento solicitado:%0D%0A%0D%0A${lines}%0D%0A%0D%0A` +
        `*Total: ${valorTexto}*%0D%0A` +
        `Pagamento: ${order.payment_method || '—'}%0D%0A` +
        `Válido até: ${format(validUntil, 'dd/MM/yyyy')}%0D%0A%0D%0A` +
        `Atenciosamente,%0D%0AModelajes`;
      window.location.href = `mailto:${order.client_email}?subject=${encodeURIComponent(subject)}&body=${body}`;
      toast.success('Abrindo seu app de e-mail...');
    } catch (e) {
      toast.error('Não foi possível abrir o e-mail.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Validade (dias)</Label>
          <Input type="number" min={1} value={validade} onChange={e => setValidade(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Válido até</Label>
          <Input value={format(validUntil, 'dd/MM/yyyy')} disabled className="bg-muted/50" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Observações do orçamento</Label>
        <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Condições especiais, prazos, observações..." />
      </div>

      {/* Resumo rápido */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cliente</span><span className="font-medium truncate ml-2">{order.client_name}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Itens</span><span>{totalItems} treliça(s)</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pagamento</span><span>{order.payment_method || '—'}</span></div>
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-border"><span>Total</span><span className="text-primary">{valorTexto}</span></div>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={handlePrint} className="w-full bg-primary text-primary-foreground">
          <Printer className="w-4 h-4 mr-2" /> Imprimir / Salvar PDF
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleWhatsApp} disabled={sending} variant="outline" className="flex-1 text-green-700 border-green-300 hover:bg-green-50">
            <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
          </Button>
          <Button onClick={handleEmail} disabled={sending} variant="outline" className="flex-1 text-blue-700 border-blue-300 hover:bg-blue-50">
            <Mail className="w-4 h-4 mr-1" /> E-mail
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        O envio por e-mail/WhatsApp abre o app correspondente com o orçamento preenchido para você confirmar o envio.
      </p>
    </div>
  );
}