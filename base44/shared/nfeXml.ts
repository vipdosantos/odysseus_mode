// Geração do XML NF-e (v4.00) e cálculo da chave de acesso, conforme leiaute SEFAZ.
// Funções puras + serialização canônica (c14n) restrita ao caso da NF-e (namespace
// padrão no ápice, atributos sem prefixo) — suficiente para assinatura XMLDSig.

export const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
export const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
export const VERSAO = "4.00";

const UF_IBGE = { AC:12, AL:16, AP:16, AM:13, BA:29, CE:23, DF:53, ES:32, GO:52, MA:21, MT:51, MS:50, MG:31, PA:15, PB:25, PR:41, PE:26, PI:22, RJ:33, RN:24, RS:43, RO:11, RR:14, SC:42, SE:28, SP:35, TO:17 };

const MUN_IBGE = {
  "SP_SÃO PAULO": 3550308, "SP_SAO PAULO": 3550308, "SP_CAMPINAS": 3509502, "SP_GUARULHOS": 3518800, "SP_OSASCO": 3534401, "SP_SANTOS": 3548500, "SP_SOROCABA": 3552205, "SP_RIBEIRÃO PRETO": 3543402, "SP_SÃO JOSÉ DOS CAMPOS": 3549904,
  "RJ_RIO DE JANEIRO": 3304557, "RJ_NITERÓI": 3303302, "RJ_PETRÓPOLIS": 3303906,
  "MG_BELO HORIZONTE": 3106200, "MG_CONTAGEM": 3118608, "MG_UBERLÂNDIA": 3170206,
  "PR_CURITIBA": 4106902, "PR_LONDRINA": 4113700, "PR_CASCADE": 4104808, "PR_CASCAVEL": 4104808,
  "RS_PORTO ALEGRE": 4314902, "RS_CAXIAS DO SUL": 4305108,
  "PE_RECIFE": 2611606, "BA_SALVADOR": 2927408, "CE_FORTALEZA": 2304400, "DF_BRASÍLIA": 5300108, "DF_BRASILIA": 5300108, "GO_GOIÂNIA": 5208707, "GO_GOIANIA": 5208707,
  "PA_BELÉM": 1501402, "MA_SÃO LUÍS": 2111300, "MT_CUIABÁ": 5103403, "MS_CAMPO GRANDE": 5002704,
  "PB_JOÃO PESSOA": 2507507, "PI_TERESINA": 2211001, "RN_NATAL": 2408102, "AL_MACEIÓ": 2704302,
  "SE_ARACAJU": 2800308, "TO_PALMAS": 1721000, "AM_MANAUS": 1302603, "AP_MACAPÁ": 1600303, "RR_BOA VISTA": 1400100, "RO_PORTO VELHO": 1100205, "AC_RIO BRANCO": 1200401, "ES_VITÓRIA": 3205309, "ES_VILA VELHA": 3205200, "SC_FLORIANÓPOLIS": 4205407, "SC_JOINVILLE": 4209102,
};

export function ufCode(uf) { return UF_IBGE[(uf||"SP").toUpperCase()] || 35; }
export function munCode(uf, nome) {
  if (!nome) return 3550308;
  const key = (uf||"SP").toUpperCase() + "_" + nome.toUpperCase().trim();
  return MUN_IBGE[key] || 3550308;
}

export function onlyDigits(s) { return String(s||"").replace(/\D+/g, ""); }
function pad(n, w=2) { return String(n).padStart(w, "0"); }
export function fmtN(v, dec=2) { return (Number(v)||0).toFixed(dec); }
export function fmtQ(v) { return (Number(v)||0).toFixed(4); }

export function fmtAAMM(d) {
  if (!d) { const n = new Date(); return pad(n.getFullYear()%100) + pad(n.getMonth()+1); }
  const [y, m] = d.split("-");
  return pad(Number(String(y).slice(2))) + pad(Number(m));
}

