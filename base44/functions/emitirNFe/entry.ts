// Transmissão direta de NF-e (modelo 55, v4.00) à SEFAZ via SOAP.
// Gera o XML, assina com o certificado A1 (.pfx) cadastrado em EmpresaConfig,
// envia ao webservice NfeAutorizacao (indSinc=1) e grava chave/protocolo.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { buildInfNFe, buildNFeDocument } from "../../shared/nfeXml.ts";
import { parsePfx, importSignKey, signInfNFe } from "../../shared/nfeSign.ts";

const SOAP_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao/nfeAutorizacaoLote";

const ENDPOINTS = {
  // SP — webservice próprio (nfeAutorizacaoLote)
  SP: {
    1: "https://nfe.fazenda.sp.gov.br/nfeweb/services/NfeAutorizacao",
    2: "https://homologacao.nfe.fazenda.sp.gov.br/nfeweb/services/NfeAutorizacao",
  },
  // SVRS — Sefaz Virtual do RS, atende a vários estados
  SVRS: {
    1: "https://nfe.sefaz.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao.asmx",
    2: "https://homologacao.nfe.sefaz.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao.asmx",
  },
};

const UF_PROPRIOS = new Set(["SP", "MG", "PR", "RS", "MS", "MT", "GO", "BA", "PE", "CE", "DF"]);
function endpointFor(uf, ambiente) {
  const key = UF_PROPRIOS.has((uf || "SP").toUpperCase()) && ENDPOINTS[uf.toUpperCase()]
    ? uf.toUpperCase() : "SVRS";
  return ENDPOINTS[key][ambiente] || ENDPOINTS.SVRS[2];
}

function stripNs(xml, tag) {
  const m = xml.match(new RegExp("<(?:[a-zA-Z0-9]+:)?" + tag + ">([^<]*)</"));
  return m ? m[1] : null;
}

function parseRetorno(xml) {
  // bloco protNFe/infProt traz cStat autorizador + chave + protocolo
  const protMatch = xml.match(/<(?:[a-zA-Z0-9]+:)?protNFe>[\s\S]*?<\/(?:[a-zA-Z0-9]+:)?protNFe>/);
  const prot = protMatch ? protMatch[0] : xml;
  const cStat = stripNs(prot, "cStat");
  const xMotivo = stripNs(prot, "xMotivo");
  const chNFe = stripNs(prot, "chNFe");
  const nProt = stripNs(prot, "nProt");
  const dhRecbto = stripNs(prot, "dhRecbto");
  return { cStat, xMotivo, chNFe, nProt, dhRecbto };
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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Apenas administradores podem emitir NF-e" }, { status: 403 });

    const body = await req.json();
    const fiscalNoteId = body?.fiscalNoteId;
    const ambiente = Number(body?.ambiente) === 1 ? 1 : 2; // 2=homologação (padrão seguro)
    if (!fiscalNoteId) return Response.json({ error: "fiscalNoteId é obrigatório" }, { status: 400 });

    const nf = await base44.entities.FiscalNote.get(fiscalNoteId);
    if (!nf) return Response.json({ error: "Nota fiscal não encontrada" }, { status: 404 });
    if (nf.tipo !== "nfe") return Response.json({ error: "Transmissão SEFAZ disponível apenas para NF-e (Produto)" }, { status: 400 });

    // Certificado A1 cadastrado em EmpresaConfig
    const certs = await base44.asServiceRole.entities.EmpresaConfig.filter({ tipo: "certificado_digital" });
    const cert = (certs || []).slice().sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))[0];
    if (!cert || !cert.arquivo_url) {
      return Response.json({ error: "Nenhum certificado digital (.pfx) cadastrado em Configurações. Cadastre o certificado A1 e a senha." }, { status: 400 });
    }

    const pfxResp = await fetch(cert.arquivo_url);
    if (!pfxResp.ok) throw new Error("Falha ao baixar o certificado (.pfx): " + pfxResp.status);
    const pfxBuf = await pfxResp.arrayBuffer();

    const { pkcs8, certB64 } = parsePfx(pfxBuf, cert.senha_certificado || "");
    const cryptoKey = await importSignKey(pkcs8);

    const { infNFe } = buildInfNFe(nf, { ambiente });
    const signature = await signInfNFe(infNFe, cryptoKey, certB64);
    const signedXml = buildNFeDocument(infNFe, signature);

    const uf = (nf.emitente_uf || "SP").toUpperCase();
    const cUF = String(uf === "SP" ? 35 : 35).padStart(2, "0");
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

    const { cStat, xMotivo, chNFe, nProt, dhRecbto } = parseRetorno(respXml);
    const autorizada = cStat === "100" || cStat === "150";

    const update = {
      chave_acesso: chNFe || nf.chave_acesso,
      protocolo: nProt || nf.protocolo,
      status: autorizada ? "emitida" : (nf.status === "emitida" ? "emitida" : "rascunho"),
      data_emissao: nf.data_emissao,
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