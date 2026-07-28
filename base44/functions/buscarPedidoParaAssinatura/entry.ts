import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const accessKey = ((body && body.access_key) || "").trim();
    if (!accessKey) return Response.json({ error: "Chave de acesso obrigatória." }, { status: 400 });

    const results = await base44.asServiceRole.entities.Order.filter({ access_key: accessKey }, "-created_date", 1);
    const order = results && results[0];
    if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });

    // Retorna apenas os campos seguros necessários para a tela de assinatura
    return Response.json({
      id: order.id,
      order_number: order.order_number,
      client_name: order.client_name,
      delivery_date: order.delivery_date || "",
      delivery_address: order.delivery_address || "",
      total_value: order.total_value || 0,
      payment_method: order.payment_method || "",
      items: (order.items || []).map((it: any) => ({
        truss_type: it.truss_type || "",
        size: it.size || "",
        quantity: it.quantity || 0,
      })),
      contract_signed_at: order.contract_signed_at || "",
      contract_rg: order.contract_rg || "",
      contract_cpf: order.contract_cpf || "",
      contract_drive_link: order.contract_drive_link || "",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}