export function fmtDateTime(d) {
  const now = new Date();
  const sp = new Date(now.getTime() - 3 * 3600 * 1000); // America/Sao_Paulo -03:00
  const hh = pad(sp.getUTCHours()), mi = pad(sp.getUTCMinutes()), ss = pad(sp.getUTCSeconds());
  if (d) { const [yy, mm, dd] = d.split("-"); return `${yy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`; }
  return `${sp.getUTCFullYear()}-${pad(sp.getUTCMonth()+1)}-${pad(sp.getUTCDate())}T${hh}:${mi}:${ss}-03:00`;
}

export function calcDV(chave43) {
  let soma = 0, peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return (resto === 0 || resto === 1) ? 0 : (11 - resto);
}

export function calcChave({ uf, aamm, cnpj, mod, serie, nnf, tpEmiss, cnf }) {
  const cUF = pad(ufCode(uf), 2);
  const cnpj14 = onlyDigits(cnpj).padStart(14, "0").slice(0, 14);
  const modelo = pad(mod || 55, 2);
  const s = pad(serie || 1, 3);
  const n = pad(nnf || 1, 9);
  const tp = String(tpEmiss || 1);
  const c = String(cnf).padStart(8, "0").slice(0, 8);
  const base = cUF + aamm + cnpj14 + modelo + s + n + tp + c;
  return base + String(calcDV(base));
}

export function randomCnf() {
  return String(Math.floor(Math.random() * 99999999)).padStart(8, "0").slice(0, 8);
}

// ── Árvore de elementos + serialização ──
export function el(tag, ns, attrs = {}, kids = []) {
  return { tag, ns, attrs, kids };
}

function escText(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#xD;"); }
function escAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\t/g, "&#x9;").replace(/\n/g, "&#xA;").replace(/\r/g, "&#xD;"); }

// Canonicalização (c14n 1.0) restrita: renderiza o namespace do ápice, atributos
// sem prefixo ordenados por nome. Vale para infNFe e SignedInfo da NF-e.
export function canon(node, { apex = false } = {}) {
  if (typeof node === "string") return escText(node);
  let out = "<" + node.tag;
  if (apex && node.ns) out += ' xmlns="' + escAttr(node.ns) + '"';
  const attrs = Object.entries(node.attrs || {}).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [k, v] of attrs) out += " " + k + '="' + escAttr(v) + '"';
  if (!node.kids || node.kids.length === 0) { out += "/>"; return out; }
  out += ">";
  for (const k of node.kids) out += canon(k, { apex: false });
  out += "</" + node.tag + ">";
  return out;
}

// Serialização XML normal para transmissão (renderiza xmlns quando muda do pai).
export function serializeXml(node, inheritedNs = null) {
  if (typeof node === "string") return escText(node);
  let out = "<" + node.tag;
  if (node.ns && node.ns !== inheritedNs) out += ' xmlns="' + escAttr(node.ns) + '"';
  for (const [k, v] of Object.entries(node.attrs || {})) out += " " + k + '="' + escAttr(v) + '"';
  if (!node.kids || node.kids.length === 0) { out += "/>"; return out; }
  out += ">";
  for (const k of node.kids) out += serializeXml(k, node.ns || inheritedNs);
  out += "</" + node.tag + ">";
  return out;
}

function mapFormaPag(fp) {
  // 0=Vista -> PIX(17), 1=Prazo -> 14, 2=Outros -> 99
  return ({ "0": "17", "1": "14", "2": "99" })[String(fp)] || "99";
}

