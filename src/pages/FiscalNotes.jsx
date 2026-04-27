import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Printer, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const STATUS_MAP = {
  rascunho: { label: 'Rascunho', color: 'bg-amber-100 text-amber-700', icon: Clock },
  emitida: { label: 'Emitida', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function FiscalNotes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['fiscal_notes'],
    queryFn: () => base44.entities.FiscalNote.list('-created_date'),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders_for_nf'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.FiscalNote.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal_notes'] }),
  });

  // Find orders WITHOUT a nota
  const noteOrderIds = new Set(notes.map(n => n.order_id).filter(Boolean));
  const ordersWithoutNF = orders.filter(o => !noteOrderIds.has(o.id));

  const filtered = notes.filter(n =>
    !search ||
    n.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    n.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    n.numero?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = (note) => {
    const valorFmt = Number(note.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const issValor = (Number(note.valor) * (note.aliquota_iss || 5) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const html = `<html><head><title>NF ${note.numero}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}
    h2{color:#F47920;margin:12px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .label{color:#666;font-size:10px}.value{font-weight:bold}</style></head><body>
    <h1 style="color:#2B3A8F">MODELAJES — ${note.tipo === 'nfs' ? 'NFS-e' : 'NF-e'} #${note.numero}</h1>
    <h2>Cliente</h2>
    <div class="grid2">
      <div><div class="label">Nome</div><div class="value">${note.client_name}</div></div>
      <div><div class="label">Pedido</div><div class="value">#${note.order_number}</div></div>
      <div><div class="label">CPF/CNPJ</div><div class="value">${note.cliente_cnpj || '—'}</div></div>
      <div><div class="label">Data</div><div class="value">${note.data_emissao ? format(parseISO(note.data_emissao), 'dd/MM/yyyy') : '—'}</div></div>
    </div>
    <h2>Discriminação</h2><p>${note.descricao || '—'}</p>
    <h2>Valores</h2>
    <div class="grid2">
      <div><div class="label">CFOP</div><div class="value">${note.cfop}</div></div>
      <div><div class="label">Natureza</div><div class="value">${note.natureza}</div></div>
      <div><div class="label">Valor Total</div><div class="value" style="font-size:18px;color:#F47920">${valorFmt}</div></div>
      <div><div class="label">ISS/ICMS (${note.aliquota_iss}%)</div><div class="value">${issValor}</div></div>
    </div>
    <div style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;font-size:10px;color:#999">
      Prévia gerada pelo sistema Modelajes. Para validade fiscal, use emissor homologado SEFAZ.
    </div>
    <script>setTimeout(()=>window.print(),400)</script></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais</h1>
        <p className="text-sm text-muted-foreground">Acompanhe notas emitidas e pedidos sem NF</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total NFs', value: notes.length, color: 'text-primary' },
          { label: 'Emitidas', value: notes.filter(n => n.status === 'emitida').length, color: 'text-green-600' },
          { label: 'Rascunhos', value: notes.filter(n => n.status === 'rascunho').length, color: 'text-amber-600' },
          { label: 'Pedidos sem NF', value: ordersWithoutNF.length, color: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Pedidos sem NF */}
      {ordersWithoutNF.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm mb-2 text-red-600">⚠ Pedidos sem Nota Fiscal ({ordersWithoutNF.length})</h2>
          <div className="border border-red-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="text-left p-3 font-semibold text-xs">Pedido</th>
                  <th className="text-left p-3 font-semibold text-xs">Cliente</th>
                  <th className="text-left p-3 font-semibold text-xs">Valor</th>
                  <th className="text-left p-3 font-semibold text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordersWithoutNF.slice(0, 10).map(o => (
                  <tr key={o.id} className="border-t border-red-100">
                    <td className="p-3 font-mono font-medium">#{o.order_number}</td>
                    <td className="p-3">{o.client_name}</td>
                    <td className="p-3">{o.total_value ? `R$ ${Number(o.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground capitalize">{o.status?.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NFs list */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-semibold">Notas Emitidas / Rascunhos</h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 border border-dashed rounded-xl">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhuma nota registrada. As notas são geradas na aba "Nota Fiscal" de cada pedido.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-semibold text-xs">Nº Nota</th>
                  <th className="text-left p-3 font-semibold text-xs">Pedido</th>
                  <th className="text-left p-3 font-semibold text-xs">Cliente</th>
                  <th className="text-left p-3 font-semibold text-xs">Valor</th>
                  <th className="text-left p-3 font-semibold text-xs">Emissão</th>
                  <th className="text-left p-3 font-semibold text-xs">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(note => {
                  const st = STATUS_MAP[note.status] || STATUS_MAP.rascunho;
                  return (
                    <tr key={note.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-medium">{note.numero}</td>
                      <td className="p-3">#{note.order_number}</td>
                      <td className="p-3">{note.client_name}</td>
                      <td className="p-3 font-medium">{note.valor ? `R$ ${Number(note.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                      <td className="p-3 text-muted-foreground">{note.data_emissao ? format(parseISO(note.data_emissao), 'dd/MM/yyyy') : '—'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {note.status === 'rascunho' && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus.mutate({ id: note.id, status: 'emitida' })}>
                              Marcar Emitida
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handlePrint(note)}>
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}