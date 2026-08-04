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

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function ProjetoCanvas({
  slabs, drawingPoints, onAddPoint, onFinishDrawing, onSelectSlab,
  selectedSlabId, floorPlanUrl, floorPlanOpacity, scalePxPerM, tool,
  cotas, textos, showGrid, onAddSlabRect, onAddCota, onAddTexto,
  onCalibrate, onMoveSlab, onRotateSlab
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const imgRef = useRef(null);
  const mouseRef = useRef({ down: false, start: null, calibFirst: null, cotaFirst: null, moveStart: null, moveLast: null, rectStart: null, cur: null });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
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
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    if (showGrid) {
      const gridPx = Math.max(10, scalePxPerM);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += gridPx) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridPx) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
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

    // cotas (dimension lines)
    (cotas || []).forEach(c => {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      // endpoints
      [[c.x1, c.y1], [c.x2, c.y2]].forEach(([px, py]) => {
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
      });
      // label
      const mx = (c.x1 + c.x2) / 2;
      const my = (c.y1 + c.y2) / 2;
      const label = `${c.meters.toFixed(2)} m`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const tw = ctx.measureText(label).width + 6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
      ctx.textBaseline = 'alphabetic';
    });

    // textos
    (textos || []).forEach(t => {
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(t.text, t.x, t.y);
    });

    // slabs
    slabs.forEach(slab => {
      const isSel = slab.id === selectedSlabId;
      ctx.beginPath();
      slab.vertices.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.fillStyle = isSel ? 'rgba(0,123,255,0.22)' : 'rgba(0,123,255,0.10)';
      ctx.fill();
      ctx.strokeStyle = isSel ? '#007BFF' : '#1a1e2e';
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.stroke();
      ctx.fillStyle = '#007BFF';
      slab.vertices.forEach(v => {
        ctx.beginPath(); ctx.arc(v.x, v.y, 4, 0, Math.PI * 2); ctx.fill();
      });
      const cx = slab.vertices.reduce((a, v) => a + v.x, 0) / slab.vertices.length;
      const cy = slab.vertices.reduce((a, v) => a + v.y, 0) / slab.vertices.length;
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${slab.label} • ${slab.area_m2.toFixed(2)}m²`, cx, cy);
    });

    // drawing in progress (vertices)
    if (drawingPoints.length > 0) {
      ctx.beginPath();
      drawingPoints.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
      });
      const cur = mouseRef.current.cur;
      if (cur && tool === 'vertices') {
        ctx.lineTo(cur.x, cur.y);
      }
      ctx.strokeStyle = '#007BFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#007BFF';
      drawingPoints.forEach(v => {
        ctx.beginPath(); ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); ctx.fill();
      });
    }

    // rectangle preview
    const m = mouseRef.current;
    if (tool === 'retangulo' && m.down && m.rectStart && m.cur) {
      const s = m.rectStart;
      const c = m.cur;
      ctx.strokeStyle = '#007BFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(Math.min(s.x, c.x), Math.min(s.y, c.y), Math.abs(c.x - s.x), Math.abs(c.y - s.y));
      ctx.setLineDash([]);
    }

    // calibrar preview
    if (tool === 'calibrar' && m.calibFirst && m.cur) {
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(m.calibFirst.x, m.calibFirst.y);
      ctx.lineTo(m.cur.x, m.cur.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#16a34a';
      ctx.beginPath(); ctx.arc(m.calibFirst.x, m.calibFirst.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(m.cur.x, m.cur.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    // cota preview
    if (tool === 'cotas' && m.cotaFirst && m.cur) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(m.cotaFirst.x, m.cotaFirst.y);
      ctx.lineTo(m.cur.x, m.cur.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const d = dist(m.cotaFirst, m.cur) / scalePxPerM;
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${d.toFixed(2)} m`, (m.cotaFirst.x + m.cur.x) / 2, (m.cotaFirst.y + m.cur.y) / 2);
    }
  }, [slabs, drawingPoints, selectedSlabId, floorPlanOpacity, scalePxPerM, size, cotas, textos, showGrid, tool]);

  useEffect(() => { draw(); }, [draw]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleClick = (e) => {
    const p = getPos(e);
    const m = mouseRef.current;
    if (tool === 'vertices') {
      onAddPoint(p);
    } else if (tool === 'select') {
      const hit = slabs.find(s => pointInPolygon(p, s.vertices));
      onSelectSlab(hit ? hit.id : null);
    } else if (tool === 'cotas') {
      if (!m.cotaFirst) {
        m.cotaFirst = p;
      } else {
        const px = dist(m.cotaFirst, p);
        const meters = px / scalePxPerM;
        onAddCota({ x1: m.cotaFirst.x, y1: m.cotaFirst.y, x2: p.x, y2: p.y, meters });
        m.cotaFirst = null;
      }
    } else if (tool === 'texto') {
      onAddTexto(p);
    } else if (tool === 'calibrar') {
      if (!m.calibFirst) {
        m.calibFirst = p;
      } else {
        const px = dist(m.calibFirst, p);
        m.calibFirst = null;
        onCalibrate(px);
      }
    } else if (tool === 'girar') {
      const hit = slabs.find(s => pointInPolygon(p, s.vertices));
      if (hit) onRotateSlab(hit.id);
    }
  };

  const handleDoubleClick = () => {
    if (tool === 'vertices') onFinishDrawing();
  };

  const handleMouseDown = (e) => {
    const p = getPos(e);
    const m = mouseRef.current;
    m.down = true;
    m.cur = p;
    if (tool === 'retangulo') {
      m.rectStart = p;
    } else if (tool === 'mover') {
      const hit = slabs.find(s => pointInPolygon(p, s.vertices));
      if (hit) {
        onSelectSlab(hit.id);
        m.moveStart = p;
        m.moveLast = p;
      }
    }
  };

  const handleMouseMove = (e) => {
    const p = getPos(e);
    const m = mouseRef.current;
    m.cur = p;
    if (m.down && tool === 'mover' && m.moveLast && selectedSlabId) {
      const dx = p.x - m.moveLast.x;
      const dy = p.y - m.moveLast.y;
      onMoveSlab(selectedSlabId, dx, dy);
      m.moveLast = p;
    }
  };

  const handleMouseUp = (e) => {
    const p = getPos(e);
    const m = mouseRef.current;
    m.down = false;
    if (tool === 'retangulo' && m.rectStart) {
      const s = m.rectStart;
      const w = Math.abs(p.x - s.x);
      const h = Math.abs(p.y - s.y);
      if (w > 4 && h > 4) {
        const x0 = Math.min(s.x, p.x);
        const y0 = Math.min(s.y, p.y);
        const x1 = x0 + w;
        const y1 = y0 + h;
        onAddSlabRect([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]);
      }
      m.rectStart = null;
    }
    if (tool === 'mover') {
      m.moveStart = null;
      m.moveLast = null;
    }
  };

  const handleMouseLeave = () => {
    const m = mouseRef.current;
    m.down = false;
    m.rectStart = null;
    m.cur = null;
  };

  const cursorClass = {
    vertices: 'cursor-crosshair',
    retangulo: 'cursor-crosshair',
    cotas: 'cursor-crosshair',
    calibrar: 'cursor-crosshair',
    texto: 'cursor-text',
    mover: 'cursor-move',
    girar: 'cursor-pointer',
    select: 'cursor-pointer',
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
        Escala: 1 m = {Math.round(scalePxPerM)} px
      </div>
      {tool === 'calibrar' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-green-600 text-white px-3 py-1.5 rounded-full shadow">
          Clique em dois pontos da planta e informe a distância real em metros
        </div>
      )}
      {tool === 'cotas' && !mouseRef.current?.cotaFirst && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-red-600 text-white px-3 py-1.5 rounded-full shadow">
          Clique no primeiro ponto da cota
        </div>
      )}
    </div>
  );
}