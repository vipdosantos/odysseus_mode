import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Printer, CheckCircle2, Clock, XCircle, Send, Loader2, FileCheck2, Zap, ListChecks, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO } from 'date-fns';
import { DEFAULT_EMITENTE, recalcular } from '@/lib/nfTax';
import { buildDanfeHtml, buildNfseHtml } from '@/lib/nfPrintLayouts';
import { toast } from 'sonner';

const STATUS_MAP = {
  rascunho: { label: 'Rascunho', color: 'bg-amber-100 text-amber-700', icon: Clock },
  emitida: { label: 'Emitida', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function FiscalNotes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkPending, setBulkPending] = useState(false);

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

  // Cria NF-e a partir do pedido (items com valor distribuído) e tenta transmitir à SEFAZ.
  const emitNFe = useMutation({
    mutationFn: async (order) => {
      const totalQty = (order.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0) || 1;
      const unitPrice = (order.total_value || 0) / totalQty;
      const itens = (order.items || []).map((it, idx) => ({
        codigo: it.qr_code_id || `${order.order_number}-${idx}`,
        ncm: '',
        cst: '00',
        cfop: '5.102',
        descricao: [it.size, it.truss_type].filter(Boolean).join(' '),
        unidade: 'UN',
        quantidade: Number(it.quantity) || 0,
        valor_unitario: Number(unitPrice.toFixed(2)) || 0,
        valor_desconto: 0,
        aliquota_icms: 0,
        aliquota_ipi: 0,
      }));
      const nf = recalcular({
        ...DEFAULT_EMITENTE,
        order_id: order.id,
        order_number: order.order_number,
        client_name: order.client_name,
        cliente_cnpj: '',
        numero: `NF-${order.order_number}`,
        natureza: 'Venda de Mercadoria',
        cfop: '5.102',
        tipo: 'nfe',
        itens,
        valor: order.total_value || 0,
        data_emissao: new Date().toISOString().split('T')[0],
        status: 'rascunho',
      });
      const created = await base44.entities.FiscalNote.create(nf);
      // Tenta transmitir; se faltar dados do destinatário, mantém como rascunho.
      try {
        const res = await base44.functions.invoke('emitirNFe', { fiscalNoteId: created.id, ambiente: 2 });
        const data = res?.data || res;
        return { created, transmit: data };
      } catch (e) {
        return { created, transmit: { error: e?.response?.data?.error || e.message } };
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['fiscal_notes'] });
      qc.invalidateQueries({ queryKey: ['orders_for_nf'] });
      const t = result.transmit;
      if (t?.cStat === '100' || t?.cStat === '150') {
        toast.success(`NF-e autorizada pela SEFAZ! Protocolo ${t.protocolo}`);
      } else if (t?.error) {
        toast.error('NF-e criada como rascunho', { description: 'Complete os dados do destinatário na aba Nota Fiscal do pedido e transmita novamente.' });
      } else {
        toast(`SEFAZ: ${t?.cStat || ''} — ${t?.xMotivo || ''}`);
      }
    },
    onError: (e) => toast.error('Erro ao emitir NF-e', { description: e.message }),
  });

  // Transmite NFS-e ao webservice municipal.
  const transmitNfse = useMutation({
    mutationFn: async (note) => {
      const res = await base44.functions.invoke('emitirNFSe', { fiscalNoteId: note.id, ambiente: 2 });
      return res?.data || res;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['fiscal_notes'] });
      if (data?.ok) toast.success(`NFS-e autorizada! Nº ${data.numero}`);
      else toast.error(data?.error || 'Falha na transmissão da NFS-e');
    },
    onError: (e) => toast.error('Erro na transmissão', { description: e?.response?.data?.error || e.message }),
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
    const order = orders.find(o => o.id === note.order_id) || null;
    const nfCalc = recalcular(note);
    const html = note.tipo === 'nfe' ? buildDanfeHtml(nfCalc, order) : buildNfseHtml(nfCalc, order);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const toggleSel = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every(n => selectedIds.has(n.id));
  const toggleAll = () => setSelectedIds(prev => {
    const next = new Set(prev);
    if (allFilteredSelected) filtered.forEach(n => next.delete(n.id));
    else filtered.forEach(n => next.add(n.id));
    return next;
  });

  const selected = notes.filter(n => selectedIds.has(n.id));
  const selRascunhoNfs = selected.filter(n => n.status === 'rascunho' && n.tipo === 'nfs');
  const selRascunhoNfe = selected.filter(n => n.status === 'rascunho' && n.tipo === 'nfe');

  const bulkTransmit = async () => {
    setBulkPending(true);
    let ok = 0, fail = 0;
    for (const n of selRascunhoNfs) {
      try { await transmitNfse.mutateAsync(n); ok++; } catch { fail++; }
    }
    setBulkPending(false); setSelectedIds(new Set());
    if (ok) toast.success(`${ok} NFS-e transmitida(s)` + (fail ? ` • ${fail} falha(s)` : ''));
    else if (fail) toast.error(`${fail} NFS-e falharam`);
  };
  const bulkMarkEmitida = async () => {
    setBulkPending(true);
    for (const n of selRascunhoNfe) {
      try { await updateStatus.mutateAsync({ id: n.id, status: 'emitida' }); } catch {}
    }
    setBulkPending(false); setSelectedIds(new Set());
    toast.success(`${selRascunhoNfe.length} NF-e marcada(s) como emitida(s)`);
  };
  const bulkPrint = () => {
    selected.forEach(handlePrint);
    setSelectedIds(new Set());
  };

  const toggleOrderSel = (id) => setSelectedOrderIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allOrdersSelected = ordersWithoutNF.length > 0 && ordersWithoutNF.every(o => selectedOrderIds.has(o.id));
  const toggleAllOrders = () => setSelectedOrderIds(prev => {
    const next = new Set(prev);
    if (allOrdersSelected) ordersWithoutNF.forEach(o => next.delete(o.id));
    else ordersWithoutNF.forEach(o => next.add(o.id));
    return next;
  });
  const selectedOrders = ordersWithoutNF.filter(o => selectedOrderIds.has(o.id));
  const bulkEmitNFe = async () => {
    setBulkPending(true);
    let ok = 0, fail = 0;
    for (const o of selectedOrders) {
      try { await emitNFe.mutateAsync(o); ok++; } catch { fail++; }
    }
    setBulkPending(false); setSelectedOrderIds(new Set());
    if (ok) toast.success(`${ok} NF-e gerada(s)` + (fail ? ` • ${fail} falha(s)` : ''));
    else if (fail) toast.error(`${fail} NF-e falharam`);
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
          {selectedOrderIds.size > 0 && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex-wrap">
              <span className="text-sm font-medium text-red-700 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4" /> {selectedOrderIds.size} pedido(s) selecionado(s)
              </span>
              <Button size="sm" className="bg-primary text-primary-foreground h-7 text-xs" disabled={bulkPending} onClick={bulkEmitNFe}>
                {bulkPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Emitir NF-e em massa ({selectedOrders.length})
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto" onClick={() => setSelectedOrderIds(new Set())}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          <div className="border border-red-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="w-10 p-3">
                    <Checkbox checked={allOrdersSelected} onCheckedChange={toggleAllOrders} aria-label="Selecionar todos os pedidos" />
                  </th>
                  <th className="text-left p-3 font-semibold text-xs">Pedido</th>
                  <th className="text-left p-3 font-semibold text-xs">Cliente</th>
                  <th className="text-left p-3 font-semibold text-xs">Valor</th>
                  <th className="text-left p-3 font-semibold text-xs">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {ordersWithoutNF.slice(0, 10).map(o => (
                  <tr key={o.id} className="border-t border-red-100">
                    <td className="p-3">
                      <Checkbox checked={selectedOrderIds.has(o.id)} onCheckedChange={() => toggleOrderSel(o.id)} aria-label="Selecionar pedido" />
                    </td>
                    <td className="p-3 font-mono font-medium">#{o.order_number}</td>
                    <td className="p-3">{o.client_name}</td>
                    <td className="p-3">{o.total_value ? `R$ ${Number(o.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground capitalize">{o.status?.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground text-xs h-7"
                        disabled={emitNFe.isPending}
                        onClick={() => emitNFe.mutate(o)}
                      >
                        {emitNFe.isPending && emitNFe.variables?.id === o.id
                          ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Emitindo...</span>
                          : <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Emitir NF-e</span>}
                      </Button>
                    </td>
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

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-primary/10 border border-primary/30 rounded-xl flex-wrap">
            <span className="text-sm font-medium text-primary flex items-center gap-1.5">
              <ListChecks className="w-4 h-4" /> {selectedIds.size} selecionada(s)
            </span>
            {selRascunhoNfs.length > 0 && (
              <Button size="sm" variant="outline" className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50" disabled={bulkPending} onClick={bulkTransmit}>
                {bulkPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Transmitir NFS-e ({selRascunhoNfs.length})
              </Button>
            )}
            {selRascunhoNfe.length > 0 && (
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={bulkPending} onClick={bulkMarkEmitida}>
                Marcar NF-e Emitidas ({selRascunhoNfe.length})
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={bulkPrint}>
              <Printer className="w-3 h-3" /> Imprimir
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto" onClick={() => setSelectedIds(new Set())}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

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
                  <th className="w-10 p-3">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
                  </th>
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
                      <td className="p-3">
                        <Checkbox checked={selectedIds.has(note.id)} onCheckedChange={() => toggleSel(note.id)} aria-label="Selecionar nota" />
                      </td>
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
                          {note.status === 'rascunho' && note.tipo === 'nfs' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-green-300 text-green-700 hover:bg-green-50"
                              disabled={transmitNfse.isPending}
                              onClick={() => transmitNfse.mutate(note)}
                            >
                              {transmitNfse.isPending && transmitNfse.variables?.id === note.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Send className="w-3 h-3" />}
                              Transmitir
                            </Button>
                          )}
                          {note.status === 'rascunho' && note.tipo === 'nfe' && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus.mutate({ id: note.id, status: 'emitida' })}>
                              Marcar Emitida
                            </Button>
                          )}
                          {note.status === 'emitida' && (
                            <span className="text-xs text-green-600 flex items-center gap-1"><FileCheck2 className="w-3 h-3" /> Autorizada</span>
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