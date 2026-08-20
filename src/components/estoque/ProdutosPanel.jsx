import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, AlertTriangle, TrendingDown, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProdutosPanel() {
  const [prodSearch, setProdSearch] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
  });

  const filteredProducts = products.filter(p =>
    !prodSearch || [p.name, p.code, p.size].some(v => String(v || '').toLowerCase().includes(prodSearch.toLowerCase()))
  );
  const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.min_stock || 0));
  const totalProductValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{products.length} produtos (treliças) cadastrados</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Total em Estoque</p>
          <p className="text-2xl font-bold">R$ {totalProductValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={cn("border rounded-2xl p-4", lowStockProducts.length > 0 ? "bg-red-50 border-red-200" : "bg-card")}>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> Estoque Baixo</p>
          <p className={cn("text-2xl font-bold", lowStockProducts.length > 0 ? "text-red-600" : "")}>{lowStockProducts.length} produto(s)</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Itens OK</p>
          <p className="text-2xl font-bold text-green-600">{products.length - lowStockProducts.length}</p>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-700">Estoque Abaixo do Mínimo ({lowStockProducts.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map(p => (
              <span key={p.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                {p.name}{p.size ? ` ${p.size}` : ''}: {p.stock} {p.unit} (mín: {p.min_stock})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Código','Nome','Tamanho','Un.','Estoque','Mínimo','Preço','Consumo Insumos','Total'].map(h => (
                  <th key={h} className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhum produto cadastrado</td></tr>
              )}
              {filteredProducts.map(p => {
                const isLow = (p.stock || 0) <= (p.min_stock || 0);
                const total = (p.stock || 0) * (p.price || 0);
                return (
                  <tr key={p.id} className={cn("border-t hover:bg-muted/30 transition-colors", isLow && "bg-red-50/40")}>
                    <td className="p-3 font-mono text-xs">{p.code || '—'}</td>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{p.size || '—'}</td>
                    <td className="p-3">{p.unit}</td>
                    <td className="p-3">
                      <span className={cn("font-bold", isLow ? "text-red-600" : "text-green-600")}>{p.stock ?? 0}</span>
                      {isLow && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                    </td>
                    <td className="p-3 text-muted-foreground">{p.min_stock ?? 0}</td>
                    <td className="p-3">R$ {(p.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3">
                      {p.consumo_insumos?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {p.consumo_insumos.map((c, i) => (
                            <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                              {c.supply_name} ×{c.quantity}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 font-semibold">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}