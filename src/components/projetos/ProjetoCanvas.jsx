import React, { useRef, useEffect, useState, useCallback } from 'react';

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

function orthoSnap(a, b) {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx >= dy) return { x: b.x, y: a.y };
  return { x: a.x, y: b.y };
}

const LINE_TOOLS = new Set(['linha', 'tracejada', 'vigota', 'nervura']);
const POINT_TOOLS = new Set(['ponto_luz']);

export default function ProjetoCanvas({
  slabs, drawingPoints, onAddPoint, onFinishDrawing, onSelectSlab,
  selectedSlabId, floorPlanUrl, floorPlanOpacity, scalePxPerM, tool,
  cotas, textos, annotations, showGrid, contornoAtivo, ortoAtivo, activeColor,
  panOffset, onPan,
  onAddSlabRect, onAddCota, onAddTexto, onAddAnnotation, onToggleNegativo,
  onCalibrate, onMoveSlab
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const imgRef = useRef(null);
  const mouseRef = useRef({ down: false, start: null, calibFirst: null, cotaFirst: null, lineFirst: null, moveLast: null, rectStart: null, cur: null, panStart: null });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!floorPlanUrl) { imgRef.current = null; return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = floorPlanUrl;
  }, [floorPlanUrl]);

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
    ctx.save();
    ctx.translate(ox, oy);

    if (showGrid) {
      const gridPx = Math.max(10, scalePxPerM);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
      const xStart = Math.floor(-ox / gridPx) * gridPx;
      const yStart = Math.floor(-oy / gridPx) * gridPx;
      for (let x = xStart; x <= w - ox; x += gridPx) { ctx.beginPath(); ctx.moveTo(x, yStart); ctx.lineTo(x, h - oy); ctx.stroke(); }
      for (let y = yStart; y <= h - oy; y += gridPx) { ctx.beginPath(); ctx.moveTo(xStart, y); ctx.lineTo(w - ox, y); ctx.stroke(); }
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
      }
    });

    (cotas || []).forEach(c => {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2); ctx.stroke();
      [[c.x1, c.y1], [c.x2, c.y2]].forEach(([px, py]) => {
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
      });
      const mx = (c.x1 + c.x2) / 2, my = (c.y1 + c.y2) / 2;
      const label = `${c.meters.toFixed(2)} m`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const tw = ctx.measureText(label).width + 6;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
      ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my); ctx.textBaseline = 'alphabetic';
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
        ctx.fillStyle = isSel ? 'rgba(0,123,255,0.22)' : 'rgba(0,123,255,0.10)'; ctx.fill();
        ctx.strokeStyle = isSel ? '#007BFF' : '#1a1e2e';
        ctx.lineWidth = contornoAtivo ? 4 : (isSel ? 2.5 : 1.5);
        ctx.stroke();
      }
      ctx.fillStyle = '#007BFF';
      slab.vertices.forEach(v => { ctx.beginPath(); ctx.arc(v.x, v.y, 4, 0, Math.PI * 2); ctx.fill(); });
      const cx = slab.vertices.reduce((a, v) => a + v.x, 0) / slab.vertices.length;
      const cy = slab.vertices.reduce((a, v) => a + v.y, 0) / slab.vertices.length;
      ctx.fillStyle = '#111827'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
      const tag = slab.negativo ? `${slab.label} (Neg)` : `${slab.label} • ${slab.area_m2.toFixed(2)}m²`;
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

    if (LINE_TOOLS.has(tool) && m.lineFirst && m.cur) {
      let end = m.cur;
      if (ortoAtivo) end = orthoSnap(m.lineFirst, m.cur);
      ctx.strokeStyle = tool === 'vigota' ? '#92400e' : tool === 'nervura' ? '#16a34a' : (activeColor || '#111827');
      ctx.lineWidth = tool === 'vigota' ? 3 : 2;
      ctx.setLineDash(tool === 'tracejada' || tool === 'nervura' ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(m.lineFirst.x, m.lineFirst.y); ctx.lineTo(end.x, end.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(m.lineFirst.x, m.lineFirst.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    if (tool === 'calibrar' && m.calibFirst && m.cur) {
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(m.calibFirst.x, m.calibFirst.y); ctx.lineTo(m.cur.x, m.cur.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#16a34a';
      ctx.beginPath(); ctx.arc(m.calibFirst.x, m.calibFirst.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(m.cur.x, m.cur.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (tool === 'cotas' && m.cotaFirst && m.cur) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(m.cotaFirst.x, m.cotaFirst.y); ctx.lineTo(m.cur.x, m.cur.y); ctx.stroke(); ctx.setLineDash([]);
      const d = dist(m.cotaFirst, m.cur) / scalePxPerM;
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${d.toFixed(2)} m`, (m.cotaFirst.x + m.cur.x) / 2, (m.cotaFirst.y + m.cur.y) / 2);
    }

    ctx.restore();
  }, [slabs, drawingPoints, selectedSlabId, floorPlanOpacity, scalePxPerM, size, cotas, textos, annotations, showGrid, contornoAtivo, ortoAtivo, tool, activeColor, panOffset]);

  useEffect(() => { draw(); }, [draw]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ox = panOffset?.x || 0, oy = panOffset?.y || 0;
    return { x: e.clientX - rect.left - ox, y: e.clientY - rect.top - oy };
  };

  const getScreen = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleClick = (e) => {
    const p = getPos(e);
    const m = mouseRef.current;
    if (tool === 'vertices') { onAddPoint(p); return; }
    if (tool === 'select') {
      const hit = slabs.find(s => pointInPolygon(p, s.vertices));
      onSelectSlab(hit ? hit.id : null); return;
    }
    if (tool === 'negativo') {
      const hit = slabs.find(s => pointInPolygon(p, s.vertices));
      if (hit) onToggleNegativo(hit.id); return;
    }
    if (tool === 'cotas') {
      if (!m.cotaFirst) { m.cotaFirst = p; }
      else { const px = dist(m.cotaFirst, p); onAddCota({ x1: m.cotaFirst.x, y1: m.cotaFirst.y, x2: p.x, y2: p.y, meters: px / scalePxPerM }); m.cotaFirst = null; }
      return;
    }
    if (tool === 'texto') { onAddTexto(p); return; }
    if (tool === 'calibrar') {
      if (!m.calibFirst) { m.calibFirst = p; }
      else { const px = dist(m.calibFirst, p); m.calibFirst = null; onCalibrate(px); }
      return;
    }
    if (LINE_TOOLS.has(tool)) {
      if (!m.lineFirst) { m.lineFirst = p; }
      else {
        let end = p;
        if (ortoAtivo) end = orthoSnap(m.lineFirst, p);
        onAddAnnotation({ type: tool, x1: m.lineFirst.x, y1: m.lineFirst.y, x2: end.x, y2: end.y, color: activeColor });
        m.lineFirst = null;
      }
      return;
    }
    if (POINT_TOOLS.has(tool)) {
      onAddAnnotation({ type: tool, x: p.x, y: p.y });
      return;
    }
  };

  const handleDoubleClick = () => { if (tool === 'vertices') onFinishDrawing(); };

  const handleMouseDown = (e) => {
    const p = getPos(e);
    const s = getScreen(e);
    const m = mouseRef.current;
    m.down = true; m.cur = p;
    if (tool === 'retangulo') { m.rectStart = p; }
    else if (tool === 'mover') {
      const hit = slabs.find(sl => pointInPolygon(p, sl.vertices));
      if (hit) { onSelectSlab(hit.id); m.moveLast = p; }
    } else if (tool === 'pan') {
      m.panStart = { sx: s.x, sy: s.y, ox: panOffset?.x || 0, oy: panOffset?.y || 0 };
    }
  };

  const handleMouseMove = (e) => {
    const p = getPos(e);
    const s = getScreen(e);
    const m = mouseRef.current;
    m.cur = p;
    if (m.down && tool === 'mover' && m.moveLast && selectedSlabId) {
      const dx = p.x - m.moveLast.x, dy = p.y - m.moveLast.y;
      onMoveSlab(selectedSlabId, dx, dy); m.moveLast = p;
    } else if (m.down && tool === 'pan' && m.panStart) {
      onPan(m.panStart.ox + (s.x - m.panStart.sx), m.panStart.oy + (s.y - m.panStart.sy));
    }
  };

  const handleMouseUp = () => {
    const m = mouseRef.current;
    m.down = false;
    if (tool === 'retangulo' && m.rectStart) {
      const c = m.cur;
      const s = m.rectStart;
      const wpx = Math.abs(c.x - s.x), hpx = Math.abs(c.y - s.y);
      if (wpx > 4 && hpx > 4) {
        const x0 = Math.min(s.x, c.x), y0 = Math.min(s.y, c.y);
        const x1 = x0 + wpx, y1 = y0 + hpx;
        onAddSlabRect([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]);
      }
      m.rectStart = null;
    }
    if (tool === 'mover') { m.moveLast = null; }
    if (tool === 'pan') { m.panStart = null; }
  };

  const handleMouseLeave = () => {
    const m = mouseRef.current;
    m.down = false; m.rectStart = null; m.cur = null; m.panStart = null;
  };

  const cursorClass = {
    vertices: 'cursor-crosshair', retangulo: 'cursor-crosshair', cotas: 'cursor-crosshair',
    calibrar: 'cursor-crosshair', texto: 'cursor-text', mover: 'cursor-move', pan: 'cursor-grab',
    select: 'cursor-pointer', negativo: 'cursor-pointer',
    linha: 'cursor-crosshair', tracejada: 'cursor-crosshair', vigota: 'cursor-crosshair',
    nervura: 'cursor-crosshair', ponto_luz: 'cursor-crosshair',
  }[tool] || 'cursor-pointer';

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
      <div className="absolute bottom-2 right-3 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
        Escala: 1 m = {Math.round(scalePxPerM)} px{ortoAtivo ? ' • ORTO' : ''}{contornoAtivo ? ' • Contorno' : ''}{activeColor ? ` • ${activeColor}` : ''}
      </div>
      {tool === 'calibrar' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-green-600 text-white px-3 py-1.5 rounded-full shadow">
          Clique em dois pontos da planta e informe a distância real em metros
        </div>
      )}
      {LINE_TOOLS.has(tool) && !mouseRef.current?.lineFirst && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-3 py-1.5 rounded-full shadow">
          Clique no primeiro ponto
        </div>
      )}
    </div>
  );
}