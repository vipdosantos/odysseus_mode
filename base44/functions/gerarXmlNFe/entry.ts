// Gera o XML final da NF-e (v4.00) assinado, sem transmitir à SEFAZ.
// Recalcula impostos server-side e usa o certificado A1 cadastrado.
// Retorna { ok, xml, chave, ambiente } para download/inspeção.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { loadCertificado, prepareSignedNFe } from "../../shared/nfePipeline.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Apenas administradores podem gerar o XML da NF-e" }, { status: 403 });

    const body = await req.json();
    const fiscalNoteId = body?.fiscalNoteId;
    const ambiente = Number(body?.ambiente) === 1 ? 1 : 2; // 2=homologação (padrão)
    if (!fiscalNoteId) return Response.json({ error: "fiscalNoteId é obrigatório" }, { status: 400 });

    const nf = await base44.entities.FiscalNote.get(fiscalNoteId);
    if (!nf) return Response.json({ error: "Nota fiscal não encontrada" }, { status: 404 });
    if (nf.tipo !== "nfe") return Response.json({ error: "Geração de XML disponível apenas para NF-e (Produto)" }, { status: 400 });

    const cert = await loadCertificado(base44);
    const { signedXml, chave } = await prepareSignedNFe(nf, cert, { ambiente });

    return Response.json({ ok: true, xml: signedXml, chave, ambiente });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}