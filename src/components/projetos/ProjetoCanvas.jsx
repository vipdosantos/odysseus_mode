import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { snapPoint, orthoLock, applyLength, buildSnapCandidates, computeVt } from '@/lib/projetoSnap';
import { computeVigotas, computeEscoras } from '@/lib/projetoCalculos';
import { Settings2 } from 'lucide-react';

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonAreaM2(vertices, scalePxPerM) {
  if (!vertices || vertices.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    area += (vertices[j].x + vertices[i].x) * (vertices[j].y - vertices[i].y);
  }
  area = Math.abs(area) / 2;
  const pxPerM2 = scalePxPerM * scalePxPerM;
  return area / pxPerM2;
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

const LINE_TOOLS = new Set(['linha', 'tracejada', 'vigota', 'nervura', 'negativo']);
const POINT_TOOLS = new Set(['ponto_luz', 'frigideira']);
const DRAW_TOOLS = new Set(['vertices', 'linha', 'tracejada', 'vigota', 'nervura', 'cotas', 'calibrar', 'retangulo', 'texto', 'ponto_luz', 'frigideira', 'negativo', 'direcao']);

// Espaçamento entre vigotas (intereixo) por tipo de treliça — usado na visualização de Núcleos
const INTEREIXO = { H8: 0.42, H12: 0.42, H16: 0.42, H20: 0.42, H25: 0.45, H30: 0.50 };

export default function ProjetoCanvas({
  slabs, drawingPoints, onAddPoint, onFinishDrawing, onSelectSlab,
  selectedSlabId, floorPlanUrl, floorPlanOpacity, scalePxPerM, tool,
  cotas, textos, annotations, showGrid, contornoAtivo, ortoAtivo, activeColor,
  panOffset, onPan,
  zoom, onZoom,
  onAddSlabRect, onAddCota, onAddTexto, onAddAnnotation,
  onCalibrate, onMoveSlab, onSetDirection,
  nucleosAtivo, negativoParams, onOpenNegativoDialog,
  planoEscoras, escoraCfg
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const imgRef = useRef(null);
  const [lenVal, setLenVal] = useState(''); // comprimento digitado (metros)
  const [pendingLen, setPendingLen] = useState(null); // metros, aplicado no próximo ponto
  const [imgLoaded, setImgLoaded] = useState(0); // força redraw quando a planta carrega
  const lenRef = useRef(null);
  const mouseRef = useRef({ down: false, start: null, calibFirst: null, cotaFirst: null, lineFirst: null, moveLast: null, rectStart: null, cur: null, panStart: null, snapped: null });

  const gridPx = Math.max(10, scalePxPerM || 100);

  const snapCandidates = useMemo(
    () => buildSnapCandidates(slabs, drawingPoints, annotations),
    [slabs, drawingPoints, annotations]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!floorPlanUrl) { imgRef.current = null; setImgLoaded(v => v + 1); return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(v => v + 1); };
    img.onerror = () => { imgRef.current = null; setImgLoaded(v => v + 1); };
    img.src = floorPlanUrl;
  }, [floorPlanUrl]);

  // Âncora para o próximo ponto (depende da ferramenta)
  const anchor = useCallback(() => {
    const m = mouseRef.current;
    if (tool === 'vertices') return drawingPoints[drawingPoints.length - 1] || null;
    if (LINE_TOOLS.has(tool)) return m.lineFirst;
    if (tool === 'cotas') return m.cotaFirst;
    if (tool === 'calibrar') return m.calibFirst;
    return null;
  }, [tool, drawingPoints]);

  // Converte posição do mouse para coordenada do canvas (com snap + ORTHO + comprimento)
  const resolvePoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ox = panOffset?.x || 0, oy = panOffset?.y || 0;
    const z = zoom || 1;
    const raw = { x: (e.clientX - rect.left - ox) / z, y: (e.clientY - rect.top - oy) / z };
    let snapped = snapPoint(raw, snapCandidates, gridPx, 12);
    const anc = anchor();
    let p = { x: snapped.x, y: snapped.y };
    if (anc) {
      if (ortoAtivo) p = orthoLock(anc, p);
      if (pendingLen != null) p = applyLength(anc, p, pendingLen, scalePxPerM);
    }
    mouseRef.current.snapped = p;
    return p;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = size;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);

    const ox = panOffset?.x || 0, oy = panOffset?.y || 0;
    const z = zoom || 1;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(z, z);

    if (showGrid) {
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1 / z;
      const wx0 = -ox / z, wy0 = -oy / z, wx1 = (w - ox) / z, wy1 = (h - oy) / z;
      const xStart = Math.floor(wx0 / gridPx) * gridPx;
      const yStart = Math.floor(wy0 / gridPx) * gridPx;
      for (let x = xStart; x <= wx1; x += gridPx) { ctx.beginPath(); ctx.moveTo(x, wy0); ctx.lineTo(x, wy1); ctx.stroke(); }
      for (let y = yStart; y <= wy1; y += gridPx) { ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke(); }
    }

    if (imgRef.current) {
      ctx.globalAlpha = floorPlanOpacity;
      const img = imgRef.current;
      const ratio = img.width / img.height;
      let dw = w, dh = w / ratio;
      if (dh > h) { dh = h; dw = h * ratio; }
      ctx.drawImage(img, 0, 0, dw, dh);
      ctx.globalAlpha = 1;
    }

    (annotations || []).forEach(a => {
      const lineColor = a.color || activeColor || '#111827';
      ctx.lineWidth = 1.5;
      if (a.type === 'linha') {
        ctx.strokeStyle = lineColor; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
      } else if (a.type === 'tracejada') {
        ctx.strokeStyle = lineColor; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (a.type === 'vigota') {
        ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
        ctx.lineWidth = 1.5;
      } else if (a.type === 'nervura') {
        ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (a.type === 'ponto_luz') {
        ctx.strokeStyle = '#ca8a04'; ctx.fillStyle = '#fef9c3'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(a.x, a.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(a.x - 4, a.y); ctx.lineTo(a.x + 4, a.y);
        ctx.moveTo(a.x, a.y - 4); ctx.lineTo(a.x, a.y + 4); ctx.stroke();
      } else if (a.type === 'frigideira') {
        // Frigideira: elemento maciço/rebaixo em região de apoio (quadrado hachurado)
        const r = 9;
        ctx.fillStyle = 'rgba(120,53,15,0.30)'; ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 1.5;
        ctx.fillRect(a.x - r, a.y - r, r * 2, r * 2);
        ctx.strokeRect(a.x - r, a.y - r, r * 2, r * 2);
        ctx.beginPath();
        for (let i = -r; i < r; i += 4) {
          ctx.moveTo(a.x + i, a.y - r); ctx.lineTo(a.x + i + r, a.y + r);
        }
        ctx.save(); ctx.beginPath(); ctx.rect(a.x - r, a.y - r, r * 2, r * 2); ctx.clip();
        for (let i = -r; i < r; i += 4) {
          ctx.beginPath(); ctx.moveTo(a.x + i, a.y - r); ctx.lineTo(a.x + i + r, a.y + r); ctx.stroke();
        }
        ctx.restore();
      } else if (a.type === 'negativo') {
        const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const nx = uy, ny = -ux;            // perpendicular à barra
        const color = '#7B68EE';
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([]);
        // barra principal (reta)
        ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
        // ganchos (dobras) nas pontas — lado -n
        const dEsq = a.igualar_dobras ? a.dobra_esq : a.dobra_esq;
        const dDir = a.igualar_dobras ? a.dobra_esq : a.dobra_dir;
        const hookPx = (cm) => Math.max(14, ((cm || 0) / 100) * scalePxPerM);
        const drawHook = (px, py, cm) => {
          if (a.acabamento !== 'com_dobra' || !cm) return;
          const h = hookPx(cm);
          const ex = px - nx * h, ey = py - ny * h;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = color; ctx.fillText(String(cm), ex - nx * 9, ey - ny * 9); ctx.textBaseline = 'alphabetic';
        };
        drawHook(a.x1, a.y1, dEsq);
        drawHook(a.x2, a.y2, dDir);
        // etiqueta de especificação acima do centro (+n)
        const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
        const mm = Math.round((a.comprimento || 0) * 1000);
        const spec = `${a.quantidade || 0} Ø${a.bitola || a.diametro || '8.0'} c/${a.espacamento || 0} C=${mm}`;
        ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(spec).width + 6;
        const lx = mx + nx * 14, ly = my + ny * 14;
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(lx - tw / 2, ly - 7, tw, 14);
        ctx.fillStyle = color; ctx.fillText(spec, lx, ly); ctx.textBaseline = 'alphabetic';
      }
    });

    // Cotas (medidas de paredes)
    (cotas || []).forEach(c => {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2); ctx.stroke();
      [[c.x1, c.y1], [c.x2, c.y2]].forEach(([px, py]) => {
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
      });
      const mx = (c.x1 + c.x2) / 2, my = (c.y1 + c.y2) / 2;
      const label = `${c.meters.toFixed(2)} m`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - tw / 2, my - 9, tw, 18);
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 0.5; ctx.strokeRect(mx - tw / 2, my - 9, tw, 18);
      ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my); ctx.textBaseline = 'alphabetic';
    });

    // Medidas das arestas de cada laje (parede por parede)
    slabs.forEach(slab => {
      const v = slab.vertices || [];
      ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dM = dist(a, b) / scalePxPerM;
        const label = `${dM.toFixed(2)}m`;
        const tw = ctx.measureText(label).width + 6;
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(mx - tw / 2, my - 7, tw, 14);
        ctx.fillStyle = slab.negativo ? '#b91c1c' : '#1d4ed8';
        ctx.fillText(label, mx, my);
      }
      ctx.textBaseline = 'alphabetic';
    });

    (textos || []).forEach(t => {
      ctx.fillStyle = '#111827'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(t.text, t.x, t.y);
    });

    slabs.forEach(slab => {
      const isSel = slab.id === selectedSlabId;
      ctx.beginPath();
      slab.vertices.forEach((v, i) => { if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
      ctx.closePath();
      if (slab.negativo) {
        ctx.fillStyle = 'rgba(239,68,68,0.15)'; ctx.fill();
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = contornoAtivo ? 4 : 2;
        ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(239,68,68,0.5)'; ctx.lineWidth = 1;
        const wx0 = -ox, wy0 = -oy, ww = w - ox, wh = h - oy;
        for (let i = wx0 - wh; i < ww + wh; i += 8) { ctx.beginPath(); ctx.moveTo(i, wy0); ctx.lineTo(i + wh, wh + wy0); ctx.stroke(); }
        ctx.restore();
      } else {
        ctx.fillStyle = isSel ? 'rgba(211,84,0,0.12)' : 'rgba(0,123,255,0.10)'; ctx.fill();
        ctx.strokeStyle = isSel ? '#D35400' : '#1a1e2e';
        ctx.lineWidth = contornoAtivo ? 4 : (isSel ? 2.5 : 1.5);
        ctx.stroke();
      }
      // Vigotas automáticas + núcleos (EPS) + plano de escoras
      if (!slab.negativo && slab.direction) {
        const vig = computeVigotas(slab, scalePxPerM);
        ctx.save();
        ctx.beginPath();
        slab.vertices.forEach((v, i) => { if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
        ctx.closePath();
        ctx.clip();
        if (planoEscoras) {
          const esc = computeEscoras(slab, scalePxPerM, escoraCfg);
          ctx.strokeStyle = 'rgba(220,38,38,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
          esc.lines.forEach(l => { ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); });
          ctx.setLineDash([]);
          ctx.fillStyle = '#dc2626';
          esc.props.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        } else {
          ctx.strokeStyle = 'rgba(146,64,14,0.75)'; ctx.lineWidth = 1.2; ctx.setLineDash([]);
          vig.lines.forEach(l => { ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); });
          if (nucleosAtivo) {
            ctx.fillStyle = 'rgba(245,158,11,0.18)';
            for (let i = 0; i < vig.lines.length - 1; i++) {
              const a = vig.lines[i], b = vig.lines[i + 1];
              ctx.beginPath();
              ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2);
              ctx.lineTo(b.x2, b.y2); ctx.lineTo(b.x1, b.y1);
              ctx.closePath(); ctx.fill();
            }
          }
        }
        ctx.restore();
      }

      // Alfinetes: verdes na seleção, azuis no padrão
      ctx.fillStyle = isSel ? '#1E8449' : '#007BFF';
      const r = isSel ? 5 : 4;
      slab.vertices.forEach(v => { ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, Math.PI * 2); ctx.fill(); });
      const cx = slab.vertices.reduce((a, v) => a + v.x, 0) / slab.vertices.length;
      const cy = slab.vertices.reduce((a, v) => a + v.y, 0) / slab.vertices.length;

      // Seta dupla vermelha indicando a direção das vigotas
      if (slab.direction) {
        const dx = (slab.direction.x2 || 0) - (slab.direction.x1 || 0);
        const dy = (slab.direction.y2 || 0) - (slab.direction.y1 || 0);
        const len = Math.hypot(dx, dy);
        if (len > 1) {
          const ux = dx / len, uy = dy / len;
          let min = Infinity, max = -Infinity;
          for (const v of slab.vertices) {
            const proj = (v.x - cx) * ux + (v.y - cy) * uy;
            if (proj < min) min = proj;
            if (proj > max) max = proj;
          }
          const ax = cx + ux * min, ay = cy + uy * min;
          const bx = cx + ux * max, by = cy + uy * max;
          ctx.strokeStyle = '#E74C3C'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          const ah = 11, ang = Math.atan2(uy, ux);
          const drawHead = (px, py, dirSign) => {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - ah * Math.cos(ang + dirSign * 0.4), py - ah * Math.sin(ang + dirSign * 0.4));
            ctx.moveTo(px, py);
            ctx.lineTo(px - ah * Math.cos(ang - dirSign * 0.4), py - ah * Math.sin(ang - dirSign * 0.4));
            ctx.stroke();
          };
          drawHead(ax, ay, 1);
          drawHead(bx, by, -1);
        }
      }

      ctx.fillStyle = '#111827'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
      const vt = computeVigotas(slab, scalePxPerM).vt || slab.vt || 0;
      const tag = slab.negativo
        ? `${slab.label} (Neg)`
        : `${slab.label} (${slab.area_m2.toFixed(2)} m²)${vt ? ` (${vt}vt)` : ''}`;
      ctx.fillText(tag, cx, cy);
    });

    if (drawingPoints.length > 0) {
      ctx.beginPath();
      drawingPoints.forEach((v, i) => { if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
      const cur = mouseRef.current.cur;
      if (cur && tool === 'vertices') ctx.lineTo(cur.x, cur.y);
      ctx.strokeStyle = '#007BFF'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#007BFF';
      drawingPoints.forEach(v => { ctx.beginPath(); ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); ctx.fill(); });
    }

    const m = mouseRef.current;

    if (tool === 'retangulo' && m.down && m.rectStart && m.cur) {
      const s = m.rectStart, c = m.cur;
      ctx.strokeStyle = '#007BFF'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.strokeRect(Math.min(s.x, c.x), Math.min(s.y, c.y), Math.abs(c.x - s.x), Math.abs(c.y - s.y));
      ctx.setLineDash([]);
    }

    if (tool === 'direcao' && m.down && m.dirStart && m.cur) {
      const s = m.dirStart, c = m.cur;
      const dx = c.x - s.x, dy = c.y - s.y, len = Math.hypot(dx, dy);
      ctx.strokeStyle = '#E74C3C'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      if (len > 4) {
        const ah = 11, ang = Math.atan2(dy, dx);
        const drawHead = (px, py, dirSign) => {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - ah * Math.cos(ang + dirSign * 0.4), py - ah * Math.sin(ang + dirSign * 0.4));
          ctx.moveTo(px, py);
          ctx.lineTo(px - ah * Math.cos(ang - dirSign * 0.4), py - ah * Math.sin(ang - dirSign * 0.4));
          ctx.stroke();
        };
        drawHead(s.x, s.y, 1);
        drawHead(c.x, c.y, -1);
      }
    }

    if (LINE_TOOLS.has(tool) && m.lineFirst && m.cur) {
      let end = m.cur;
      if (ortoAtivo) end = orthoLock(m.lineFirst, m.cur);
      if (pendingLen != null) end = applyLength(m.lineFirst, end, pendingLen, scalePxPerM);
      const dM = dist(m.lineFirst, end) / scalePxPerM;
      ctx.strokeStyle = tool === 'vigota' ? '#92400e' : tool === 'nervura' ? '#16a34a' : tool === 'negativo' ? '#7B68EE' : (activeColor || '#111827');
      ctx.lineWidth = tool === 'vigota' ? 3 : tool === 'negativo' ? 2.5 : 2;
      ctx.setLineDash(tool === 'tracejada' || tool === 'nervura' ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(m.lineFirst.x, m.lineFirst.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(m.lineFirst.x, m.lineFirst.y, 4, 0, Math.PI * 2); ctx.fill();
      // medida ao longo da linha
      const mx = (m.lineFirst.x + end.x) / 2, my = (m.lineFirst.y + end.y) / 2;
      const label = `${dM.toFixed(2)} m`;
      ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
      ctx.fillStyle = '#111827'; ctx.fillText(label, mx, my); ctx.textBaseline = 'alphabetic';
    }

    if (tool === 'calibrar' && m.calibFirst && m.cur) {
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(m.calibFirst.x, m.calibFirst.y); ctx.lineTo(m.cur.x, m.cur.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#16a34a';
      ctx.beginPath(); ctx.arc(m.calibFirst.x, m.calibFirst.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(m.cur.x, m.cur.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (tool === 'cotas' && m.cotaFirst && m.cur) {
      let end = m.cur;
      if (ortoAtivo) end = orthoLock(m.cotaFirst, m.cur);
      const d = dist(m.cotaFirst, end) / scalePxPerM;
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(m.cotaFirst.x, m.cotaFirst.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${d.toFixed(2)} m`, (m.cotaFirst.x + end.x) / 2, (m.cotaFirst.y + end.y) / 2);
    }

    // Indicador de snap
    if (m.snapped && DRAW_TOOLS.has(tool)) {
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 1.5;
      ctx.strokeRect(m.snapped.x - 5, m.snapped.y - 5, 10, 10);
    }

    ctx.restore();
  }, [slabs, drawingPoints, selectedSlabId, floorPlanOpacity, scalePxPerM, size, cotas, textos, annotations, showGrid, contornoAtivo, ortoAtivo, tool, activeColor, panOffset, zoom, snapCandidates, gridPx, pendingLen, nucleosAtivo, planoEscoras, escoraCfg, imgLoaded, floorPlanUrl]);

  // Roda do mouse → zoom em torno do cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      onZoom?.(factor, sx, sy);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [onZoom]);

  useEffect(() => { draw(); }, [draw]);

  // Ferramentas baseadas em arrasto (pressionar → mover → soltar)
  const DRAG_TOOLS = new Set(['linha', 'tracejada', 'vigota', 'nervura', 'cotas', 'calibrar']);

  // Aplica o comprimento digitado — será usado no próximo posicionamento
  const applyLengthNow = () => {
    const meters = parseFloat(lenVal.replace(',', '.'));
    if (!meters || meters <= 0) return;
    setPendingLen(meters);
    setLenVal('');
  };

  // Clique — usado apenas para ferramentas de clique único (vértices, ponto, texto, seleção, negativo)
  const handleClick = (e) => {
    if (tool === 'select') {
      const p = rawPos(e);
      const hit = slabs.find(s => pointInPolygon(p, s.vertices));
      onSelectSlab(hit ? hit.id : null);
      return;
    }
    if (tool === 'vertices') { const p = resolvePoint(e); onAddPoint(p); setPendingLen(null); return; }
    if (tool === 'ponto_luz') { const p = resolvePoint(e); onAddAnnotation({ type: tool, x: p.x, y: p.y }); return; }
    if (tool === 'frigideira') { const p = resolvePoint(e); onAddAnnotation({ type: tool, x: p.x, y: p.y }); return; }
    if (tool === 'texto') { const p = resolvePoint(e); onAddTexto(p); return; }
    // ferramentas de arrasto confirmam no mouseup
  };

  const rawPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ox = panOffset?.x || 0, oy = panOffset?.y || 0;
    const z = zoom || 1;
    return { x: (e.clientX - rect.left - ox) / z, y: (e.clientY - rect.top - oy) / z };
  };

  const handleDoubleClick = () => { if (tool === 'vertices') onFinishDrawing(); };

  const handleMouseDown = (e) => {
    const s = screenPos(e);
    const m = mouseRef.current;
    if (e.button === 1) { // botão do meio (roda clicada) → pan
      e.preventDefault();
      m.midPan = { sx: s.x, sy: s.y, ox: panOffset?.x || 0, oy: panOffset?.y || 0 };
      m.down = true;
      return;
    }
    const p = (tool === 'retangulo' || tool === 'mover' || tool === 'pan' || tool === 'direcao') ? rawPos(e) : resolvePoint(e);
    m.down = true; m.cur = p;
    if (LINE_TOOLS.has(tool)) { m.lineFirst = p; }
    else if (tool === 'cotas') { m.cotaFirst = p; }
    else if (tool === 'calibrar') { m.calibFirst = p; }
    else if (tool === 'retangulo') { m.rectStart = p; }
    else if (tool === 'direcao') {
      const hit = slabs.find(sl => pointInPolygon(p, sl.vertices));
      if (hit) { onSelectSlab(hit.id); m.dirStart = p; m.dirSlabId = hit.id; }
    }
    else if (tool === 'mover') {
      const hit = slabs.find(sl => pointInPolygon(p, sl.vertices));
      if (hit) { onSelectSlab(hit.id); m.moveLast = p; }
    } else if (tool === 'pan') {
      m.panStart = { sx: s.x, sy: s.y, ox: panOffset?.x || 0, oy: panOffset?.y || 0 };
    }
  };

  const screenPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseMove = (e) => {
    const s = screenPos(e);
    const m = mouseRef.current;
    m._screenX = e.clientX; m._screenY = e.clientY;
    if (m.down && m.midPan) {
      onPan(m.midPan.ox + (s.x - m.midPan.sx), m.midPan.oy + (s.y - m.midPan.sy));
      return;
    }
    let p;
    if (DRAW_TOOLS.has(tool)) p = resolvePoint(e);
    else p = rawPos(e);
    m.cur = p;
    if (m.down && tool === 'mover' && m.moveLast && selectedSlabId) {
      const dx = p.x - m.moveLast.x, dy = p.y - m.moveLast.y;
      onMoveSlab(selectedSlabId, dx, dy); m.moveLast = p;
    } else if (m.down && tool === 'pan' && m.panStart) {
      onPan(m.panStart.ox + (s.x - m.panStart.sx), m.panStart.oy + (s.y - m.panStart.sy));
    }
  };

  const handleMouseUp = (e) => {
    const m = mouseRef.current;
    m.down = false;
    m.midPan = null;
    if (LINE_TOOLS.has(tool) && m.lineFirst) {
      const p = resolvePoint(e);
      if (tool === 'negativo') {
        const np = negativoParams || {};
        const comp = dist(m.lineFirst, p) / scalePxPerM;
        const tp = np.acabamento === 'com_dobra' ? (np.igualar_dobras ? np.dobra_esq : np.dobra_esq) : 0;
        onAddAnnotation({
          type: 'negativo', x1: m.lineFirst.x, y1: m.lineFirst.y, x2: p.x, y2: p.y,
          diametro: np.bitola || '8.0', espacamento: np.espacamento || 0, transpasse: tp, comprimento: comp,
          tipo_aco: np.tipo_aco, bitola: np.bitola, quantidade: np.quantidade, acabamento: np.acabamento,
          dobra_esq: np.dobra_esq, dobra_dir: np.dobra_dir, igualar_dobras: np.igualar_dobras
        });
      } else {
        onAddAnnotation({ type: tool, x1: m.lineFirst.x, y1: m.lineFirst.y, x2: p.x, y2: p.y, color: activeColor });
      }
      m.lineFirst = null; setPendingLen(null);
    } else if (tool === 'cotas' && m.cotaFirst) {
      const p = resolvePoint(e);
      onAddCota({ x1: m.cotaFirst.x, y1: m.cotaFirst.y, x2: p.x, y2: p.y, meters: dist(m.cotaFirst, p) / scalePxPerM });
      m.cotaFirst = null; setPendingLen(null);
    } else if (tool === 'calibrar' && m.calibFirst) {
      const p = resolvePoint(e);
      onCalibrate(dist(m.calibFirst, p));
      m.calibFirst = null;
    } else if (tool === 'retangulo' && m.rectStart) {
      const c = m.cur;
      const s = m.rectStart;
      const wpx = Math.abs(c.x - s.x), hpx = Math.abs(c.y - s.y);
      if (wpx > 4 && hpx > 4) {
        const x0 = Math.min(s.x, c.x), y0 = Math.min(s.y, c.y);
        onAddSlabRect([{ x: x0, y: y0 }, { x: x0 + wpx, y: y0 }, { x: x0 + wpx, y: y0 + hpx }, { x: x0, y: y0 + hpx }]);
      }
      m.rectStart = null;
    } else if (tool === 'direcao' && m.dirStart) {
      const p = rawPos(e);
      const dx = p.x - m.dirStart.x, dy = p.y - m.dirStart.y;
      if (Math.hypot(dx, dy) > 4 && m.dirSlabId) {
        onSetDirection(m.dirSlabId, { x1: m.dirStart.x, y1: m.dirStart.y, x2: p.x, y2: p.y });
      }
      m.dirStart = null; m.dirSlabId = null;
    }
    if (tool === 'mover') { m.moveLast = null; }
    if (tool === 'pan') { m.panStart = null; }
  };

  const handleMouseLeave = () => {
    const m = mouseRef.current;
    m.down = false; m.rectStart = null; m.cur = null; m.panStart = null; m.midPan = null; m.snapped = null;
    m.dirStart = null; m.dirSlabId = null;
  };

  // Suporte a touch (mobile/tablet): mapeia toque → gestos de mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const makeEvt = (t) => ({ clientX: t.clientX, clientY: t.clientY, button: 0, buttons: 1, preventDefault() {}, stopPropagation() {} });
    const ts = (e) => { if (e.touches.length === 1) handleMouseDown(makeEvt(e.touches[0])); };
    const tm = (e) => { if (e.touches.length === 1) { e.preventDefault(); handleMouseMove(makeEvt(e.touches[0])); } };
    const te = (e) => { if (e.changedTouches.length === 1) { const evt = makeEvt(e.changedTouches[0]); handleMouseUp(evt); handleClick(evt); } };
    canvas.addEventListener('touchstart', ts, { passive: false });
    canvas.addEventListener('touchmove', tm, { passive: false });
    canvas.addEventListener('touchend', te, { passive: false });
    canvas.addEventListener('touchcancel', te, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', ts);
      canvas.removeEventListener('touchmove', tm);
      canvas.removeEventListener('touchend', te);
      canvas.removeEventListener('touchcancel', te);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleClick]);

  // Foca o campo de comprimento ao digitar número enquanto desenha
  useEffect(() => {
    const onKey = (e) => {
      if (!DRAW_TOOLS.has(tool)) return;
      if (document.activeElement === lenRef.current) return;
      if (/^[0-9.,]$/.test(e.key)) {
        lenRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool]);

  const cursorClass = {
    vertices: 'cursor-crosshair', retangulo: 'cursor-crosshair', cotas: 'cursor-crosshair',
    calibrar: 'cursor-crosshair', texto: 'cursor-text', mover: 'cursor-move', pan: 'cursor-grab',
    select: 'cursor-pointer', negativo: 'cursor-pointer',
    linha: 'cursor-crosshair', tracejada: 'cursor-crosshair', vigota: 'cursor-crosshair',
    nervura: 'cursor-crosshair', ponto_luz: 'cursor-crosshair', negativo: 'cursor-crosshair', direcao: 'cursor-crosshair',
  }[tool] || 'cursor-pointer';

  const showLenBox = DRAW_TOOLS.has(tool) && tool !== 'ponto_luz' && tool !== 'texto' && tool !== 'negativo';

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`block ${cursorClass}`}
      />

      {showLenBox && (
        <div className="absolute bottom-10 right-3 flex items-center gap-2 bg-white border border-border rounded-md shadow px-2 py-1.5">
          <span className="text-xs text-muted-foreground">Comprimento (m):</span>
          <input
            ref={lenRef}
            type="text"
            inputMode="decimal"
            value={lenVal}
            onChange={(e) => setLenVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLengthNow(); } }}
            placeholder="ex: 4.5"
            className="w-20 text-sm outline-none border-b border-border focus:border-primary"
          />
          <button
            onClick={applyLengthNow}
            className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
          >Aplicar</button>
        </div>
      )}

      {tool === 'negativo' && (
        <button
          onClick={onOpenNegativoDialog}
          className="absolute bottom-10 right-3 flex items-center gap-1.5 bg-white border border-purple-300 rounded-md shadow px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
        >
          <Settings2 className="w-3.5 h-3.5" /> Configurar Negativo
        </button>
      )}

      <div className="absolute bottom-2 right-3 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
        Escala: 1 m = {Math.round(scalePxPerM)} px • Zoom: {Math.round((zoom || 1) * 100)}%{ortoAtivo ? ' • ORTO' : ''}{contornoAtivo ? ' • Contorno' : ''}{activeColor ? ` • ${activeColor}` : ''}{pendingLen != null ? ` • Próx: ${pendingLen}m` : ''}
      </div>
      {tool === 'calibrar' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-green-600 text-white px-3 py-1.5 rounded-full shadow">
          Pressione e arraste entre dois pontos da planta e informe a distância real em metros
        </div>
      )}
      {LINE_TOOLS.has(tool) && tool !== 'negativo' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-3 py-1.5 rounded-full shadow">
          Pressione e arraste para desenhar (digite o comprimento para precisão exata)
        </div>
      )}
      {tool === 'negativo' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-purple-700 text-white px-3 py-1.5 rounded-full shadow">
          Pressione e arraste para lançar a barra negativa (ajuste Ø, espaçamento e transpasse ao lado)
        </div>
      )}
      {tool === 'direcao' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-red-600 text-white px-3 py-1.5 rounded-full shadow">
          Arraste dentro de uma laje para definir a direção das vigotas
        </div>
      )}
    </div>
  );
}