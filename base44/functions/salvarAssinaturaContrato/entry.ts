import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { ensureClientFolder, uploadPdfToFolder } from "../../shared/driveHelper.ts";
import { buildContractPdf } from "../../shared/docsPdf.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const accessKey = (body.access_key || "").trim();
    const rg = (body.rg || "").trim();
    const cpf = (body.cpf || "").trim();
    const signature = body.signature || null;

    if (!accessKey) return Response.json({ error: "Chave de acesso obrigatória." }, { status: 400 });
    if (!rg || !cpf) return Response.json({ error: "RG e CPF são obrigatórios." }, { status: 400 });
    if (!signature) return Response.json({ error: "Assinatura é obrigatória." }, { status: 400 });

    const results = await base44.asServiceRole.entities.Order.filter({ access_key: accessKey }, "-created_date", 1);
    const order = results && results[0];
    if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });

    const signedAt = new Date().toISOString();
    const pdfBytes = buildContractPdf(order, { rg, cpf, signatureDataUrl: signature, signedAt });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    const folderId = await ensureClientFolder(accessToken, order.client_name);
    const fileName = `Contrato_${order.order_number || order.id}.pdf`;
    const { id, webViewLink } = await uploadPdfToFolder(accessToken, folderId, fileName, pdfBytes);

    await base44.asServiceRole.entities.Order.update(order.id, {
      contract_rg: rg,
      contract_cpf: cpf,
      contract_signature: signature,
      contract_signed_by: order.client_name,
      contract_signed_at: signedAt,
      contract_drive_id: id,
      contract_drive_link: webViewLink,
    });

    // Devolve o PDF em base64 para o cliente baixar uma cópia
    const bytes = new Uint8Array(pdfBytes);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const pdfBase64 = btoa(binary);

    return Response.json({ ok: true, driveLink: webViewLink, pdfBase64 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}