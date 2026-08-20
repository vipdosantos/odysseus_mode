// Exportação de projetos: PDF técnico (jsPDF) e DXF (formato texto).
import { jsPDF } from 'jspdf';
import { computeVigotas, computeEscoras } from '@/lib/projetoCalculos';
import { computeEstrutural } from '@/lib/projetoEstrutural';

// Converte coordenadas do canvas (px) para metros
function pxToM(px, scalePxPerM) { return px / (scalePxPerM || 100); }

// Calcula o bounding box de todos os elementos do projeto (em px)
function computeBounds(slabs, annotations, cotas) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const consider = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  (slabs || []).forEach(s => (s.vertices || []).forEach(v => consider(v.x, v.y)));
  (annotations || []).forEach(a => {
    if (a.x1 != null) consider(a.x1, a.y1);
    if (a.x2 != null) consider(a.x2, a.y2);
    if (a.x != null) consider(a.x, a.y);
  });
  (cotas || []).forEach(c => { consider(c.x1, c.y1); consider(c.x2, c.y2); });
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

// Gera um PDF técnico do projeto com desenho escalado e memorial de cálculo
export function exportarPDF(projeto, { slabs, annotations, cotas, textos, scalePxPerM, escoraCfg, canvasImage }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297, pageH = 210;
  const margin = 10;
  const est = computeEstrutural(slabs, annotations, scalePxPerM);

  // Cabeçalho
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(projeto.name || 'Projeto de Laje', margin, margin + 5);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${projeto.client_name || '-'}`, margin, margin + 11);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageW - margin - 40, margin + 5);

  doc.setLineWidth(0.3);
  doc.line(margin, margin + 14, pageW - margin, margin + 14);

  // Imagem do canvas (se fornecida)
  let drawY = margin + 18;
  if (canvasImage) {
    const imgW = pageW - margin * 2;
    const imgH = 100;
    try {
      doc.addImage(canvasImage, 'PNG', margin, drawY, imgW, imgH);
      drawY += imgH + 4;
    } catch (e) { /* ignora se imagem inválida */ }
  }

  // Memorial de cálculo
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Memorial de Cálculo', margin, drawY);
  drawY += 5;

  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  const totalArea = slabs.filter(s => !s.negativo).reduce((a, s) => a + (s.area_m2 || 0), 0);
  const linhas = [
    `Área total: ${totalArea.toFixed(2)} m²`,
    `Carga média: ${est.cargaMedia_kN_m2.toFixed(2)} kN/m²`,
    `Peso total: ${est.pesoTotal_kN.toFixed(2)} kN`,
    `Aço treliça: ${est.acoTrelica_kg.toFixed(1)} kg`,
    `Aço negativos: ${est.acoNegativos_kg.toFixed(1)} kg`,
    `Aço total: ${est.acoTotal_kg.toFixed(1)} kg`,
    `Concreto (capa): ${est.concreto_m3.toFixed(2)} m³`,
  ];
  linhas.forEach(l => { doc.text(l, margin, drawY); drawY += 4; });

  // Detalhe por laje
  drawY += 2;
  doc.setFont('helvetica', 'bold'); doc.text('Detalhe por laje:', margin, drawY); drawY += 4;
  doc.setFont('helvetica', 'normal');
  slabs.filter(s => !s.negativo).forEach(s => {
    const vig = computeVigotas(s, scalePxPerM);
    const esc = computeEscoras(s, scalePxPerM, escoraCfg || {});
    const linha = `${s.label}: ${s.area_m2.toFixed(2)} m² | ${s.truss_type || 'H8'} | ${vig.vt} vigotas (${vig.totalLinearM.toFixed(1)}m) | ${esc.pontaletes} pontaletes`;
    if (drawY < pageH - margin) { doc.text(linha, margin, drawY); drawY += 4; }
  });

  doc.save(`${(projeto.name || 'projeto').replace(/\s+/g, '_')}.pdf`);
}

// Gera um arquivo DXF (R12) com as lajes, anotações e cotas do projeto
export function exportarDXF(projeto, { slabs, annotations, cotas, scalePxPerM }) {
  const b = computeBounds(slabs, annotations, cotas);
  const scale = scalePxPerM || 100;
  // Inverte Y (DXF tem Y para cima, canvas tem Y para baixo)
  const flipY = (y) => b.maxY + b.minY - y;
  const toM = (px) => px / scale;

  const ents = [];

  // Lajes como POLYLINE
  (slabs || []).forEach(s => {
    const v = s.vertices || [];
    if (v.length < 2) return;
    ents.push('0');
    ents.push('POLYLINE');
    ents.push('8');
    ents.push(s.negativo ? 'Negativos' : 'Lajes');
    ents.push('66');
    ents.push('1');
    ents.push('70');
    ents.push('1'); // closed
    v.forEach(pt => {
      ents.push('0'); ents.push('VERTEX');
      ents.push('8'); ents.push(s.negativo ? 'Negativos' : 'Lajes');
      ents.push('10'); ents.push(toM(pt.x).toFixed(3));
      ents.push('20'); ents.push(toM(flipY(pt.y)).toFixed(3));
      ents.push('30'); ents.push('0.0');
    });
    ents.push('0'); ents.push('SEQEND');
  });

  // Anotações de linha como LINE
  (annotations || []).forEach(a => {
    if (a.type === 'ponto_luz' || a.type === 'frigideira') return;
    if (a.x1 == null) return;
    const layer = a.type === 'vigota' ? 'Vigotas' : a.type === 'nervura' ? 'Nervuras' : a.type === 'negativo' ? 'Negativos' : 'Anotacoes';
    ents.push('0'); ents.push('LINE');
    ents.push('8'); ents.push(layer);
    ents.push('10'); ents.push(toM(a.x1).toFixed(3));
    ents.push('20'); ents.push(toM(flipY(a.y1)).toFixed(3));
    ents.push('30'); ents.push('0.0');
    ents.push('11'); ents.push(toM(a.x2).toFixed(3));
    ents.push('21'); ents.push(toM(flipY(a.y2)).toFixed(3));
    ents.push('31'); ents.push('0.0');
  });

  // Cotas como LINE + TEXT
  (cotas || []).forEach(c => {
    ents.push('0'); ents.push('LINE');
    ents.push('8'); ents.push('Cotas');
    ents.push('10'); ents.push(toM(c.x1).toFixed(3));
    ents.push('20'); ents.push(toM(flipY(c.y1)).toFixed(3));
    ents.push('30'); ents.push('0.0');
    ents.push('11'); ents.push(toM(c.x2).toFixed(3));
    ents.push('21'); ents.push(toM(flipY(c.y2)).toFixed(3));
    ents.push('31'); ents.push('0.0');
    const mx = toM((c.x1 + c.x2) / 2), my = toM(flipY((c.y1 + c.y2) / 2));
    ents.push('0'); ents.push('TEXT');
    ents.push('8'); ents.push('Cotas');
    ents.push('10'); ents.push(mx.toFixed(3));
    ents.push('20'); ents.push(my.toFixed(3));
    ents.push('30'); ents.push('0.0');
    ents.push('40'); ents.push('0.15');
    ents.push('1'); ents.push(`${(c.meters || 0).toFixed(2)}m`);
  });

  const dxf = [
    '0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...ents,
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');

  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(projeto.name || 'projeto').replace(/\s+/g, '_')}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}

// Captura o canvas como imagem PNG (data URL) para incluir no PDF
export function capturarCanvas(canvasEl) {
  if (!canvasEl) return null;
  return canvasEl.toDataURL('image/png');
}