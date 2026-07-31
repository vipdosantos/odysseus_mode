export const TRUSS_TYPES = ['H8', 'H12', 'H16', 'H20', 'H25', 'H30'];

export const INTERREIXO_TRUSS_TYPES = ['H16', 'H20', 'H25', 'H30'];

export function getTrussTypesForLaje(tipoLaje) {
  if (tipoLaje === 'Laje Treliçada Interreixo') return INTERREIXO_TRUSS_TYPES;
  return TRUSS_TYPES;
}

export const TRUSS_TYPE_LABEL = (type) => type || '—';

export const FERRO_DIAMETERS = [
  { code: '5.0', label: 'Ø5,0mm' },
  { code: '6.3', label: 'Ø6,3mm' },
  { code: '8.0', label: 'Ø8,0mm' },
  { code: '12.5', label: 'Ø12,5mm' },
];

export const FERRO_LABEL = (code) => FERRO_DIAMETERS.find(f => f.code === code)?.label || code;