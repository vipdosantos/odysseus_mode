// Utilitário para buscar a dimensão de enchimento (EPS/Lajota) por tipo de laje + treliça

export function lookupEpsDimension(tipoLaje, trussType, tipoEnchimento, dimensions) {
  if (!tipoEnchimento || tipoEnchimento === 'Nenhum') return '';
  if (!dimensions || !dimensions.length) return '';
  // Mista: EPS usa dimensões de Laje Treliçada; Lajota usa dimensões próprias da Mista
  const lookupLaje = (tipoLaje === 'Mista' && tipoEnchimento === 'EPS') ? 'Laje' : tipoLaje;
  const match = dimensions.find(
    d => d.tipo_laje === lookupLaje &&
         d.truss_type === trussType &&
         d.tipo_enchimento === tipoEnchimento &&
         d.active !== false
  );
  return match?.dimension || '';
}