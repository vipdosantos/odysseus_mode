// Transmissão de NFS-e (padrão ABRASF v2.03) ao webservice municipal.
// Lê o endpoint + ambiente da EmpresaConfig (tipo: "nfse_config"), reusa o
// certificado A1 cadastrado para assinar o RPS, envia via SOAP sincrono e
// grava numero/codigo de verificacao na FiscalNote.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { buildLoteRps, buildLoteRpsXml, buildSoapEnvelopeNfse, parseRetornoNfse } from "../../shared/nfseXml.ts";
import { importSignKey, signInfNFe } from "../../shared/nfeSign.ts";
import { loadCertificado } from "../../shared/nfePipeline.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Apenas administradores podem emitir NFS-e" }, { status: 403 });

    const body = await req.json();
    const fiscalNoteId = body?.fiscalNoteId;
    const ambiente = Number(body?.ambiente) === 1 ? 1 : 2; // 2=homologação
    if (!fiscalNoteId) return Response.json({ error: "fiscalNoteId é obrigatório" }, { status: 400 });

    const nf = await base44.entities.FiscalNote.get(fiscalNoteId);
    if (!nf) return Response.json({ error: "Nota fiscal não encontrada" }, { status: 404 });
    if (nf.tipo !== "nfs") return Response.json({ error: "Transmissão municipal disponível apenas para NFS-e" }, { status: 400 });

    // Configuração do webservice municipal (URL por ambiente).
    const cfgs = await base44.asServiceRole.entities.EmpresaConfig.filter({ tipo: "nfse_config" });
    const cfg = (cfgs || [])[0];
    if (!cfg || !cfg.valor) {
      return Response.json({
        error: "Webservice municipal da NFS-e não configurado. Cadastre a URL em Cadastros → NFS-e.",
      }, { status: 400 });
    }
    let urls = {};
    try { urls = JSON.parse(cfg.valor); } catch { urls = { homologacao: cfg.valor }; }
    const endpoint = ambiente === 1 ? (urls.producao || urls.homologacao) : (urls.homologacao || urls.producao);
    if (!endpoint) return Response.json({ error: "URL do webservice municipal não definida para o ambiente selecionado." }, { status: 400 });

    // Certificado A1 + assinatura do RPS.
    const cert = await loadCertificado(base44);
    const { infRps } = buildLoteRps(nf, { ambiente });
    const cryptoKey = await importSignKey(cert.pkcs8);
    const signature = await signInfNFe(infRps, cryptoKey, cert.certB64);
    const loteXml = buildLoteRpsXml(infRps, signature, nf, { ambiente });
    const soap = buildSoapEnvelopeNfse(loteXml);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://www.abrasf.org.br/nfse/RecepcionarLoteRpsSincrono" },
      body: soap,
    });
    const respXml = await resp.text();
    const ret = parseRetornoNfse(respXml);

    if (ret.fault) {
      return Response.json({ error: "Falha SOAP do webservice municipal: " + ret.fault, xmlRetorno: respXml.slice(0, 4000) }, { status: 502 });
    }
    if (ret.erros.length) {
      return Response.json({ error: "Webservice municipal rejeitou: " + ret.erros.join(" | "), xmlRetorno: respXml.slice(0, 4000) }, { status: 422 });
    }
    if (!ret.numero && !ret.protocolo) {
      return Response.json({ error: "Resposta sem numero de NFS-e (HTTP " + resp.status + ")", xmlRetorno: respXml.slice(0, 4000) }, { status: 502 });
    }

    const update = {
      numero: ret.numero || nf.numero,
      protocolo: ret.protocolo || nf.protocolo,
      status: "emitida",
    };
    if (ret.codigoVerificacao) update.chave_acesso = ret.codigoVerificacao;
    await base44.entities.FiscalNote.update(fiscalNoteId, update);

    return Response.json({
      ok: true,
      numero: ret.numero,
      protocolo: ret.protocolo,
      codigoVerificacao: ret.codigoVerificacao,
      ambiente,
      detalhe: "NFS-e autorizada pelo webservice municipal",
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}