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

  // Cláusulas
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const clausulas = [
    "1. A Contratada fabricará e entregará as treliças descadas acima, conforme especificações do pedido.",
    "2. O prazo de entrega está sujeito a confirmação de produção e condições climáticas.",
    "3. O pagamento será realizado conforme forma e parcelas acordadas, sob pena de juros e multa em caso de atraso.",
    "4. A Contratante declara estar ciente das dimensões e características dos produtos contratados.",
    "5. Em caso de divergência, prevalece o pedido arquivado no sistema da Contratada.",
  ];
  clausulas.forEach((c) => {
    const lines = doc.splitTextToSize(c, W - 2 * M);
    if (y + lines.length * 4 > 250) { doc.addPage(); y = M; }
    doc.text(lines, M, y);
    y += lines.length * 4 + 1;
  });

  // Assinatura
  y += 6;
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

  doc.save(`Contrato_${order.order_number || "pedido"}.pdf`);
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

  doc.save(`Recibo_${order.order_number || "pedido"}.pdf`);
  return doc.output("arraybuffer");
}