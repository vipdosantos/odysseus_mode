// Pipeline compartilhado: carrega o certificado A1, recalcula os impostos,
// gera o XML da NF-e e assina (XMLDSig). Usado por gerarXmlNFe e emitirNFe.

import { recalcTotaisNFe, buildInfNFe, buildNFeDocument, validateNFe } from "./nfeXml.ts";
import { parsePfx, importSignKey, signInfNFe } from "./nfeSign.ts";

// Carrega o certificado A1 (.pfx) mais recente cadastrado em EmpresaConfig.
export async function loadCertificado(base44) {
  const certs = await base44.asServiceRole.entities.EmpresaConfig.filter({ tipo: "certificado_digital" });
  const cert = (certs || []).slice().sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))[0];
  if (!cert || !cert.arquivo_url) {
    throw new Error("Nenhum certificado digital (.pfx) cadastrado em Configurações. Cadastre o certificado A1 e a senha.");
  }
  const pfxResp = await fetch(cert.arquivo_url);
  if (!pfxResp.ok) throw new Error("Falha ao baixar o certificado (.pfx): " + pfxResp.status);
  const pfxBuf = await pfxResp.arrayBuffer();
  return parsePfx(pfxBuf, cert.senha_certificado || "");
}

// Recalcula totais, gera e assina o XML. Devolve { signedXml, chave }.
export async function prepareSignedNFe(nf, { pkcs8, certB64 }, { ambiente }) {
  const errs = validateNFe(nf);
  if (errs.length) throw new Error("Dados da NF-e incompletos para transmissão: " + errs.join("; "));
  const nfCalc = recalcTotaisNFe(nf);
  const cryptoKey = await importSignKey(pkcs8);
  const { infNFe, chave } = buildInfNFe(nfCalc, { ambiente });
  const signature = await signInfNFe(infNFe, cryptoKey, certB64);
  const signedXml = buildNFeDocument(infNFe, signature);
  return { signedXml, chave, nfCalc };
}