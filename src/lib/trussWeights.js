// Tabela de pesos de referência para cálculo de carga de entrega.
// Todos os valores são editáveis pelo admin na tela do Motorista e
// persistidos em EmpresaConfig (tipo: "pesos_carga").

export const DEFAULT_WEIGHTS = {
  // Peso da estrutura de treliça por tipo (kg por painel)
  trelica: {
    H8: 30,
    H12: 45,
    H16: 65,
    H20: 90,
    H25: 120,
    H30: 160,
  },
  // Tijolo por painel (kg)
  tijolo: 25,
  // Tela por painel (kg)
  telas: 12,
  // Peso extra por ferro adicional, por diâmetro (kg por unidade)
  ferro: {
    '5.0': 0.12,
    '6.3': 0.25,
    '8.0': 0.4,
    '12.5': 1.0,
  },
};

export function mergeWeights(stored) {
  if (!stored) return DEFAULT_WEIGHTS;
  try {
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return {
      trelica: { ...DEFAULT_WEIGHTS.trelica, ...(parsed.trelica || {}) },
      tijolo: Number(parsed.tijolo ?? DEFAULT_WEIGHTS.tijolo),
      telas: Number(parsed.telas ?? DEFAULT_WEIGHTS.telas),
      ferro: { ...DEFAULT_WEIGHTS.ferro, ...(parsed.ferro || {}) },
    };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

// Peso unitário (por painel) de um item do pedido.
export function itemUnitWeight(item, weights) {
  const w = weights || DEFAULT_WEIGHTS;
  const base = w.trelica[item.truss_type] ?? 0;
  const tijolo = w.tijolo || 0;
  const telas = w.telas || 0;
  const extras = (item.adicionais || []).reduce(
    (acc, a) => acc + (a.quantity || 0) * (w.ferro[a.diametro] ?? 0),
    0
  );
  return base + tijolo + telas + extras;
}

// Lista de "linhas de carga" com peso por unidade e peso total.
export function buildCargo(order, weights) {
  const w = weights || DEFAULT_WEIGHTS;
  return (order.items || []).map((item, idx) => {
    const unit = itemUnitWeight(item, w);
    const qty = Number(item.quantity || 0);
    return {
      idx,
      truss_type: item.truss_type || '—',
      size: item.size || '',
      quantity: qty,
      unitWeight: unit,
      totalWeight: unit * qty,
    };
  });
}

export function orderTotalWeight(order, weights) {
  return buildCargo(order, weights).reduce((acc, c) => acc + c.totalWeight, 0);
}

// Distribui a carga entre caminhões respeitando a capacidade de cada um.
// trucks: [{ name, code, capacity_kg }] — o primeiro é o principal do pedido.
export function distributeCargo(cargo, trucks) {
  if (!trucks.length || !cargo.length) return [];
  const sorted = [...trucks].sort((a, b) => {
    const capA = Number(a.capacity_kg) || 0;
    const capB = Number(b.capacity_kg) || 0;
    return capB - capA;
  });
  const loads = [{ truck: sorted[0], items: [], weight: 0 }];
  let tIdx = 0;

  for (const line of cargo) {
    let qtyLeft = line.quantity;
    let guard = 0;
    while (qtyLeft > 0 && guard < 1000) {
      guard++;
      const current = loads[tIdx];
      const cap = Number(current.truck.capacity_kg) || 0;
      const avail = cap - current.weight;
      const fits = cap > 0 ? Math.floor(avail / line.unitWeight) : qtyLeft;

      if (fits >= 1) {
        const take = Math.min(qtyLeft, fits);
        current.items.push({ ...line, quantity: take, totalWeight: take * line.unitWeight });
        current.weight += take * line.unitWeight;
        qtyLeft -= take;
      } else if (line.unitWeight >= cap && cap > 0) {
        // painel mais pesado que a capacidade — carrega 1 com aviso de sobrecarga
        current.items.push({ ...line, quantity: 1, totalWeight: line.unitWeight, overload: true });
        current.weight += line.unitWeight;
        qtyLeft -= 1;
      } else if (tIdx + 1 < sorted.length) {
        tIdx++;
        loads.push({ truck: sorted[tIdx], items: [], weight: 0 });
      } else {
        // sem mais caminhões — sobrecarrega o atual com o restante
        current.items.push({ ...line, quantity: qtyLeft, totalWeight: qtyLeft * line.unitWeight, overload: true });
        current.weight += qtyLeft * line.unitWeight;
        qtyLeft = 0;
      }
    }
  }
  return loads;
}