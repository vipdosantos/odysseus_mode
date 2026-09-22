// Geração de PDFs (contrato assinado e recibo de entrega) com jsPDF.
import { jsPDF } from "npm:jspdf@4.0.0";

const PRIMARY: [number, number, number] = [245, 158, 11]; // amber-500
const DARK: [number, number, number] = [30, 41, 59]; // slate-800

function fmtBRL(v: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString("pt-BR");
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export function buildContractPdf(order: any, sig: { rg: string; cpf: string; signatureDataUrl: string | null; signedAt: string }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  let y = M;

  // Cabeçalho
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("MODELAGES", M, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Treliças para Telhados", M, 18);
  doc.setTextColor(...DARK);

  y = 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS E VENDA DE TRELIÇAS", M, y);
  y += 7;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const bloco = (label: string, val: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(val || "—", M + 38, y);
    y += 6;
  };

  bloco("Contratada:", "Modelajes - Treliças para Telhados");
  bloco("Pedido Nº:", String(order.order_number || "—"));
  bloco("Contratante:", String(order.client_name || "—"));
  bloco("RG:", sig.rg || "—");
  bloco("CPF:", sig.cpf || "—");
  if (order.client_phone) bloco("Telefone:", String(order.client_phone));
  if (order.client_email) bloco("E-mail:", String(order.client_email));
  if (order.delivery_address) bloco("Endereço de Entrega:", String(order.delivery_address));
  if (order.delivery_date) bloco("Data de Entrega:", fmtDate(order.delivery_date));
  if (order.payment_method) bloco("Forma de Pagamento:", String(order.payment_method));
  if (order.installments) bloco("Parcelas:", String(order.installments));
  y += 2;

  // Itens
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Itens do Pedido", M, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFillColor(245, 158, 11);
  doc.rect(M, y, W - 2 * M, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("Descrição", M + 2, y + 4);
  doc.text("Qtd", W - M - 18, y + 4);
  doc.setTextColor(...DARK);
  y += 6;

  (order.items || []).forEach((it: any) => {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "normal");
    const desc = `${it.truss_type ? it.truss_type + " " : ""}${it.size || ""}`.trim() || "Item";
    doc.text(desc, M + 2, y + 4);
    doc.text(String(it.quantity || 0), W - M - 18, y + 4);
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(M, y, W - M, y);
    y += 1;
  });

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Valor Total: " + fmtBRL(order.total_value || 0), M, y);
  y += 8;

  // Condições Gerais de Fornecimento
  y += 2;
  if (y > 60) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CONDIÇÕES GERAIS DE FORNECIMENTO", M, y);
  y += 6;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 5;

  const termos: { t: string; d: string }[] = [
    { t: "1. REFORÇOS E ESCOPO", d: "Estão inclusos os reforços adicionais positivos expressamente descritos no pedido, conforme dimensionamento estrutural. Materiais, reforços ou alterações não especificados serão cobrados à parte." },
    { t: "2. PROJETO DE MONTAGEM, CONFERÊNCIA E APROVAÇÃO", d: "Antes da fabricação, a Modelajes fornecerá ao Contratante o projeto de montagem/modulação das lajes para conferência e aprovação. O Contratante ou responsável pela obra deverá conferir medidas, vãos, apoios, posicionamento e demais informações referentes à obra. A aprovação do projeto autoriza a fabricação das lajes conforme as informações nele constantes. Uma cópia do projeto aprovado será entregue juntamente com o material para orientação da montagem. Eventuais alterações realizadas na obra após a aprovação deverão ser comunicadas à Modelajes e poderão exigir revisão do projeto, alteração dos materiais, custos e prazo de entrega." },
    { t: "3. ART E VISTORIA", d: "Quando contratada ou necessária dentro do escopo da Modelajes, a ART será emitida pelo responsável técnico. Se necessária vistoria antes da concretagem, deverá ser solicitada previamente. Taxas e boletos da ART serão de responsabilidade do cliente quando assim estiver estabelecido." },
    { t: "4. ALTERAÇÕES", d: "Mudanças de medidas, vãos, apoios, cargas, uso ou demais condições da obra deverão ser comunicadas antes da fabricação/execução. Alterações posteriores poderão gerar revisão técnica, cobrança adicional e novo prazo." },
    { t: "5. ENTREGA, FRETE E MUNCK", d: "Prazo e frete serão os definidos no fechamento do pedido. Serviço de munck somente estará incluso quando indicado. O cliente deverá garantir acesso e condições seguras para descarga; impossibilidade imputável à obra poderá gerar cobrança de retorno, novo frete, munck ou estadia." },
    { t: "6. PAGAMENTO", d: "O pagamento seguirá a forma e parcelas aprovadas. O inadimplemento poderá acarretar encargos legais/contratuais e suspensão da produção ou de entregas ainda não realizadas." },
    { t: "7. RECEBIMENTO", d: "Quantidades, especificações e danos aparentes deverão ser conferidos no ato da descarga e eventual divergência registrada no comprovante. A conferência não afasta direitos relativos a vícios não aparentes previstos em lei." },
    { t: "8. LIMITES DO FORNECIMENTO E RESPONSABILIDADE", d: "A atuação da Modelajes limita-se à fabricação e entrega das lajes e demais materiais expressamente descritos no pedido, conforme as especificações contratadas. A Modelajes não executa nem assume responsabilidade pela montagem, escoramento, nivelamento, instalação de armaduras em obra, concretagem, adensamento, cura, retirada de escoramento, armazenamento, movimentação ou demais serviços de execução da estrutura, os quais são de responsabilidade do Contratante e dos profissionais responsáveis pela obra. Eventuais orientações, projeto de montagem ou informações técnicas fornecidas pela Modelajes não caracterizam execução, gerenciamento ou fiscalização da obra. A responsabilidade da Modelajes permanece restrita à conformidade dos produtos por ela fabricados e fornecidos dentro do escopo contratado e das obrigações legalmente aplicáveis." },
    { t: "9. VALIDADE E ACEITE", d: "O orçamento é válido pelo prazo nele indicado. A assinatura, pedido de compra ou manifestação inequívoca de aceite confirma ciência das medidas, quantidades, especificações, preços e condições e autoriza a fabricação conforme o pedido/projeto aprovado." },
  ];
  doc.setFontSize(8);
  termos.forEach((termo) => {
    const titleLines = doc.splitTextToSize(termo.t, W - 2 * M);
    const descLines = doc.splitTextToSize(termo.d, W - 2 * M);
    const totalH = titleLines.length * 3.5 + descLines.length * 3.2 + 2;
    if (y + totalH > 285) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.text(titleLines, M, y);
    y += titleLines.length * 3.5;
    doc.setFont("helvetica", "normal");
    doc.text(descLines, M, y);
    y += descLines.length * 3.2 + 2;
  });

  // Aprovação do Contratante
  y += 3;
  if (y > 250) { doc.addPage(); y = M; }
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.3);
  doc.rect(M, y - 4, W - 2 * M, 16, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("APROVAÇÃO DO CONTRATANTE / RESPONSÁVEL PELA OBRA", M + 2, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  const aprovLines = doc.splitTextToSize("Declaro ter conferido e aprovado as medidas, vãos, quantidades, especificações e condições deste pedido e do respectivo projeto de montagem, autorizando a fabricação dos materiais e declarando ciência das condições acima.", W - 2 * M - 4);
  doc.text(aprovLines, M + 2, y);
  y += aprovLines.length * 3.2 + 4;

  // Assinatura
  y += 4;
  if (y > 240) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Assinatura do Contratante", M, y);
  y += 4;
  if (sig.signatureDataUrl) {
    try {
      doc.addImage(sig.signatureDataUrl, "PNG", M, y, 60, 25);
    } catch (_) {}
    y += 27;
  } else {
    y += 5;
  }
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + 90, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${order.client_name || "Cliente"} — RG: ${sig.rg || "—"} — CPF: ${sig.cpf || "—"}`, M, y + 4);
  doc.text(`Assinado em: ${fmtDate(sig.signedAt)}`, M, y + 9);

  return doc.output("arraybuffer");
}

export function buildDeliveryReceiptPdf(order: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  let y = M;

  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("MODELAGES", M, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Recibo de Entrega", M, 18);
  doc.setTextColor(...DARK);

  y = 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Recibo de Entrega — Pedido #${order.order_number}`, M, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const lin = (l: string, v: string) => { doc.text(`${l}`, M, y); doc.text(v || "—", M + 45, y); y += 6; };
  lin("Cliente:", String(order.client_name || "—"));
  if (order.client_phone) lin("Telefone:", String(order.client_phone));
  if (order.delivery_address) {
    const lines = doc.splitTextToSize(order.delivery_address, W - M - 45);
    doc.text("Endereço:", M, y);
    doc.text(lines, M + 45, y);
    y += lines.length * 5 + 1;
  }
  lin("Data:", new Date().toLocaleString("pt-BR"));
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.text("Itens Entregues", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setFillColor(245, 158, 11);
  doc.rect(M, y, W - 2 * M, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("Descrição", M + 2, y + 4);
  doc.text("Qtd", W - M - 18, y + 4);
  doc.setTextColor(...DARK);
  y += 6;
  (order.items || []).forEach((it: any) => {
    const desc = `${it.truss_type ? it.truss_type + " " : ""}${it.size || ""}`.trim() || "Item";
    doc.text(desc, M + 2, y + 4);
    doc.text(String(it.quantity || 0), W - M - 18, y + 4);
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(M, y, W - M, y);
    y += 1;
  });

  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Declaro ter recebido os itens acima em perfeito estado.", M, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Assinatura do Recebedor", M, y);
  y += 4;
  if (order.delivery_signature) {
    try { doc.addImage(order.delivery_signature, "PNG", M, y, 60, 25); } catch (_) {}
    y += 27;
  } else { y += 5; }
  doc.setDrawColor(...DARK);
  doc.line(M, y, M + 90, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Nome: ${order.delivery_signed_by || "—"}`, M, y + 4);
  doc.text(`Documento: ${order.delivery_signer_doc || "—"}`, M, y + 9);
  if (order.delivery_signed_at) doc.text(`Assinado em: ${fmtDate(order.delivery_signed_at)}`, M, y + 14);

  return doc.output("arraybuffer");
}