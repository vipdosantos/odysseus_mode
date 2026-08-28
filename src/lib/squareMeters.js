// Cálculo de metros quadrados (m²) para pedidos e orçamentos
// Laje: qtd × metro × 0.425
// Painel: qtd × metro × 0.25
// Laje Treliçada Intereixo: qtd × metro × 0.495
// Valor interno — não exibir para o cliente

export function parseSizeToMeters(size) {
  if (!size) return 0;
  const s = String(size).trim();
  const matches = s.match(/(\d+(?:[.,]\d+)?)/g);
  if (!matches || matches.length === 0) return 0;
  if (s.toLowerCase().includes('x')) {
    return parseFloat(matches[matches.length - 1].replace(',', '.'));
  }
  return parseFloat(matches[0].replace(',', '.'));
}

export function calcSquareMeters(item, tipoLaje) {
  const meters = Number(item.l) || parseSizeToMeters(item.size);
  const qty = Number(item.quantity) || 0;
  if (!meters || !qty) return 0;
  const factor = tipoLaje === 'Painel' ? 0.25 : tipoLaje === 'Laje Treliçada Intereixo' ? 0.495 : 0.425;
  return qty * meters * factor;
}

export function calcTotalSquareMeters(items, tipoLaje) {
  if (!items) return 0;
  return items.reduce((sum, it) => sum + calcSquareMeters(it, tipoLaje), 0);
}

// Placas de preenchimento EPS
// Laje: m² × 2,3
// Painel: m² × 3,9
// Laje Treliçada Intereixo: m² × 1,9
export function calcEpsPlates(item, tipoLaje) {
  const m2 = calcSquareMeters(item, tipoLaje);
  const factor = tipoLaje === 'Painel' ? 3.9 : tipoLaje === 'Laje Treliçada Intereixo' ? 1.9 : 2.3;
  return m2 * factor;
}

export function calcTotalEpsPlates(items, tipoLaje) {
  if (!items) return 0;
  return items.reduce((sum, it) => sum + calcEpsPlates(it, tipoLaje), 0);
}

// Lajotas: m² × 11,5
export function calcLajotas(item, tipoLaje) {
  const m2 = calcSquareMeters(item, tipoLaje);
  return m2 * 11.5;
}

export function calcTotalLajotas(items, tipoLaje) {
  if (!items) return 0;
  return items.reduce((sum, it) => sum + calcLajotas(it, tipoLaje), 0);
}

export function fmtQty(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtM2(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}