// Constrói a árvore do infNFe e devolve a chave/cnf gerados.
export function buildInfNFe(nf, { ambiente } = {}) {
  const cnpjEmit = onlyDigits(nf.emitente_cnpj);
  const aamm = fmtAAMM(nf.data_emissao);
  const cnf = randomCnf();
  const serie = 1;
  const nnf = parseInt(onlyDigits(nf.numero)) || 1;
  const chave = calcChave({ uf: nf.emitente_uf, aamm, cnpj: cnpjEmit, mod: 55, serie, nnf, tpEmiss: 1, cnf });
  const cUF = pad(ufCode(nf.emitente_uf), 2);
  const cMunFG = pad(munCode(nf.emitente_uf, nf.emitente_municipio), 7);

  const ide = el("ide", NFE_NS, {}, [
    el("cUF", NFE_NS, {}, [cUF]),
    el("CNF", NFE_NS, {}, [cnf]),
    el("natOp", NFE_NS, {}, [nf.natureza || "Venda de Mercadoria"]),
    el("mod", NFE_NS, {}, ["55"]),
    el("serie", NFE_NS, {}, [pad(serie, 3)]),
    el("nNF", NFE_NS, {}, [pad(nnf, 9)]),
    el("dhEmi", NFE_NS, {}, [fmtDateTime(nf.data_emissao)]),
    el("tpNF", NFE_NS, {}, ["1"]),
    el("idDest", NFE_NS, {}, ["1"]),
    el("cMunFG", NFE_NS, {}, [cMunFG]),
    el("tpImp", NFE_NS, {}, ["1"]),
    el("tpEmis", NFE_NS, {}, ["1"]),
    el("cDV", NFE_NS, {}, [chave.slice(-1)]),
    el("tpAmb", NFE_NS, {}, [String(ambiente || 2)]),
    el("finNFe", NFE_NS, {}, ["1"]),
    el("indFinal", NFE_NS, {}, ["1"]),
    el("indPres", NFE_NS, {}, ["1"]),
    el("procEmi", NFE_NS, {}, ["0"]),
    el("verProc", NFE_NS, {}, ["ModelajesERP-1.0"]),
  ]);

  const emit = el("emit", NFE_NS, {}, [
    el("CNPJ", NFE_NS, {}, [cnpjEmit.padStart(14, "0")]),
    el("xNome", NFE_NS, {}, [nf.emitente_razao || ""]),
    el("enderEmit", NFE_NS, {}, [
      el("xLgr", NFE_NS, {}, [nf.emitente_endereco || ""]),
      el("nro", NFE_NS, {}, [nf.emitente_numero || "S/N"]),
      el("xBairro", NFE_NS, {}, [nf.emitente_bairro || ""]),
      el("cMun", NFE_NS, {}, [cMunFG]),
      el("xMun", NFE_NS, {}, [nf.emitente_municipio || ""]),
      el("UF", NFE_NS, {}, [nf.emitente_uf || "SP"]),
      el("CEP", NFE_NS, {}, [onlyDigits(nf.emitente_cep).padStart(8, "0")]),
      el("fone", NFE_NS, {}, [onlyDigits(nf.emitente_fone).slice(0, 14)]),
    ]),
    el("IE", NFE_NS, {}, [onlyDigits(nf.emitente_ie)]),
    ...(nf.emitente_im ? [el("IM", NFE_NS, {}, [onlyDigits(nf.emitente_im)])] : []),
    el("CRT", NFE_NS, {}, ["3"]),
  ]);

  const destDoc = onlyDigits(nf.cliente_cnpj);
  const isPF = destDoc.length <= 11;
  const dest = el("dest", NFE_NS, {}, [
    isPF ? el("CPF", NFE_NS, {}, [destDoc.padStart(11, "0")]) : el("CNPJ", NFE_NS, {}, [destDoc.padStart(14, "0")]),
    el("xNome", NFE_NS, {}, [nf.client_name || ""]),
    el("enderDest", NFE_NS, {}, [
      el("xLgr", NFE_NS, {}, [nf.cliente_endereco || ""]),
      el("nro", NFE_NS, {}, [nf.cliente_numero || "S/N"]),
      el("xBairro", NFE_NS, {}, [nf.cliente_bairro || ""]),
      el("cMun", NFE_NS, {}, [pad(munCode(nf.cliente_uf, nf.cliente_municipio), 7)]),
      el("xMun", NFE_NS, {}, [nf.cliente_municipio || ""]),
      el("UF", NFE_NS, {}, [nf.cliente_uf || "SP"]),
      el("CEP", NFE_NS, {}, [onlyDigits(nf.cliente_cep).padStart(8, "0")]),
      el("fone", NFE_NS, {}, [onlyDigits(nf.cliente_fone).slice(0, 14)]),
    ]),
    el("indIEDest", NFE_NS, {}, ["9"]),
  ]);

  const detNodes = (nf.itens || []).map((it, idx) => {
    const vProd = Number(it.valor_bruto || ((Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0)));
    const vDesc = Number(it.valor_desconto) || 0;
    const vItem = vProd - vDesc;
    const vBC = Number(it.base_calculo_icms) || vItem;
    const vICMS = Number(it.valor_icms) || 0;
    const pICMS = Number(it.aliquota_icms) || 0;
    const vIPI = Number(it.valor_ipi) || 0;
    const pIPI = Number(it.aliquota_ipi) || 0;
    const cst = it.cst || "00";
    const prod = el("prod", NFE_NS, {}, [
      el("cProd", NFE_NS, {}, [it.codigo || String(idx + 1)]),
      el("cEAN", NFE_NS, {}, ["SEM GTIN"]),
      el("xProd", NFE_NS, {}, [it.descricao || ""]),
      el("NCM", NFE_NS, {}, [onlyDigits(it.ncm).padStart(8, "0")]),
      el("CFOP", NFE_NS, {}, [onlyDigits(it.cfop || nf.cfop)]),
      el("uCom", NFE_NS, {}, [it.unidade || "UN"]),
      el("qCom", NFE_NS, {}, [fmtQ(it.quantidade)]),
      el("vUnCom", NFE_NS, {}, [fmtQ(it.valor_unitario)]),
      el("vProd", NFE_NS, {}, [fmtN(vProd)]),
      el("cEANTrib", NFE_NS, {}, ["SEM GTIN"]),
      el("uTrib", NFE_NS, {}, [it.unidade || "UN"]),
      el("qTrib", NFE_NS, {}, [fmtQ(it.quantidade)]),
      el("vUnTrib", NFE_NS, {}, [fmtQ(it.valor_unitario)]),
      el("vFrete", NFE_NS, {}, [fmtN(it.valor_frete || 0)]),
      el("vDesc", NFE_NS, {}, [fmtN(vDesc)]),
      el("indTot", NFE_NS, {}, ["1"]),
    ]);
    const imposto = el("imposto", NFE_NS, {}, [
      el("ICMS", NFE_NS, {}, [
        el("ICMS" + cst, NFE_NS, {}, [
          el("orig", NFE_NS, {}, ["0"]),
          el("CST", NFE_NS, {}, [cst]),
          el("modBC", NFE_NS, {}, ["3"]),
          el("vBC", NFE_NS, {}, [fmtN(vBC)]),
          el("pICMS", NFE_NS, {}, [fmtN(pICMS, 4)]),
          el("vICMS", NFE_NS, {}, [fmtN(vICMS)]),
        ]),
      ]),
      ...((Number(it.aliquota_ipi) || 0) > 0 ? [el("IPI", NFE_NS, {}, [
        el("cEnq", NFE_NS, {}, ["999"]),
        el("IPITrib", NFE_NS, {}, [
          el("CST", NFE_NS, {}, ["50"]),
          el("vBC", NFE_NS, {}, [fmtN(vItem)]),
          el("pIPI", NFE_NS, {}, [fmtN(pIPI, 4)]),
          el("vIPI", NFE_NS, {}, [fmtN(vIPI)]),
        ]),
      ])] : [el("IPI", NFE_NS, {}, [
        el("cEnq", NFE_NS, {}, ["999"]),
        el("IPINT", NFE_NS, {}, [el("CST", NFE_NS, {}, ["53"])]),
      ])]),
      el("PIS", NFE_NS, {}, [
        el("PISNT", NFE_NS, {}, [el("CST", NFE_NS, {}, ["04"])]),
      ]),
      el("COFINS", NFE_NS, {}, [
        el("COFINSNT", NFE_NS, {}, [el("CST", NFE_NS, {}, ["04"])]),
      ]),
    ]);
    return el("det", NFE_NS, { nItem: String(idx + 1) }, [prod, imposto]);
  });

  const total = el("total", NFE_NS, {}, [
    el("ICMSTot", NFE_NS, {}, [
      el("vBC", NFE_NS, {}, [fmtN(nf.base_calculo_icms)]),
      el("vICMS", NFE_NS, {}, [fmtN(nf.valor_icms)]),
      el("vICMSDeson", NFE_NS, {}, [fmtN(0)]),
      el("vFCP", NFE_NS, {}, [fmtN(0)]),
      el("vProd", NFE_NS, {}, [fmtN(nf.valor_produtos)]),
      el("vFrete", NFE_NS, {}, [fmtN(nf.valor_frete)]),
      el("vSeg", NFE_NS, {}, [fmtN(nf.valor_seguro)]),
      el("vDesc", NFE_NS, {}, [fmtN(nf.valor_desconto)]),
      el("vII", NFE_NS, {}, [fmtN(0)]),
      el("vIPI", NFE_NS, {}, [fmtN(nf.valor_ipi)]),
      el("vIPIDevol", NFE_NS, {}, [fmtN(0)]),
      el("vPIS", NFE_NS, {}, [fmtN(0)]),
      el("vCOFINS", NFE_NS, {}, [fmtN(0)]),
      el("vOutro", NFE_NS, {}, [fmtN(nf.outras_despesas)]),
      el("vNF", NFE_NS, {}, [fmtN(nf.valor_total_nfe)]),
      el("vTotTrib", NFE_NS, {}, [fmtN(0)]),
    ]),
  ]);

  const transpKids = [el("modFrete", NFE_NS, {}, [nf.modalidade_frete || "0"])];
  if (nf.transportadora_nome) {
    transpKids.push(el("transporta", NFE_NS, {}, [
      ...(nf.transportadora_cnpj ? [el("CNPJ", NFE_NS, {}, [onlyDigits(nf.transportadora_cnpj).padStart(14, "0")])] : []),
      el("xNome", NFE_NS, {}, [nf.transportadora_nome]),
      el("IE", NFE_NS, {}, [onlyDigits(nf.transportadora_ie)]),
      el("xEnder", NFE_NS, {}, [nf.transportadora_endereco || ""]),
      el("xMun", NFE_NS, {}, [nf.transportadora_municipio || ""]),
      el("UF", NFE_NS, {}, [nf.transportadora_uf || ""]),
    ]));
  }
  if (nf.qtde_volumes) {
    transpKids.push(el("vol", NFE_NS, {}, [
      el("qVol", NFE_NS, {}, [String(Math.round(nf.qtde_volumes))]),
      el("esp", NFE_NS, {}, [nf.especie || ""]),
      el("pesoL", NFE_NS, {}, [fmtN(nf.peso_liquido, 3)]),
      el("pesoB", NFE_NS, {}, [fmtN(nf.peso_bruto, 3)]),
    ]));
  }
  const transp = el("transp", NFE_NS, {}, transpKids);

  const pag = el("pag", NFE_NS, {}, [
    el("detPag", NFE_NS, {}, [
      el("tPag", NFE_NS, {}, [mapFormaPag(nf.forma_pagamento)]),
      el("vPag", NFE_NS, {}, [fmtN(nf.valor_total_nfe)]),
    ]),
  ]);

  const kids = [ide, emit, dest, ...detNodes, total, transp, pag];
  if (nf.observacoes) kids.push(el("infAdic", NFE_NS, {}, [el("infCpl", NFE_NS, {}, [nf.observacoes])]));

  const infNFe = el("infNFe", NFE_NS, { Id: "NFe" + chave, versao: VERSAO }, kids);
  return { infNFe, chave, cnf, serie, nnf };
}

