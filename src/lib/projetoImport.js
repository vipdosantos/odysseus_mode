import * as pdfjsLib from 'pdfjs-dist';

// Configura o worker do pdf.js (Vite resolve a URL)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

const MAX_DIM = 2200; // largura/alura máxima da imagem gerada

// Renderiza um arquivo PDF (primeira página) para PNG data URL
async function pdfToPng(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(MAX_DIM / base.width, MAX_DIM / base.height, 3);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

// Renderiza entidades de um DXF para PNG data URL
async function dxfToPng(file) {
  const DxfParser = (await import('dxf-parser')).default;
  const text = await file.text();
  const dxf = new DxfParser().parseSync(text);
  const ents = (dxf && dxf.entities) || [];

  // Coleta todos os pontos para calcular bounds
  const pts = [];
  const segs = []; // segmentos de linha para desenhar
  ents.forEach(e => {
    const pushSeg = (a, b) => { pts.push(a, b); segs.push([a, b]); };
    if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
      pushSeg({ x: e.vertices[0].x, y: e.vertices[0].y }, { x: e.vertices[1].x, y: e.vertices[1].y });
    } else if (e.type === 'LWPOLYLINE' && e.vertices) {
      for (let i = 0; i < e.vertices.length - 1; i++) {
        pushSeg({ x: e.vertices[i].x, y: e.vertices[i].y }, { x: e.vertices[i + 1].x, y: e.vertices[i + 1].y });
      }
      if (e.shape && e.vertices.length > 2) {
        pushSeg({ x: e.vertices[e.vertices.length - 1].x, y: e.vertices[e.vertices.length - 1].y }, { x: e.vertices[0].x, y: e.vertices[0].y });
      }
    } else if (e.type === 'POLYLINE' && e.vertices) {
      for (let i = 0; i < e.vertices.length - 1; i++) {
        pushSeg({ x: e.vertices[i].x, y: e.vertices[i].y }, { x: e.vertices[i + 1].x, y: e.vertices[i + 1].y });
      }
    } else if (e.type === 'CIRCLE' && e.center && e.radius) {
      const c = e.center, r = e.radius, n = 48;
      pts.push({ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r });
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        segs.push([{ x: c.x + Math.cos(a0) * r, y: c.y + Math.sin(a0) * r }, { x: c.x + Math.cos(a1) * r, y: c.y + Math.sin(a1) * r }]);
      }
    } else if (e.type === 'ARC' && e.center && e.radius && e.startAngle != null && e.endAngle != null) {
      const c = e.center, r = e.radius, n = 36;
      const a0 = e.startAngle, a1 = e.endAngle;
      for (let i = 0; i < n; i++) {
        const t0 = a0 + (a1 - a0) * (i / n), t1 = a0 + (a1 - a0) * ((i + 1) / n);
        segs.push([{ x: c.x + Math.cos(t0) * r, y: c.y + Math.sin(t0) * r }, { x: c.x + Math.cos(t1) * r, y: c.y + Math.sin(t1) * r }]);
      }
    }
  });

  if (pts.length === 0) {
    throw new Error('DXF sem geometria reconhecível (apenas linhas/polinhas/círculos são suportados).');
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  });
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const pad = 40;
  const scale = Math.min((MAX_DIM - pad * 2) / w, (MAX_DIM - pad * 2) / h);
  const cw = Math.max(100, w * scale + pad * 2);
  const ch = Math.max(100, h * scale + pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.2;
  const tx = (x) => pad + (x - minX) * scale;
  const ty = (y) => pad + (maxY - y) * scale; // inverte eixo Y
  segs.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(tx(a.x), ty(a.y));
    ctx.lineTo(tx(b.x), ty(b.y));
    ctx.stroke();
  });
  return canvas.toDataURL('image/png');
}

// Converte um arquivo de planta (PDF/DXF/imagem) em PNG data URL.
// Retorna null para imagens (serão enviadas diretamente).
export async function convertPlanToPng(file) {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    return await pdfToPng(file);
  }
  if (name.endsWith('.dxf')) {
    return await dxfToPng(file);
  }
  if (name.endsWith('.dwg')) {
    throw new Error('Arquivos DWG precisam ser convertidos para DXF ou PDF antes de importar.');
  }
  return null; // imagem comum
}

export function isSupportedPlan(file) {
  const n = file.name.toLowerCase();
  return (
    file.type.startsWith('image/') ||
    n.endsWith('.pdf') ||
    n.endsWith('.dxf') ||
    n.endsWith('.dwg')
  );
}