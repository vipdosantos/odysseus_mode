// Geração do XML NFS-e (padrão ABRASF v2.03) — Lote de RPS sincrono.
// Usado por emitirNFSe. Funções puras + serialização reutilizada de nfeXml.

import { el, serializeXml, canon, onlyDigits, fmtN, fmtDateTime, ufCode, munCode } from "./nfeXml.ts";

export const NFS_NS = "http://www.abrasf.org.br/nfse.xsd";
export const DS_NS = "http://www.w3.org/2000/09/xmldsig#";

function pad(n, w = 2) { return String(n).padStart(w, "0"); }

// Constrói o LoteRps (ABRASF) e devolve a árvore do InfRps (para assinatura).
export function buildLoteRps(nf, { ambiente } = {}) {
  const cnpjEmit = onlyDigits(nf.emitente_cnpj).padStart(14, "0");
  const imEmit = onlyDigits(nf.emitente_im);
  const serie = nf.rps_serie || "A1";
  const numeroRps = parseInt(onlyDigits(nf.rps_numero)) || 1;
  const tipoRps = nf.rps_tipo || "1";
  const dataEmi = fmtDateTime(nf.data_emissao);

  const valorServicos = Number(nf.valor) || 0;
  const deducoes = Number(nf.deducoes) || 0;
  const baseCalc = Math.max(valorServicos - deducoes, 0);
  const aliquota = Number(nf.aliquota_iss) || 0;
  const valorIss = (baseCalc * aliquota) / 100;
  const issRetido = nf.iss_retido ? "1" : "2";

  const tomadorDoc = onlyDigits(nf.cliente_cnpj);
  const isPF = tomadorDoc.length <= 11;

  const infRps = el("InfRps", NFS_NS, { Id: "R1" }, [
    el("IdentificacaoRps", NFS_NS, {}, [
      el("Numero", NFS_NS, {}, [String(numeroRps)]),
      el("Serie", NFS_NS, {}, [serie]),
      el("Tipo", NFS_NS, {}, [tipoRps]),
    ]),
    el("DataEmissao", NFS_NS, {}, [dataEmi]),
    el("NaturezaOperacao", NFS_NS, {}, ["1"]),
    el("RegimeEspecialTributacao", NFS_NS, {}, ["6"]),
    el("OptanteSimplesNacional", NFS_NS, {}, ["2"]),
    el("IncentivadorCultural", NFS_NS, {}, ["2"]),
    el("Status", NFS_NS, {}, ["1"]),
    el("Servico", NFS_NS, {}, [
      el("Valores", NFS_NS, {}, [
        el("ValorServicos", NFS_NS, {}, [fmtN(valorServicos)]),
        el("ValorDeducoes", NFS_NS, {}, [fmtN(deducoes)]),
        el("IssRetido", NFS_NS, {}, [issRetido]),
        el("BaseCalculo", NFS_NS, {}, [fmtN(baseCalc)]),
        el("Aliquota", NFS_NS, {}, [fmtN(aliquota, 4)]),
        el("ValorIss", NFS_NS, {}, [fmtN(valorIss)]),
      ]),
      el("ItemListaServico", NFS_NS, {}, [onlyDigits(nf.item_lista_servico) || "01.01"]),
      ...(onlyDigits(nf.codigo_servico) ? [el("CodigoCnae", NFS_NS, {}, [onlyDigits(nf.codigo_servico)])] : []),
      el("Discriminacao", NFS_NS, {}, [nf.descricao || "Prestacao de servico"]),
      el("CodigoMunicipio", NFS_NS, {}, [pad(munCode(nf.emitente_uf, nf.emitente_municipio), 7)]),
    ]),
    el("Prestador", NFS_NS, {}, [
      el("Cnpj", NFS_NS, {}, [cnpjEmit]),
      ...(imEmit ? [el("InscricaoMunicipal", NFS_NS, {}, [imEmit])] : []),
    ]),
    el("Tomador", NFS_NS, {}, [
      el("IdentificacaoTomador", NFS_NS, {}, [
        el("CpfCnpj", NFS_NS, {}, [
          isPF ? el("Cpf", NFS_NS, {}, [tomadorDoc.padStart(11, "0")]) : el("Cnpj", NFS_NS, {}, [tomadorDoc.padStart(14, "0")]),
        ]),
      ]),
      el("RazaoSocial", NFS_NS, {}, [nf.client_name || ""]),
      el("Endereco", NFS_NS, {}, [
        el("Endereco", NFS_NS, {}, [nf.cliente_endereco || ""]),
        el("Numero", NFS_NS, {}, [nf.cliente_numero || ""]),
        el("Bairro", NFS_NS, {}, [nf.cliente_bairro || ""]),
        el("CodigoMunicipio", NFS_NS, {}, [pad(munCode(nf.cliente_uf, nf.cliente_municipio), 7)]),
        el("Uf", NFS_NS, {}, [nf.cliente_uf || ""]),
        el("Cep", NFS_NS, {}, [onlyDigits(nf.cliente_cep).padStart(8, "0")]),
      ]),
      ...(nf.cliente_email ? [el("Contato", NFS_NS, {}, [
        el("Email", NFS_NS, {}, [nf.cliente_email]),
        ...(onlyDigits(nf.cliente_fone) ? [el("Telefone", NFS_NS, {}, [onlyDigits(nf.cliente_fone)])] : []),
      ])] : []),
    ]),
  ]);

  return { infRps, numeroRps, serie, tipoRps };
}

