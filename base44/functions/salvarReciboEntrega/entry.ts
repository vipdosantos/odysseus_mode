import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { ensureClientFolder, uploadPdfToFolder } from "../../shared/driveHelper.ts";
import { buildDeliveryReceiptPdf } from "../../shared/docsPdf.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const orderId = body.order_id;
    if (!orderId) return Response.json({ error: "Pedido obrigatório." }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(orderId);
    if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (!order.delivery_signature) {
      return Response.json({ error: "Recibo ainda não foi assinado pelo recebedor." }, { status: 400 });
    }

    const pdfBytes = buildDeliveryReceiptPdf(order);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    const folderId = await ensureClientFolder(accessToken, order.client_name);
    const fileName = `Recibo_${order.order_number || order.id}.pdf`;
    const { id, webViewLink } = await uploadPdfToFolder(accessToken, folderId, fileName, pdfBytes);

    await base44.asServiceRole.entities.Order.update(order.id, {
      delivery_drive_id: id,
      delivery_drive_link: webViewLink,
    });

    return Response.json({ ok: true, driveLink: webViewLink });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}