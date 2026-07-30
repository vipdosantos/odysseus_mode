export const TRUSS_TYPES = ['H8', 'H12', 'H16', 'H20', 'H25', 'H30'];

export const TRUSS_TYPE_LABEL = (type) => type || '—';

export const FERRO_DIAMETERS = [
  { code: '5.0', label: 'Ø5,0mm' },
  { code: '6.3', label: 'Ø6,3mm' },
  { code: '8.0', label: 'Ø8,0mm' },
  { code: '12.5', label: 'Ø12,5mm' },
];

export const FERRO_LABEL = (code) => FERRO_DIAMETERS.find(f => f.code === code)?.label || code;

// Dimensões de painel EPS por tipo de laje e tipo de treliça
export const EPS_DIMENSIONS = {
  'Treliçada': { H8: '1000x330x070', H12: '1000x330x100', H16: '1000x330x140', H20: '1000x330x180' },
  'Painel':    { H8: '1000x150x040', H12: '1000x150x070', H16: '1000x150x120', H20: '1000x150x160' },
};

export const getEpsSize = (tipoLaje, trussType) => EPS_DIMENSIONS[tipoLaje]?.[trussType] || '';