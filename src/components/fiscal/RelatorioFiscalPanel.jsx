import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Printer, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function impostosNota(n) {
  if (n.tipo === 'nfs') return Number(n.valor_iss) || 0;
  return (Number(n.valor_icms) || 0) + (Number(n.valor_ipi) || 0) + (Number(n.valor_icms_st) || 0);
}

export default function RelatorioFiscalPanel() {
  const hoje = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date(hoje.getFullYear(), hoje.getMonth() + monthOffset, 1);
  const monthKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['fiscal_notes', 'relatorio'],
    queryFn: () => base44.entities.FiscalNote.list('-data_emissao', 1000),
  });

  const emitidas = useMemo(() => {
    return notas
      .filter((n) => n.status === 'emitida' && String(n.data_emissao || '').startsWith(monthKey))
      .sort((a, b) => String(a.data_emissao).localeCompare(String(b.data_emissao)));
  }, [notas, monthKey]);

  const totais = useMemo(() => {
    return emitidas.reduce(
      (acc, n) => {
        acc.valorNotas += n.tipo === 'nfs' ? Number(n.valor) || 0 : Number(n.valor_total_nfe) || 0;
        acc.icms += Number(n.valor_icms) || 0;
        acc.ipi += Number(n.valor_ipi) || 0;
        acc.icmsSt += Number(n.valor_icms_st) || 0;
        acc.iss += Number(n.valor_iss) || 0;
        acc.impostos += impostosNota(n);
        acc.produtos += Number(n.valor_produtos) || 0;
        return acc;
      },
      { valorNotas: 0, icms: 0, ipi: 0, icmsSt: 0, iss: 0, impostos: 0, produtos: 0 }
    );
  }, [emitidas]);

  const handlePrint = () => {
    const linhas = emitidas
      .map((n) => {
        const imp = impostosNota(n);
        const valor = n.tipo === 'nfs' ? n.valor : n.valor_total_nfe;
        return `<tr>
          <td>${n.numero || '—'}</td>
          <td>${n.order_number || '—'}</td>
          <td>${n.client_name || '—'}</td>
          <td>${n.tipo === 'nfs' ? 'NFS-e' : 'NF-e'}</td>
          <td>${n.data_emissao ? format(parseISO(n.data_emissao), 'dd/MM/yyyy') : '—'}</td>
          <td style="text-align:right">${BRL(valor)}</td>
          <td style="text-align:right">${n.tipo === 'nfs' ? '—' : BRL(n.valor_icms)}</td>
          <td style="text-align:right">${n.tipo === 'nfs' ? BRL(n.valor_iss) : BRL(imp)}</td>
          <td style="text-align:right">${BRL(imp)}</td>
        </tr>`;
      })
      .join('');

    const html = `<html><head><title>Relatório Fiscal ${format(base, 'MM/yyyy')}</title>
      <style>body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#111}
      h1{color:#F47920;margin:0 0 4px}h2{font-size:13px;color:#555;margin:0 0 16px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-size:10px;text-transform:uppercase}
      .totais td{font-weight:bold;background:#fff8e1}
      .footer{margin-top:24px;border-top:1px solid #eee;padding-top:8px;font-size:10px;color:#999}</style></head><body>
      <h1>MODELAJES — Relatório Fiscal</h1>
      <h2>Período: ${format(base, 'MMMM yyyy', { locale: ptBR })} · ${emitidas.length} nota(s) emitida(s)</h2>
      <table>
        <thead><tr>
          <th>Nº Nota</th><th>Pedido</th><th>Cliente</th><th>Tipo</th><th>Emissão</th>
          <th style="text-align:right">Valor Total</th><th style="text-align:right">ICMS</th><th style="text-align:right">ISS/Imp.</th><th style="text-align:right">Total Impostos</th>
        </tr></thead>
        <tbody>${linhas}
          <tr class="totais">
            <td colspan="5">TOTAIS</td>
            <td style="text-align:right">R$ ${BRL(totais.valorNotas)}</td>
            <td style="text-align:right">R$ ${BRL(totais.icms)}</td>
            <td style="text-align:right">R$ ${BRL(totais.iss)}</td>
            <td style="text-align:right">R$ ${BRL(totais.impostos)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer">Relatório gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} — MODELAJES</div>
      <script>setTimeout(()=>window.print(),400)</script></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const cards = [
    { label: 'Notas Emitidas', value: String(emitidas.length), tone: 'text-primary' },
    { label: 'Valor Total Emitido', value: `R$ ${BRL(totais.valorNotas)}`, tone: 'text-foreground' },
    { label: 'ICMS', value: `R$ ${BRL(totais.icms)}`, tone: 'text-blue-600' },
    { label: 'IPI', value: `R$ ${BRL(totais.ipi)}`, tone: 'text-purple-600' },
    { label: 'ICMS ST', value: `R$ ${BRL(totais.icmsSt)}`, tone: 'text-indigo-600' },
    { label: 'ISS', value: `R$ ${BRL(totais.iss)}`, tone: 'text-teal-600' },
    { label: 'Total Impostos', value: `R$ ${BRL(totais.impostos)}`, tone: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Notas emitidas no mês com totais de impostos e valores</p>
        <Button onClick={handlePrint} variant="outline" disabled={emitidas.length === 0}>
          <Printer className="w-4 h-4 mr-1" /> Imprimir Relatório
        </Button>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center justify-center gap-2 bg-card border rounded-xl p-2 w-fit mx-auto">
        <Button variant="ghost" size="icon" onClick={() => setMonthOffset((o) => o - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold w-40 text-center capitalize">
          {format(base, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setMonthOffset((o) => o + 1)} disabled={monthOffset >= 0}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground uppercase">{c.label}</p>
            <p className={`text-lg font-bold mt-1 ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando notas…</div>
        ) : emitidas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma nota emitida neste mês.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-semibold text-xs">Nº Nota</th>
                  <th className="text-left p-3 font-semibold text-xs">Pedido</th>
                  <th className="text-left p-3 font-semibold text-xs">Cliente</th>
                  <th className="text-left p-3 font-semibold text-xs">Tipo</th>
                  <th className="text-left p-3 font-semibold text-xs hidden sm:table-cell">Emissão</th>
                  <th className="text-right p-3 font-semibold text-xs">Valor Total</th>
                  <th className="text-right p-3 font-semibold text-xs hidden md:table-cell">ICMS</th>
                  <th className="text-right p-3 font-semibold text-xs hidden md:table-cell">IPI</th>
                  <th className="text-right p-3 font-semibold text-xs hidden md:table-cell">ISS</th>
                  <th className="text-right p-3 font-semibold text-xs">Impostos</th>
                </tr>
              </thead>
              <tbody>
                {emitidas.map((n) => {
                  const imp = impostosNota(n);
                  const valor = n.tipo === 'nfs' ? n.valor : n.valor_total_nfe;
                  return (
                    <tr key={n.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-medium">{n.numero || '—'}</td>
                      <td className="p-3 text-muted-foreground">{n.order_number || '—'}</td>
                      <td className="p-3">{n.client_name || '—'}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{n.tipo === 'nfs' ? 'NFS-e' : 'NF-e'}</Badge></td>
                      <td className="p-3 text-muted-foreground hidden sm:table-cell">{n.data_emissao ? format(parseISO(n.data_emissao), 'dd/MM/yyyy') : '—'}</td>
                      <td className="p-3 text-right font-medium">R$ {BRL(valor)}</td>
                      <td className="p-3 text-right hidden md:table-cell">{n.tipo === 'nfs' ? '—' : `R$ ${BRL(n.valor_icms)}`}</td>
                      <td className="p-3 text-right hidden md:table-cell">{n.tipo === 'nfs' ? '—' : `R$ ${BRL(n.valor_ipi)}`}</td>
                      <td className="p-3 text-right hidden md:table-cell">{n.tipo === 'nfe' ? '—' : `R$ ${BRL(n.valor_iss)}`}</td>
                      <td className="p-3 text-right font-semibold text-orange-600">R$ {BRL(imp)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 bg-orange-50/50">
                  <td colSpan={5} className="p-3 font-bold text-right">TOTAIS</td>
                  <td className="p-3 text-right font-bold">R$ {BRL(totais.valorNotas)}</td>
                  <td className="p-3 text-right font-bold hidden md:table-cell">R$ {BRL(totais.icms)}</td>
                  <td className="p-3 text-right font-bold hidden md:table-cell">R$ {BRL(totais.ipi)}</td>
                  <td className="p-3 text-right font-bold hidden md:table-cell">R$ {BRL(totais.iss)}</td>
                  <td className="p-3 text-right font-bold text-orange-600">R$ {BRL(totais.impostos)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}