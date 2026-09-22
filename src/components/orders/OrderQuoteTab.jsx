import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { FileDown, MessageCircle, Mail, Save, FileSignature, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { LOGO_URL } from '@/components/layout/ModelajesLogo';
import { TRUSS_TYPE_LABEL, FERRO_LABEL } from '@/lib/trussTypes';
import PaymentsEditor from './PaymentsEditor';
import ContractTab from './ContractTab';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAG_OPTIONS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
];

const TIPO_LAJE_OPTIONS = ['Treliçada', 'Painel', 'Cortina de contenção', 'Treliçado Maciço', 'Painel Maciço'];

export default function OrderQuoteTab({ order, onConverted }) {
  const [validade, setValidade] = useState(Number(order?.validade_dias) || 15);
  const [obs, setObs] = useState(order?.notes || '');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [converting, setConverting] = useState(false);
  const [tipo, setTipo] = useState(order?.tipo || 'orcamento');
  const [tipoLaje, setTipoLaje] = useState(order?.quote_tipo_laje || 'Treliça');

  // Editable unit prices per item (from item.unit_price saved in the order)
  const initPrices = useMemo(() => {
    return (order?.items || []).map(it => Number(it.unit_price) || 0);
  }, [order]);
  const [unitPrices, setUnitPrices] = useState(initPrices);

  const [pagamento, setPagamento] = useState(order?.payment_method || 'pix');
  const [parcelas, setParcelas] = useState(Number(order?.installments) || 1);
  const [valorFiscal, setValorFiscal] = useState(0);
  const [payments, setPayments] = useState(order?.payments || []);

  const today = new Date();
  const validUntil = addDays(today, Number(validade) || 15);

  const totalItems = useMemo(
    () => (order?.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
    [order]
  );

  const subtotal = useMemo(
    () => (order?.items || []).reduce((s, it, i) => s + (Number(it.quantity) || 0) * (Number(unitPrices[i]) || 0), 0),
    [order, unitPrices]
  );
  const total = subtotal + (Number(valorFiscal) || 0);
  const valorTexto = total > 0 ? `R$ ${fmtBRL(total)}` : 'A combinar';

  const handlePriceChange = (i, v) => {
    const next = [...unitPrices];
    next[i] = Number(v) || 0;
    setUnitPrices(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = (order.items || []).map((it, i) => ({
        ...it,
        unit_price: Number(unitPrices[i]) || 0,
      }));
      await base44.entities.Order.update(order.id, {
        items,
        total_value: total,
        payment_method: pagamento,
        installments: parcelas,
        payments,
        tipo,
        quote_tipo_laje: tipoLaje,
        validade_dias: Number(validade) || 15,
        notes: obs,
      });
      toast.success('Valores salvos!');
    } catch (e) {
      toast.error('Erro ao salvar valores.');
    } finally {
      setSaving(false);
    }
  };

  const handleVirarPedido = async () => {
    setConverting(true);
    try {
      const items = (order.items || []).map((it, i) => ({
        ...it,
        unit_price: Number(unitPrices[i]) || 0,
      }));
      await base44.entities.Order.update(order.id, {
        items,
        total_value: total,
        payment_method: pagamento,
        installments: parcelas,
        payments,
        tipo: 'pedido',
        quote_tipo_laje: tipoLaje,
        validade_dias: Number(validade) || 15,
        notes: obs,
      });
      setTipo('pedido');
      toast.success('Orçamento convertido em pedido!');
      if (onConverted) onConverted();
    } catch (e) {
      toast.error('Erro ao converter em pedido.');
    } finally {
      setConverting(false);
    }
  };

  const buildHtml = () => {
    const itemsRows = (order.items || []).map((it, i) => {
      const extras = [];
      if (it.truss_type) extras.push(TRUSS_TYPE_LABEL(it.truss_type));
      (it.adicionais || []).forEach(a => { if (a.quantity > 0) extras.push(`${FERRO_LABEL(a.diametro)} ×${a.quantity}`); });
      const unit = Number(unitPrices[i]) || 0;
      const rowTotal = unit * (Number(it.quantity) || 0);
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${it.size || '—'}</strong>${extras.length ? `<br/><span class="muted">${extras.join(' · ')}</span>` : ''}</td>
          <td class="center">${it.quantity || 0}</td>
          <td class="right">${unit > 0 ? fmtBRL(unit) : '—'}</td>
          <td class="right">${rowTotal > 0 ? fmtBRL(rowTotal) : '—'}</td>
        </tr>`;
    }).join('');

    const parcelasTxt = Number(parcelas) > 1
      ? `${parcelas}x de R$ ${fmtBRL(total / parcelas)}`
      : 'À vista';
    const pag = PAG_OPTIONS.find(p => p.value === pagamento)?.label || pagamento || '—';
    const paymentsRows = (payments.length > 0 ? payments : []).map((p) => {
      const lbl = PAG_OPTIONS.find(o => o.value === p.method)?.label || p.method;
      const parc = Number(p.installments) > 1 ? `${p.installments}x` : 'À vista';
      return `<div><span>${lbl} (${parc})</span><span>R$ ${fmtBRL(p.value)}</span></div>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orçamento #${order.order_number}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; font-size: 15px; padding: 22mm 20mm; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f59e0b; padding-bottom: 14px; margin-bottom: 18px; }
      .brand { display: flex; align-items: center; gap: 12px; }
      .brand img { height: 52px; }
      .brand .name { font-size: 20px; font-weight: 800; letter-spacing: 1px; color: #1e293b; }
      .brand .sub { font-size: 12px; color: #64748b; margin-top: 3px; }
      .doc-title { text-align: right; }
      .doc-title h1 { font-size: 26px; color: #f59e0b; }
      .doc-title .num { font-size: 16px; font-weight: 700; margin-top: 3px; }
      .doc-title .dates { font-size: 12px; color: #64748b; margin-top: 5px; }
      .section { margin-bottom: 16px; }
      .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #f59e0b; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .box { background: #f8fafc; border-radius: 6px; padding: 10px 12px; }
      .box p { margin: 2px 0; font-size: 14px; }
      .box .lbl { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #1e293b; color: #fff; font-size: 13px; padding: 8px 10px; text-align: left; }
      th.center, td.center { text-align: center; }
      th.right, td.right { text-align: right; }
      td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 14px; vertical-align: top; }
      .muted { color: #94a3b8; font-size: 12px; }
      .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
      .totals .row { min-width: 300px; }
      .totals .row div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
      .totals .row .grand { border-top: 2px solid #1e293b; margin-top: 6px; padding-top: 8px; font-size: 19px; font-weight: 800; }
      .cond { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 12px; margin-top: 14px; }
      .cond p { font-size: 14px; margin: 3px 0; }
      .cond .lbl { font-weight: 700; color: #b45309; }
      .obs { margin-top: 10px; font-size: 14px; color: #475569; white-space: pre-wrap; }
      .termos { margin-top: 16px; border-top: 2px solid #f59e0b; padding-top: 12px; padding: 22mm 20mm; }
      .termos-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
      .termos-header img { height: 40px; }
      .termos-header .th-title { font-size: 18px; font-weight: 800; color: #1e293b; }
      .termos-header .th-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
      .termos h3 { font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 8px; }
      .termos p { font-size: 11px; line-height: 1.5; color: #475569; margin-bottom: 6px; }
      .termos p strong { color: #1e293b; }
      .aprov-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 12px; margin-top: 10px; }
      .aprov-box .aprov-title { font-size: 12px; font-weight: 800; color: #b45309; margin-bottom: 4px; }
      .aprov-box p { font-size: 11px; color: #92400e; margin: 0; }
      .footer { margin-top: 22px; border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
      .sign { margin-top: 30px; text-align: center; }
      .sign .line { border-top: 1px solid #1e293b; width: 320px; margin: 0 auto; padding-top: 5px; font-size: 12px; color: #64748b; }
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
            <p><span class="lbl">Tipo de Laje</span><br/>${tipoLaje}</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Itens</h2>
        <table>
          <thead><tr><th style="width:24px">#</th><th>Descrição</th><th class="center" style="width:50px">Qtd</th><th class="right" style="width:80px">Unitário</th><th class="right" style="width:90px">Total</th></tr></thead>
          <tbody>${itemsRows || `<tr><td colspan="5" class="muted center">Sem itens</td></tr>`}</tbody>
        </table>
        <div class="totals">
          <div class="row">
            <div><span>Subtotal</span><span>R$ ${fmtBRL(subtotal)}</span></div>
            ${Number(valorFiscal) > 0 ? `<div><span>Valor fiscal</span><span>R$ ${fmtBRL(valorFiscal)}</span></div>` : ''}
            ${paymentsRows}
            <div><span>Forma principal</span><span>${pag} (${parcelasTxt})</span></div>
            <div class="grand"><span>Total</span><span>${valorTexto}</span></div>
          </div>
        </div>
      </div>

      <div class="cond">
        <p><span class="lbl">Condições:</span> Orçamento válido por ${validade} dias a partir da emissão. Frete e montagem não inclusos salvo combinação. Confirmação sujeita a disponibilidade de agenda.</p>
      </div>

      ${obs ? `<div class="obs">${obs.replace(/</g, '&lt;')}</div>` : ''}

      <div class="termos" id="termos-block">
        <div class="termos-header">
          <img src="${LOGO_URL}" alt="Modelajes" />
          <div>
            <div class="th-title">MODELAJES</div>
            <div class="th-sub">Orçamento Nº ${order.order_number} — Condições Gerais de Fornecimento</div>
          </div>
        </div>
        <h3>CONDIÇÕES GERAIS DE FORNECIMENTO</h3>
        <p><strong>1. REFORÇOS E ESCOPO:</strong> Estão inclusos os reforços adicionais positivos expressamente descritos no pedido, conforme dimensionamento estrutural. Materiais, reforços ou alterações não especificados serão cobrados à parte.</p>
        <p><strong>2. PROJETO DE MONTAGEM, CONFERÊNCIA E APROVAÇÃO:</strong> Antes da fabricação, a Modelajes fornecerá ao Contratante o projeto de montagem/modulação das lajes para conferência e aprovação. O Contratante ou responsável pela obra deverá conferir medidas, vãos, apoios, posicionamento e demais informações referentes à obra. A aprovação do projeto autoriza a fabricação das lajes conforme as informações nele constantes. Uma cópia do projeto aprovado será entregue juntamente com o material para orientação da montagem. Eventuais alterações realizadas na obra após a aprovação deverão ser comunicadas à Modelajes e poderão exigir revisão do projeto, alteração dos materiais, custos e prazo de entrega.</p>
        <p><strong>3. ART E VISTORIA:</strong> Quando contratada ou necessária dentro do escopo da Modelajes, a ART será emitida pelo responsável técnico. Se necessária vistoria antes da concretagem, deverá ser solicitada previamente. Taxas e boletos da ART serão de responsabilidade do cliente quando assim estiver estabelecido.</p>
        <p><strong>4. ALTERAÇÕES:</strong> Mudanças de medidas, vãos, apoios, cargas, uso ou demais condições da obra deverão ser comunicadas antes da fabricação/execução. Alterações posteriores poderão gerar revisão técnica, cobrança adicional e novo prazo.</p>
        <p><strong>5. ENTREGA, FRETE E MUNCK:</strong> Prazo e frete serão os definidos no fechamento do pedido. Serviço de munck somente estará incluso quando indicado. O cliente deverá garantir acesso e condições seguras para descarga; impossibilidade imputável à obra poderá gerar cobrança de retorno, novo frete, munck ou estadia.</p>
        <p><strong>6. PAGAMENTO:</strong> O pagamento seguirá a forma e parcelas aprovadas. O inadimplemento poderá acarretar encargos legais/contratuais e suspensão da produção ou de entregas ainda não realizadas.</p>
        <p><strong>7. RECEBIMENTO:</strong> Quantidades, especificações e danos aparentes deverão ser conferidos no ato da descarga e eventual divergência registrada no comprovante. A conferência não afasta direitos relativos a vícios não aparentes previstos em lei.</p>
        <p><strong>8. LIMITES DO FORNECIMENTO E RESPONSABILIDADE:</strong> A atuação da Modelajes limita-se à fabricação e entrega das lajes e demais materiais expressamente descritos no pedido, conforme as especificações contratadas. A Modelajes não executa nem assume responsabilidade pela montagem, escoramento, nivelamento, instalação de armaduras em obra, concretagem, adensamento, cura, retirada de escoramento, armazenamento, movimentação ou demais serviços de execução da estrutura, os quais são de responsabilidade do Contratante e dos profissionais responsáveis pela obra. Eventuais orientações, projeto de montagem ou informações técnicas fornecidas pela Modelajes não caracterizam execução, gerenciamento ou fiscalização da obra. A responsabilidade da Modelajes permanece restrita à conformidade dos produtos por ela fabricados e fornecidos dentro do escopo contratado e das obrigações legalmente aplicáveis.</p>
        <p><strong>9. VALIDADE E ACEITE:</strong> O orçamento é válido pelo prazo nele indicado. A assinatura, pedido de compra ou manifestação inequívoca de aceite confirma ciência das medidas, quantidades, especificações, preços e condições e autoriza a fabricação conforme o pedido/projeto aprovado.</p>
        <div class="aprov-box">
          <p class="aprov-title">APROVAÇÃO DO CONTRATANTE / RESPONSÁVEL PELA OBRA</p>
          <p>Declaro ter conferido e aprovado as medidas, vãos, quantidades, especificações e condições deste pedido e do respectivo projeto de montagem, autorizando a fabricação dos materiais e declarando ciência das condições acima.</p>
        </div>
      </div>

      <div class="sign">
        <div class="line">Modelajes — ${format(today, 'dd/MM/yyyy')}</div>
      </div>

      <div class="footer">
        <span>Modelajes · Treliças</span>
        <span>Orçamento gerado automaticamente</span>
      </div>
    </body></html>`;
  };

  const handleSavePdf = async () => {
    setGeneratingPdf(true);
    try {
      const fullHtml = buildHtml();
      const bodyMatch = fullHtml.match(/<body>([\s\S]*)<\/body>/);
      const headMatch = fullHtml.match(/<style>([\s\S]*)<\/style>/);

      const styleHtml = headMatch ? headMatch[1] : '';
      const bodyHtml = bodyMatch ? bodyMatch[1] : fullHtml;

      // Split body into main content and termos block (rendered on separate page to avoid cutting)
      const termosMatch = bodyHtml.match(/<div class="termos" id="termos-block">[\s\S]*?<\/div>\s*<\/div>\s*<div class="sign">/);
      const termosHtml = termosMatch ? termosMatch[0].replace(/<div class="sign">$/, '') : '';
      const mainHtml = termosMatch ? bodyHtml.replace(termosMatch[0], '<div class="sign">') : bodyHtml;

      const renderCanvas = async (html) => {
        const c = document.createElement('div');
        c.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#ffffff;';
        c.innerHTML = `<style>${styleHtml}</style>${html}`;
        document.body.appendChild(c);
        const imgs = c.querySelectorAll('img');
        await Promise.all(Array.from(imgs).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
        ));
        const cv = await html2canvas(c, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        document.body.removeChild(c);
        return cv;
      };

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;

      const addCanvasPages = (canvas, isFirst) => {
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        const imgData = canvas.toDataURL('image/png');

        if (!isFirst) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
      };

      const mainCanvas = await renderCanvas(mainHtml);
      addCanvasPages(mainCanvas, true);

      if (termosHtml) {
        const termosCanvas = await renderCanvas(termosHtml);
        addCanvasPages(termosCanvas, false);
      }

      pdf.save(`Orcamento_${order.order_number}.pdf`);
      toast.success('PDF salvo!');
    } catch (e) {
      toast.error('Erro ao gerar PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!order.client_phone) { toast.error('Pedido sem telefone do cliente.'); return; }
    setSending(true);
    try {
      const lines = (order.items || []).map((it, i) =>
        `${i + 1}. ${it.size || ''}${it.truss_type ? ` (${TRUSS_TYPE_LABEL(it.truss_type)})` : ''} — ${it.quantity} un`
      ).join('\n');
      const pag = PAG_OPTIONS.find(p => p.value === pagamento)?.label || pagamento;
      const msg =
        `*Orçamento #${order.order_number} — Modelajes*\n` +
        `Olá ${order.client_name}! Segue o orçamento solicitado:\n\n` +
        `Tipo de laje: ${tipoLaje}\n` +
        `${lines}\n\n` +
        `*Total: ${valorTexto}*\n` +
        `Pagamento: ${pag}\n` +
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
      const lines = (order.items || []).map((it, i) =>
        `${i + 1}. ${it.size || ''}${it.truss_type ? ` (${TRUSS_TYPE_LABEL(it.truss_type)})` : ''} — ${it.quantity} un`
      ).join('%0D%0A');
      const pag = PAG_OPTIONS.find(p => p.value === pagamento)?.label || pagamento;
      const subject = `Orçamento #${order.order_number} — Modelajes`;
      const body =
        `Olá ${order.client_name},%0D%0A%0D%0A` +
        `Tipo de laje: ${tipoLaje}%0D%0A` +
        `Segue o orçamento solicitado:%0D%0A%0D%0A${lines}%0D%0A%0D%0A` +
        `*Total: ${valorTexto}*%0D%0A` +
        `Pagamento: ${pag}%0D%0A` +
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

  const isPedido = tipo === 'pedido';

  return (
    <div className="space-y-4 mt-4">
      {/* Status banner */}
      {isPedido ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-semibold text-green-800">Este orçamento já foi convertido em pedido.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <FileSignature className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">Orçamento em negociação. Salve em PDF, envie ao cliente e converta em pedido quando aceitar.</p>
        </div>
      )}

      {/* Itens com preços editáveis */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Itens e valores</Label>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {(order.items || []).map((it, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.size || '—'} {it.truss_type ? `· ${TRUSS_TYPE_LABEL(it.truss_type)}` : ''}</div>
                <div className="text-[11px] text-muted-foreground">{it.quantity} un</div>
              </div>
              <div className="w-28 shrink-0">
                <Label className="text-[10px] text-muted-foreground">Unitário (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitPrices[i]}
                  onChange={e => handlePriceChange(i, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          ))}
          {(!order.items || order.items.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-3">Sem itens neste pedido.</p>
          )}
        </div>
      </div>

      {/* Tipo de laje + valor fiscal */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tipo de Laje</Label>
          <Select value={tipoLaje} onValueChange={setTipoLaje}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_LAJE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Valor Fiscal (R$)</Label>
          <Input type="number" min={0} step="0.01" value={valorFiscal} onChange={e => setValorFiscal(e.target.value)} />
        </div>
      </div>

      {/* Múltiplas formas de pagamento */}
      <PaymentsEditor
        value={payments}
        onChange={setPayments}
        totalValue={total}
        compact
      />

      {/* Forma principal (atalho) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Forma Principal</Label>
          <Select value={pagamento} onValueChange={setPagamento}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAG_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Parcelas (principal)</Label>
          <Input type="number" min={1} value={parcelas} onChange={e => setParcelas(e.target.value)} />
        </div>
      </div>

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

      {/* Resumo com totais */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cliente</span><span className="font-medium truncate ml-2">{order.client_name}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Itens</span><span>{totalItems} treliça(s)</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tipo de Laje</span><span>{tipoLaje}</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>R$ {fmtBRL(subtotal)}</span></div>
        {Number(valorFiscal) > 0 && (
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valor Fiscal</span><span>R$ {fmtBRL(valorFiscal)}</span></div>
        )}
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-border"><span>Total</span><span className="text-primary">{valorTexto}</span></div>
      </div>

      {/* Ações principais */}
      <div className="flex flex-col gap-2">
        <Button onClick={handleSave} disabled={saving} variant="outline" className="w-full">
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar valores'}
        </Button>
        <Button onClick={handleSavePdf} disabled={generatingPdf} className="w-full bg-primary text-primary-foreground">
          <FileDown className="w-4 h-4 mr-2" /> {generatingPdf ? 'Gerando PDF...' : 'Salvar em PDF'}
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

      {/* Virar Pedido */}
      {!isPedido && (
        <Button onClick={handleVirarPedido} disabled={converting} className="w-full bg-green-600 hover:bg-green-700 text-white h-11">
          <CheckCircle2 className="w-4 h-4 mr-2" /> {converting ? 'Convertendo...' : 'Virar Pedido'}
        </Button>
      )}

      {/* Contrato */}
      <div className="pt-4 border-t border-border">
        <ContractTab order={{ ...order, tipo }} canEdit={true} />
      </div>
    </div>
  );
}