export function buildNFeDocument(infNFeTree, signatureTree) {
  const nfe = el("NFe", NFE_NS, {}, [infNFeTree, signatureTree]);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializeXml(nfe, null);
}

// Validação prévia dos dados mínimos exigidos pelo leiaute SEFAZ antes de
// assinar/transmitir. Devolve lista de mensagens de erro (vazia = OK).
export function validateNFe(nf) {
  const errs = [];
  if (!onlyDigits(nf.emitente_cnpj)) errs.push("CNPJ do emitente é obrigatório");
  if (!onlyDigits(nf.emitente_ie)) errs.push("Inscrição Estadual (IE) do emitente é obrigatória");
  if (!nf.emitente_razao) errs.push("Razão social do emitente é obrigatória");
  if (!nf.emitente_uf) errs.push("UF do emitente é obrigatória");
  if (!nf.emitente_municipio) errs.push("Município do emitente é obrigatório");
  if (!onlyDigits(nf.emitente_cep)) errs.push("CEP do emitente é obrigatório");
  if (!onlyDigits(nf.cliente_cnpj)) errs.push("CPF/CNPJ do destinatário é obrigatório");
  if (!nf.client_name) errs.push("Nome do destinatário é obrigatório");
  if (!nf.cliente_uf) errs.push("UF do destinatário é obrigatório");
  if (!nf.cliente_municipio) errs.push("Município do destinatário é obrigatório");
  if (!onlyDigits(nf.cliente_cep)) errs.push("CEP do destinatário é obrigatório");
  if (!(nf.itens || []).length) errs.push("A NF-e deve ter pelo menos um item");
  (nf.itens || []).forEach((it, i) => {
    if (!onlyDigits(it.ncm)) errs.push(`Item ${i + 1}: NCM é obrigatório`);
    if (!(Number(it.quantidade) > 0)) errs.push(`Item ${i + 1}: quantidade deve ser maior que zero`);
    if (!(Number(it.valor_unitario) > 0)) errs.push(`Item ${i + 1}: valor unitário deve ser maior que zero`);
    if (!it.descricao) errs.push(`Item ${i + 1}: descrição é obrigatória`);
  });
  return errs;
}

