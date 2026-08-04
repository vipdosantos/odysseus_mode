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

export default function ProjetoCanvas({
  slabs, drawingPoints, onAddPoint, onFinishDrawing, onSelectSlab,
  selectedSlabId, floorPlanUrl, floorPlanOpacity, scalePxPerM, tool
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const imgRef = useRef(null);

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

    // grid
    const gridPx = Math.max(10, scalePxPerM);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += gridPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // floor plan
    if (imgRef.current) {
      ctx.globalAlpha = floorPlanOpacity;
      const img = imgRef.current;
      const ratio = img.width / img.height;
      let dw = w, dh = w / ratio;
      if (dh > h) { dh = h; dw = h * ratio; }
      ctx.drawImage(img, 0, 0, dw, dh);
      ctx.globalAlpha = 1;
    }

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

    // drawing in progress
    if (drawingPoints.length > 0) {
      ctx.beginPath();
      drawingPoints.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
      });
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
  }, [slabs, drawingPoints, selectedSlabId, floorPlanOpacity, scalePxPerM, size]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === 'vertices') {
      onAddPoint({ x, y });
    } else if (tool === 'select') {
      const hit = slabs.find(s => pointInPolygon({ x, y }, s.vertices));
      onSelectSlab(hit ? hit.id : null);
    }
  };

  const handleDoubleClick = () => {
    if (tool === 'vertices') onFinishDrawing();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={tool === 'vertices' ? 'block cursor-crosshair' : 'block cursor-pointer'}
      />
      <div className="absolute bottom-2 right-3 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
        Escala: 1 m = {Math.round(scalePxPerM)} px
      </div>
    </div>
  );
}