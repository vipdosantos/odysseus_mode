// Central permission system: what each user can SEE and EDIT per screen.
// Levels: 'oculto' (hidden + blocked) | 'ver' (view only) | 'editar' (full).

export const ACCESS_OCULTO = 'oculto';
export const ACCESS_VER = 'ver';
export const ACCESS_EDITAR = 'editar';

export const SCREENS = [
  { path: '/', label: 'Dashboard' },
  { path: '/pedidos', label: 'Pedidos' },
  { path: '/ordem-pedido', label: 'Ordem de Compras' },
  { path: '/aprovacoes', label: 'Aprovação de Ordens' },
  { path: '/estoque', label: 'Controle de Estoque' },
  { path: '/sobra-trelica', label: 'Sobra de Treliça' },
  { path: '/producao', label: 'Produção' },
  { path: '/scanner', label: 'Scanner QR' },
  { path: '/motorista', label: 'Entregas' },
  { path: '/financeiro', label: 'Contas a Pagar' },
  { path: '/receber', label: 'Contas a Receber' },
  { path: '/contas-bancarias', label: 'Contas Bancárias' },
  { path: '/notas-fiscais', label: 'Notas Fiscais' },
  { path: '/relatorio-fiscal', label: 'Relatório Fiscal' },
  { path: '/calendario', label: 'Calendário' },
  { path: '/insumos', label: 'Insumos' },
  { path: '/patrimonio', label: 'Patrimônio' },
  { path: '/produtividade', label: 'Produtividade' },
  { path: '/cadastros', label: 'Cadastros' },
  { path: '/api-config', label: 'Integração API' },
  { path: '/projetos', label: 'Projetos' },
  { path: '/orcamentos', label: 'Orçamentos' },
  { path: '/usuarios', label: 'Usuários' },
];

// Default access per role. Screens not listed default to 'oculto'.
const ROLE_DEFAULTS = {
  admin: Object.fromEntries(SCREENS.map(s => [s.path, ACCESS_EDITAR])),
  operador: {
    '/': ACCESS_VER,
    '/pedidos': ACCESS_EDITAR,
    '/orcamentos': ACCESS_EDITAR,
    '/projetos': ACCESS_EDITAR,
    '/aprovacoes': ACCESS_VER,
    '/estoque': ACCESS_EDITAR,
    '/sobra-trelica': ACCESS_EDITAR,
    '/producao': ACCESS_EDITAR,
    '/scanner': ACCESS_EDITAR,
    '/calendario': ACCESS_VER,
    '/insumos': ACCESS_EDITAR,
    '/produtividade': ACCESS_EDITAR,
    '/cadastros': ACCESS_EDITAR,
  },
  financeiro: {
    '/': ACCESS_VER,
    '/pedidos': ACCESS_VER,
    '/orcamentos': ACCESS_EDITAR,
    '/ordem-pedido': ACCESS_EDITAR,
    '/aprovacoes': ACCESS_EDITAR,
    '/financeiro': ACCESS_EDITAR,
    '/receber': ACCESS_EDITAR,
    '/contas-bancarias': ACCESS_EDITAR,
    '/notas-fiscais': ACCESS_EDITAR,
    '/relatorio-fiscal': ACCESS_EDITAR,
  },
  vendedor: {
    '/': ACCESS_VER,
    '/pedidos': ACCESS_EDITAR,
    '/orcamentos': ACCESS_EDITAR,
    '/projetos': ACCESS_EDITAR,
  },
  visualizador: {
    '/': ACCESS_VER,
    '/pedidos': ACCESS_VER,
    '/orcamentos': ACCESS_VER,
    '/projetos': ACCESS_VER,
    '/calendario': ACCESS_VER,
  },
  motorista: {
    '/': ACCESS_VER,
    '/pedidos': ACCESS_VER,
    '/calendario': ACCESS_EDITAR,
    '/scanner': ACCESS_VER,
    '/motorista': ACCESS_VER,
  },
  encarregado: {
    '/': ACCESS_VER,
    '/pedidos': ACCESS_EDITAR,
    '/orcamentos': ACCESS_EDITAR,
    '/projetos': ACCESS_EDITAR,
    '/aprovacoes': ACCESS_VER,
    '/estoque': ACCESS_EDITAR,
    '/sobra-trelica': ACCESS_EDITAR,
    '/producao': ACCESS_EDITAR,
    '/scanner': ACCESS_EDITAR,
    '/calendario': ACCESS_EDITAR,
    '/insumos': ACCESS_EDITAR,
    '/produtividade': ACCESS_EDITAR,
    '/patrimonio': ACCESS_VER,
    '/cadastros': ACCESS_EDITAR,
    '/motorista': ACCESS_VER,
  },
};

// Resolves the effective access level for a user on a screen.
// Admin => always 'editar'. Explicit per-user override wins; else role default.
export function getAccessLevel(user, path) {
  if (!user) return ACCESS_OCULTO;
  if (user.role === 'admin') return ACCESS_EDITAR;
  const override = user.permissions && user.permissions[path];
  if (override) return override;
  const roleDefaults = ROLE_DEFAULTS[user.role] || {};
  return roleDefaults[path] || ACCESS_OCULTO;
}

export function canView(user, path) {
  return getAccessLevel(user, path) !== ACCESS_OCULTO;
}

export function canEdit(user, path) {
  return getAccessLevel(user, path) === ACCESS_EDITAR;
}

// Builds a full permissions object from a role's defaults (used to prefill the matrix).
export function buildDefaultPermissions(role) {
  const perms = {};
  const defaults = ROLE_DEFAULTS[role] || {};
  for (const s of SCREENS) {
    perms[s.path] = defaults[s.path] || ACCESS_OCULTO;
  }
  return perms;
}