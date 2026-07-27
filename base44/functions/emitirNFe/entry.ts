// Transmissão direta de NF-e (modelo 55, v4.00) à SEFAZ via SOAP.
// Reusa o pipeline compartilhado (validação + recálculo + geração + assinatura)
// e envia ao webservice NfeAutorizacao (indSinc=1), gravando chave/protocolo.
// A autenticação perante a SEFAZ é dada pela assinatura XMLDSig do infNFe.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { ufCode } from "../../shared/nfeXml.ts";
import { loadCertificado, prepareSignedNFe } from "../../shared/nfePipeline.ts";

const SOAP_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao/nfeAutorizacaoLote";

const ENDPOINTS = {
  SP: {
    1: "https://nfe.fazenda.sp.gov.br/nfeweb/services/NfeAutorizacao",
    2: "https://homologacao.nfe.fazenda.sp.gov.br/nfeweb/services/NfeAutorizacao",
  },
  SVRS: {
    1: "https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
    2: "https://homologacao.nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
  },
  SVAN: {
    1: "https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx",
    2: "https://homologacao.nfe.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx",
  },
};

// Roteamento por UF: SP usa webservice próprio; GO/MG/MS/MT usam SVAN
// (Sefaz Virtual Ambiente Nacional); demais UFs usam SVRS (Sefaz Virtual RS).
function endpointFor(uf, ambiente) {
  const u = (uf || "SP").toUpperCase();
  if (u === "SP") return ENDPOINTS.SP[ambiente] || ENDPOINTS.SP[2];
  if (["GO", "MG", "MS", "MT"].includes(u)) return ENDPOINTS.SVAN[ambiente] || ENDPOINTS.SVAN[2];
  return ENDPOINTS.SVRS[ambiente] || ENDPOINTS.SVRS[2];
}

// Pega a última ocorrência de uma tag (sem prefixo de namespace) — assim
// priorizamos o cStat dentro de infProt (autorização) sobre o do lote.
function tag(xml, name) {
  const re = new RegExp("<(?:[\\w]+:)?" + name + ">([^<]*)</(?:[\\w]+:)?" + name + ">", "g");
  let m, last = null;
  while ((m = re.exec(xml))) last = m[1];
  return last;
}

function parseRetorno(xml) {
  const protMatch = xml.match(/<(?:[\w]+:)?protNFe>[\s\S]*?<\/(?:[\w]+:)?protNFe>/);
  const prot = protMatch ? protMatch[0] : "";
  const fault = xml.match(/<(?:[\w]+:)?Fault>[\s\S]*?<\/(?:[\w]+:)?Fault>/);
  return {
    cStat: tag(prot, "cStat") || tag(xml, "cStat"),
    xMotivo: tag(prot, "xMotivo") || tag(xml, "xMotivo"),
    chNFe: tag(prot, "chNFe") || tag(xml, "chNFe"),
    nProt: tag(prot, "nProt") || tag(xml, "nProt"),
    dhRecbto: tag(prot, "dhRecbto"),
    faultText: fault ? (tag(fault[0], "faultstring") || tag(fault[0], "Reason") || tag(fault[0], "Text") || "Falha SOAP") : null,
  };
}

function buildSoapEnvelope(cUF, signedXml) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">',
    '<soap12:Header>',
    '<nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao">',
    '<cUF>' + cUF + '</cUF>',
    '<versaoDados>4.00</versaoDados>',
    '</nfeCabecMsg>',
    '</soap12:Header>',
    '<soap12:Body>',
    '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao">',
    '<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">',
    '<idLote>1</idLote>',
    '<indSinc>1</indSinc>',
    signedXml,
    '</enviNFe>',
    '</nfeDadosMsg>',
    '</soap12:Body>',
    '</soap12:Envelope>',
  ].join("");
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Apenas administradores podem emitir NF-e" }, { status: 403 });

    const body = await req.json();
    const fiscalNoteId = body?.fiscalNoteId;
    const ambiente = Number(body?.ambiente) === 1 ? 1 : 2;
    if (!fiscalNoteId) return Response.json({ error: "fiscalNoteId é obrigatório" }, { status: 400 });

    const nf = await base44.entities.FiscalNote.get(fiscalNoteId);
    if (!nf) return Response.json({ error: "Nota fiscal não encontrada" }, { status: 404 });
    if (nf.tipo !== "nfe") return Response.json({ error: "Transmissão SEFAZ disponível apenas para NF-e (Produto)" }, { status: 400 });

    const cert = await loadCertificado(base44);
    const { signedXml } = await prepareSignedNFe(nf, cert, { ambiente });

    const uf = (nf.emitente_uf || "SP").toUpperCase();
    const cUF = String(ufCode(uf)).padStart(2, "0");
    const endpoint = endpointFor(uf, ambiente);
    const soap = buildSoapEnvelope(cUF, signedXml);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": 'application/soap+xml; charset=utf-8; action="' + SOAP_ACTION + '"',
        "Accept": "text/xml",
      },
      body: soap,
    });
    const respXml = await resp.text();

    const { cStat, xMotivo, chNFe, nProt, dhRecbto, faultText } = parseRetorno(respXml);

    if (faultText) {
      return Response.json({ error: "Falha SOAP da SEFAZ: " + faultText, xmlRetorno: respXml.slice(0, 4000) }, { status: 502 });
    }
    if (!cStat) {
      return Response.json({ error: "Resposta SEFAZ sem código de status (HTTP " + resp.status + ")", xmlRetorno: respXml.slice(0, 4000) }, { status: 502 });
    }

    const autorizada = cStat === "100" || cStat === "150";
    const update = {
      chave_acesso: chNFe || nf.chave_acesso,
      protocolo: nProt || nf.protocolo,
      status: autorizada ? "emitida" : (nf.status === "emitida" ? "emitida" : "rascunho"),
    };
    if (autorizada && dhRecbto) update.data_emissao = dhRecbto.slice(0, 10);
    await base44.entities.FiscalNote.update(fiscalNoteId, update);

    return Response.json({
      ok: autorizada,
      cStat, xMotivo, chave: chNFe, protocolo: nProt,
      ambiente,
      detalhe: autorizada ? "NF-e autorizada de uso pela SEFAZ" : "Transmissão concluída — verifique xMotivo",
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}