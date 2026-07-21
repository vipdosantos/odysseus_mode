import { base44 } from '@/api/base44Client';

// Decrementa o estoque de Produtos (treliças) e Insumos (Supply) conforme os
// itens de um pedido recém-criado. Cada item casa com um produto pelo campo
// `size` (ou `name` quando o produto não tem tamanho). O consumo de insumos
// é lido da BOM do produto (campo `consumo_insumos`).
//
// Retorna um resumo { produtos, insumos } com a quantidade de registros atualizados.
export async function applyStockDecrement(order) {
  if (!order?.items?.length) return { produtos: 0, insumos: 0 };

  const [products, supplies] = await Promise.all([
    base44.entities.Product.list('name', 500),
    base44.entities.Supply.list('name', 500),
  ]);

  const productDeltas = {}; // productId -> qty a baixar
  const supplyDeltas = {};  // supplyId -> qty a baixar

  for (const item of order.items) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    const prod = products.find(
      (p) => (p.size && p.size === item.size) || (!p.size && p.name === item.size)
    );
    if (!prod) continue;

    productDeltas[prod.id] = (productDeltas[prod.id] || 0) + qty;

    for (const c of prod.consumo_insumos || []) {
      if (!c.supply_id) continue;
      const cq = Number(c.quantity) || 0;
      if (cq <= 0) continue;
      supplyDeltas[c.supply_id] = (supplyDeltas[c.supply_id] || 0) + cq * qty;
    }
  }

  const productUpdates = Object.entries(productDeltas).map(([id, dq]) => {
    const p = products.find((x) => x.id === id);
    return { id, stock: Math.max(0, (Number(p.stock) || 0) - dq) };
  });
  if (productUpdates.length) {
    await base44.entities.Product.bulkUpdate(productUpdates);
  }

  const supplyUpdates = Object.entries(supplyDeltas).map(([id, dq]) => {
    const s = supplies.find((x) => x.id === id);
    return { id, stock: Math.max(0, (Number(s.stock) || 0) - dq) };
  });
  if (supplyUpdates.length) {
    await base44.entities.Supply.bulkUpdate(supplyUpdates);
  }

  return { produtos: productUpdates.length, insumos: supplyUpdates.length };
}