// Snapping helpers estilo AutoCAD para o módulo de Projetos

// Calcula o ponto médio entre dois pontos
export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Constrói a lista de candidatos de snap a partir das lajes, pontos em desenho e anotações de linha
export function buildSnapCandidates(slabs, drawingPoints, annotations = []) {
  const pts = [];
  // Vértices das lajes
  (slabs || []).forEach(s => {
    (s.vertices || []).forEach(v => pts.push({ x: v.x, y: v.y, kind: 'endpoint' }));
    // Pontos médios das arestas
    const v = s.vertices || [];
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      pts.push({ ...midpoint(a, b), kind: 'midpoint' });
    }
  });
  // Pontos do desenho em andamento
  (drawingPoints || []).forEach(p => pts.push({ x: p.x, y: p.y, kind: 'endpoint' }));
  // Extremidades das anotações de linha
  (annotations || []).forEach(a => {
    if (a.x1 != null) pts.push({ x: a.x1, y: a.y1, kind: 'endpoint' });
    if (a.x2 != null) pts.push({ x: a.x2, y: a.y2, kind: 'endpoint' });
  });
  return pts;
}

// Snap: encontra o ponto mais próximo dentro do raio (px de tela).
// Considera candidatos explícitos + interseções da grade.
// Retorna o ponto original se nada dentro do raio.
export function snapPoint(p, candidates, gridPx, radius = 10) {
  let best = null;
  let bestD = radius;
  const consider = (c) => {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  };
  candidates.forEach(consider);
  // Grade
  if (gridPx > 0) {
    consider({ x: Math.round(p.x / gridPx) * gridPx, y: Math.round(p.y / gridPx) * gridPx, kind: 'grid' });
  }
  return best || { x: p.x, y: p.y, kind: 'free' };
}

// ORTHO: trava o ponto b em horizontal/vertical relativo a a
export function orthoLock(a, b) {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx >= dy) return { x: b.x, y: a.y };
  return { x: a.x, y: b.y };
}

// Espaçamento padrão entre vigotas (intereixo) em metros
export const VIGOTA_SPACING = 0.45;

// Calcula o número de vigotas (vt) com base na extensão perpendicular do polígono
// à direção informada. direction = { x1, y1, x2, y2 } em px do canvas.
export function computeVt(vertices, direction, scalePxPerM, spacing = VIGOTA_SPACING) {
  if (!vertices || vertices.length < 3 || !direction) return 0;
  const dx = (direction.x2 ?? 0) - (direction.x1 ?? 0);
  const dy = (direction.y2 ?? 0) - (direction.y1 ?? 0);
  const len = Math.hypot(dx, dy);
  if (len < 1) return 0;
  const px = -dy / len, py = dx / len; // vetor perpendicular unitário
  let min = Infinity, max = -Infinity;
  for (const v of vertices) {
    const proj = v.x * px + v.y * py;
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  const spanM = (max - min) / (scalePxPerM || 100);
  return Math.max(1, Math.round(spanM / spacing));
}

// Aplica um comprimento exato (em metros) a partir da âncora, na direção atual do mouse
export function applyLength(anchor, target, meters, scalePxPerM) {
  let dx = target.x - anchor.x;
  let dy = target.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    // Sem direção: usa +x como padrão
    dx = 1; dy = 0;
  } else {
    dx /= len; dy /= len;
  }
  const px = meters * scalePxPerM;
  return { x: anchor.x + dx * px, y: anchor.y + dy * px };
}