// Recálculo server-side dos totais da NF-e — garante que ICMS/IPI/vNF estejam
// corretos no XML final mesmo se os valores salvos estiverem desatualizados.
export function recalcTotaisNFe(nf) {
  const itens = (nf.itens || []).map((it) => {
    const q = Number(it.quantidade) || 0;
    const vu = Number(it.valor_unitario) || 0;
    const vDesc = Number(it.valor_desconto) || 0;
    const vFrete = Number(it.valor_frete) || 0;
    const vBruto = q * vu;
    const vItem = vBruto - vDesc;
    const aIcms = Number(it.aliquota_icms) || 0;
    const baseIcms = vItem + vFrete;
    const vIcms = (baseIcms * aIcms) / 100;
    const aIpi = Number(it.aliquota_ipi) || 0;
    const vIpi = (vItem * aIpi) / 100;
    return { ...it, valor_bruto: vBruto, valor_item: vItem, base_calculo_icms: baseIcms, aliquota_icms: aIcms, valor_icms: vIcms, aliquota_ipi: aIpi, valor_ipi: vIpi };
  });
  const vProd = itens.reduce((s, i) => s + i.valor_bruto, 0);
  const vDesc = itens.reduce((s, i) => s + (Number(i.valor_desconto) || 0), 0);
  const vFrete = Number(nf.valor_frete) || 0;
  const vSeg = Number(nf.valor_seguro) || 0;
  const vOut = Number(nf.outras_despesas) || 0;
  const baseIcms = itens.reduce((s, i) => s + i.base_calculo_icms, 0);
  const vIcms = itens.reduce((s, i) => s + i.valor_icms, 0);
  const vIpi = itens.reduce((s, i) => s + i.valor_ipi, 0);
  const vTotal = vProd - vDesc + vFrete + vSeg + vOut + vIpi;
  return {
    ...nf,
    itens,
    valor_produtos: vProd,
    valor_desconto: vDesc,
    valor_frete: vFrete,
    valor_seguro: vSeg,
    outras_despesas: vOut,
    base_calculo_icms: baseIcms,
    valor_icms: vIcms,
    valor_ipi: vIpi,
    valor_total_nfe: vTotal,
    valor: vTotal,
  };
}