// Monta o XML completo do LoteRps já com a assinatura inserida no RPS.
export function buildLoteRpsXml(infRpsTree, signatureTree, nf, { ambiente }) {
  const cnpjEmit = onlyDigits(nf.emitente_cnpj).padStart(14, "0");
  const imEmit = onlyDigits(nf.emitente_im);
  const numeroLote = parseInt(onlyDigits(nf.rps_numero)) || 1;

  const rps = el("Rps", NFS_NS, {}, [infRpsTree, signatureTree]);

  const lote = el("LoteRps", NFS_NS, { Id: "L1", versao: "2.03" }, [
    el("NumeroLote", NFS_NS, {}, [String(numeroLote)]),
    el("Cnpj", NFS_NS, {}, [cnpjEmit]),
    ...(imEmit ? [el("InscricaoMunicipal", NFS_NS, {}, [imEmit])] : []),
    el("QuantidadeRps", NFS_NS, {}, ["1"]),
    el("ListaRps", NFS_NS, {}, [rps]),
  ]);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializeXml(lote, null);
}

// Envelope SOAP para RecepcionarLoteRpsSincrono (ABRASF).
export function buildSoapEnvelopeNfse(loteXml) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"',
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    '<soap:Body>',
    '<RecepcionarLoteRpsSincrono xmlns="' + NFS_NS + '">',
    '<xml><![CDATA[' + loteXml + ']]></xml>',
    '</RecepcionarLoteRpsSincrono>',
    '</soap:Body>',
    '</soap:Envelope>',
  ].join("");
}

// Parse do retorno: numero da NFS-e, código de verificação, protocolo ou erros.
export function parseRetornoNfse(xml) {
  const tag = (name) => {
    const re = new RegExp("<(?:[\\w]+:)?" + name + ">([^<]*)</(?:[\\w]+:)?" + name + ">", "g");
    let m, last = null;
    while ((m = re.exec(xml))) last = m[1];
    return last;
  };
  const erros = [];
  const reMsg = /<(?:[\w]+:)?Mensagem(?:[^>]*)>[\s\S]*?<\/(?:[\w]+:)?Mensagem>/g;
  let mm;
  while ((mm = reMsg.exec(xml))) {
    const codigo = tag2(mm[0], "Codigo");
    const msg = tag2(mm[0], "Mensagem");
    if (codigo || msg) erros.push((codigo || "") + (msg ? ": " + msg : ""));
  }
  const fault = xml.match(/<(?:[\w]+:)?Fault>[\s\S]*?<\/(?:[\w]+:)?Fault>/);
  return {
    numero: tag("Numero"),
    codigoVerificacao: tag("CodigoVerificacao"),
    protocolo: tag("Protocolo"),
    erros,
    fault: fault ? (tag2(fault[0], "faultstring") || "Falha SOAP") : null,
  };
}

function tag2(xml, name) {
  const re = new RegExp("<(?:[\\w]+:)?" + name + ">([^<]*)</(?:[\\w]+:)?" + name + ">");
  const m = xml.match(re);
  return m ? m[1] : null;
}