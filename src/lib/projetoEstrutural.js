// Cálculos estruturais para lajes treliçadas: peso, aço, concreto e cargas.

// Peso próprio da laje (kN/m²) por tipo de treliça + enchimento
const PESO_PROPRIO = {
  H8:  { EPS: 1.6, Lajota: 2.1, 'EPS+Lajota': 2.3, Nenhum: 1.4 },
  H12: { EPS: 1.8, Lajota: 2.3, 'EPS+Lajota': 2.5, Nenhum: 1.5 },
  H16: { EPS: 2.0, Lajota: 2.5, 'EPS+Lajota': 2.7, Nenhum: 1.6 },
  H20: { EPS: 2.2, Lajota: 2.7, 'EPS+Lajota': 2.9, Nenhum: 1.7 },
  H25: { EPS: 2.5, Lajota: 3.0, 'EPS+Lajota': 3.2, Nenhum: 1.9 },
  H30: { EPS: 2.8, Lajota: 3.3, 'EPS+Lajota': 3.5, Nenhum: 2.1 },
};

// Consumo de aço da treliça (kg/m²) por tipo
const ACO_TRELICA = {
  H8: 2.5, H12: 3.5, H16: 4.5, H20: 6.0, H25: 7.5, H30: 9.0,
};

// Peso unitário de barras de aço (kg/m) por bitola (mm)
const PESO_BARRA = {
  '5.0': 0.154, '6.3': 0.245, '8.0': 0.395, '10.0': 0.617, '12.5': 0.963,
};

// Espessura da capa de concreto (m) por tipo de treliça
const ESPESSURA_CAPA = {
  H8: 0.03, H12: 0.04, H16: 0.05, H20: 0.05, H25: 0.06, H30: 0.07,
};

// Sobrecarga mínima (kN/m²) — NBR 6120
const SOBRECARGA_MIN = 2.0;
// Revestimento (kN/m²)
const REVESTIMENTO = 1.0;

// Calcula o peso próprio de uma laje (kN/m²)
export function pesoProprio(slab) {
  const tt = slab.truss_type || 'H8';
  const ench = slab.tipo_enchimento || 'Nenhum';
  return (PESO_PROPRIO[tt] && PESO_PROPRIO[tt][ench]) || 1.8;
}

// Calcula a carga total (kN/m²) = peso próprio + revestimento + sobrecarga
export function cargaTotal(slab) {
  return pesoProprio(slab) + REVESTIMENTO + SOBRECARGA_MIN;
}

// Calcula a reação de apoio (kN/m) = carga total × vão (maior dimensão perpendicular às vigotas)
export function reacaoApoio(slab, scalePxPerM) {
  if (!slab || slab.negativo || !slab.direction) return 0;
  const v = slab.vertices || [];
  if (v.length < 3) return 0;
  const dx = (slab.direction.x2 || 0) - (slab.direction.x1 || 0);
  const dy = (slab.direction.y2 || 0) - (slab.direction.y1 || 0);
  const len = Math.hypot(dx, dy);
  if (len < 1) return 0;
  const nx = -dy / len, ny = dx / len;
  let min = Infinity, max = -Infinity;
  for (const p of v) {
    const proj = p.x * nx + p.y * ny;
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  const vaoM = (max - min) / (scalePxPerM || 100);
  return cargaTotal(slab) * vaoM;
}

// Calcula o consumo de aço da treliça (kg) para uma laje
export function acoTrelica(slab) {
  if (slab.negativo) return 0;
  const tt = slab.truss_type || 'H8';
  return (ACO_TRELICA[tt] || 3.5) * (slab.area_m2 || 0);
}

// Calcula o peso de barras negativas (kg) a partir das anotações
export function acoNegativos(annotations) {
  return (annotations || [])
    .filter(a => a.type === 'negativo')
    .reduce((total, b) => {
      const bitola = b.bitola || b.diametro || '8.0';
      const pesoUnit = PESO_BARRA[String(bitola)] || 0.395;
      const compTotal = (b.comprimento || 0) * (b.quantidade || 0);
      return total + compTotal * pesoUnit;
    }, 0);
}

// Calcula o volume de concreto da capa (m³) para uma laje
export function volumeConcreto(slab) {
  if (slab.negativo) return 0;
  const tt = slab.truss_type || 'H8';
  const esp = ESPESSURA_CAPA[tt] || 0.04;
  return esp * (slab.area_m2 || 0);
}

// Quantitativo estrutural completo do projeto
export function computeEstrutural(slabs, annotations = [], scalePxPerM = 100) {
  const result = {
    pesoTotal_kN: 0,
    cargaMedia_kN_m2: 0,
    acoTrelica_kg: 0,
    acoNegativos_kg: 0,
    acoTotal_kg: 0,
    concreto_m3: 0,
    reacoes: [],
  };
  if (!slabs || !slabs.length) return result;

  let areaTotal = 0, cargaPonderada = 0;
  for (const s of slabs) {
    if (s.negativo) continue;
    const area = s.area_m2 || 0;
    const peso = pesoProprio(s);
    const carga = cargaTotal(s);
    const reacao = reacaoApoio(s, scalePxPerM);
    const aco = acoTrelica(s);
    const conc = volumeConcreto(s);

    result.pesoTotal_kN += peso * area;
    result.cargaMedia_kN_m2 += carga * area;
    result.acoTrelica_kg += aco;
    result.concreto_m3 += conc;
    areaTotal += area;
    result.reacoes.push({ label: s.label, reacao, carga, vao: null });
  }
  result.acoNegativos_kg = acoNegativos(annotations);
  result.acoTotal_kg = result.acoTrelica_kg + result.acoNegativos_kg;
  result.cargaMedia_kN_m2 = areaTotal > 0 ? result.cargaMedia_kN_m2 / areaTotal : 0;
  return result;
}