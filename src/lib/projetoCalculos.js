// Cálculos do módulo de Projetos: vigotas automáticas, plano de escoras e quantitativo de materiais.

// Espaçamento entre vigotas (intereixo) por tipo de treliça — em metros
export const INTEREIXO = { H8: 0.42, H12: 0.42, H16: 0.42, H20: 0.42, H25: 0.45, H30: 0.50 };

export function slabCentroid(slab) {
  const v = (slab && slab.vertices) || [];
  if (!v.length) return { x: 0, y: 0 };
  return { x: v.reduce((a, p) => a + p.x, 0) / v.length, y: v.reduce((a, p) => a + p.y, 0) / v.length };
}

// Distribui as vigotas dentro do pano conforme a direção e o intereixo do tipo de treliça.
// Retorna quantidade (vt), comprimento de cada vigota (m), total linear (m) e as linhas no canvas.
export function computeVigotas(slab, scalePxPerM) {
  const zero = { vt: 0, lengthM: 0, totalLinearM: 0, lines: [], intereixoM: 0 };
  if (!slab || slab.negativo) return zero;
  const dir = slab.direction;
  const v = slab.vertices || [];
  if (!dir || v.length < 3) return zero;
  const dx = (dir.x2 || 0) - (dir.x1 || 0);
  const dy = (dir.y2 || 0) - (dir.y1 || 0);
  const len = Math.hypot(dx, dy);
  if (len < 1) return zero;
  const ux = dx / len, uy = dy / len;   // direção das vigotas
  const nx = -uy, ny = ux;              // perpendicular (largura do pano)
  const c = slabCentroid(slab);
  let minP = Infinity, maxP = -Infinity, minU = Infinity, maxU = -Infinity;
  for (const p of v) {
    const pp = (p.x - c.x) * nx + (p.y - c.y) * ny;
    const uu = (p.x - c.x) * ux + (p.y - c.y) * uy;
    if (pp < minP) minP = pp; if (pp > maxP) maxP = pp;
    if (uu < minU) minU = uu; if (uu > maxU) maxU = uu;
  }
  const tt = slab.truss_type || 'H8';
  const intereixoM = INTEREIXO[tt] || 0.42;
  const espPx = intereixoM * (scalePxPerM || 100);
  const spanPx = maxP - minP;
  const vt = Math.max(1, Math.round(spanPx / espPx));
  const lengthM = (maxU - minU) / (scalePxPerM || 100);
  const start = minP + (spanPx - (vt - 1) * espPx) / 2;
  const lines = [];
  for (let i = 0; i < vt; i++) {
    const pp = start + i * espPx;
    lines.push({
      x1: c.x + nx * pp + ux * minU, y1: c.y + ny * pp + uy * minU,
      x2: c.x + nx * pp + ux * maxU, y2: c.y + ny * pp + uy * maxU,
    });
  }
  return { vt, lengthM, totalLinearM: vt * lengthM, lines, intereixoM };
}

// Gera o plano de escoramento: linhas perpendiculares às vigotas, espaçadas conforme config,
// com pontaletes distribuídos ao longo de cada linha.
export function computeEscoras(slab, scalePxPerM, cfg = {}) {
  const zero = { linhas: 0, pontaletes: 0, lines: [], props: [] };
  if (!slab || slab.negativo) return zero;
  const dir = slab.direction;
  const v = slab.vertices || [];
  if (!dir || v.length < 3) return zero;
  const dx = (dir.x2 || 0) - (dir.x1 || 0);
  const dy = (dir.y2 || 0) - (dir.y1 || 0);
  const len = Math.hypot(dx, dy);
  if (len < 1) return zero;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const c = slabCentroid(slab);
  let minP = Infinity, maxP = -Infinity, minU = Infinity, maxU = -Infinity;
  for (const p of v) {
    const pp = (p.x - c.x) * nx + (p.y - c.y) * ny;
    const uu = (p.x - c.x) * ux + (p.y - c.y) * uy;
    if (pp < minP) minP = pp; if (pp > maxP) maxP = pp;
    if (uu < minU) minU = uu; if (uu > maxU) maxU = uu;
  }
  const scale = scalePxPerM || 100;
  const escPx = (cfg.escoraEspacamentoM || 1) * scale;
  const pontPx = (cfg.pontaleteEspacamentoM || 1) * scale;
  const spanU = maxU - minU, spanP = maxP - minP;
  const nLines = Math.max(1, Math.round(spanU / escPx));
  const uStep = spanU / nLines;
  const nProps = Math.max(1, Math.round(spanP / pontPx));
  const pStep = spanP / nProps;
  const lines = [], props = [];
  for (let i = 0; i <= nLines; i++) {
    const u = minU + uStep * i;
    const x1 = c.x + ux * u + nx * minP, y1 = c.y + uy * u + ny * minP;
    const x2 = c.x + ux * u + nx * maxP, y2 = c.y + uy * u + ny * maxP;
    lines.push({ x1, y1, x2, y2 });
    for (let j = 0; j <= nProps; j++) {
      const pp = minP + pStep * j;
      props.push({ x: c.x + ux * u + nx * pp, y: c.y + uy * u + ny * pp });
    }
  }
  return { linhas: lines.length, pontaletes: props.length, lines, props };
}

// Quantitativo geral de materiais do projeto.
export function computeQuantitativo(slabs, scalePxPerM, epsDimensions = [], escoraCfg = {}) {
  const totals = { area: 0, vigotasUn: 0, vigotasM: 0, epsUn: 0, escorasUn: 0, escorasLinhas: 0 };
  if (!slabs) return totals;
  for (const s of slabs) {
    if (s.negativo) continue;
    totals.area += s.area_m2 || 0;
    const vig = computeVigotas(s, scalePxPerM);
    totals.vigotasUn += vig.vt;
    totals.vigotasM += vig.totalLinearM;
    if (s.tipo_enchimento && s.tipo_enchimento !== 'Nenhum') {
      let epsLenM = 1.0;
      const dim = (epsDimensions || []).find(
        (d) => d.active !== false && d.tipo_laje === s.tipo_laje && d.truss_type === s.truss_type && d.tipo_enchimento === s.tipo_enchimento
      );
      if (dim && dim.dimension) {
        const cm = parseFloat(String(dim.dimension).split('x')[0]);
        if (!isNaN(cm) && cm > 0) epsLenM = cm / 100;
      }
      const along = Math.max(1, Math.floor((vig.lengthM || 0) / epsLenM));
      totals.epsUn += Math.max(0, vig.vt - 1) * along;
    }
    const esc = computeEscoras(s, scalePxPerM, escoraCfg);
    totals.escorasUn += esc.pontaletes;
    totals.escorasLinhas += esc.linhas;
  }
  return totals;
}