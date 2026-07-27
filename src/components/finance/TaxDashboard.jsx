import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Receipt, Wallet, Landmark, Scale } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BRL = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Soma os impostos de uma nota conforme o tipo: NF-e (ICMS+IPI+ICMS-ST) ou NFS-e (ISS).
function impostosNota(n) {
  if (n.tipo === 'nfs') return Number(n.valor_iss) || 0;
  return (Number(n.valor_icms) || 0) + (Number(n.valor_ipi) || 0) + (Number(n.valor_icms_st) || 0);
}

export default function TaxDashboard({ bills = [] }) {
  const hoje = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date(hoje.getFullYear(), hoje.getMonth() + monthOffset, 1);
  const monthKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['fiscal_notes', 'tax_dashboard'],
    queryFn: () => base44.entities.FiscalNote.list('-data_emissao', 500),
  });

  const dados = useMemo(() => {
    const noMes = (d) => String(d || '').startsWith(monthKey);
    const emitidas = notas.filter((n) => n.status === 'emitida' && noMes(n.data_emissao));
    const impostosGerados = emitidas.reduce((s, n) => s + impostosNota(n), 0);
    const valorNotas = emitidas.reduce((s, n) => s + (Number(n.valor_total_nfe) || Number(n.valor) || 0), 0);

    const billsMes = bills.filter((b) => b.status !== 'cancelado' && noMes(b.due_date));
    const contasPagar = billsMes.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const impostosPagar = billsMes.filter((b) => b.category === 'imposto').reduce((s, b) => s + (Number(b.amount) || 0), 0);

    return {
      qtdNotas: emitidas.length,
      valorNotas,
      impostosGerados,
      contasPagar,
      impostosPagar,
      saldoImpostos: impostosGerados - impostosPagar,
    };
  }, [notas, bills, monthKey]);

  const cards = [
    { label: 'Impostos Gerados', value: dados.impostosGerados, icon: Receipt, tone: 'text-orange-600 bg-orange-50 border-orange-200', sub: `${dados.qtdNotas} nota(s) emitida(s)` },
    { label: 'Contas a Pagar (mês)', value: dados.contasPagar, icon: Wallet, tone: 'text-red-600 bg-red-50 border-red-200', sub: 'Todos os vencimentos' },
    { label: 'Impostos a Pagar (mês)', value: dados.impostosPagar, icon: Landmark, tone: 'text-blue-600 bg-blue-50 border-blue-200', sub: 'Contas de imposto' },
    { label: 'Saldo de Impostos', value: dados.saldoImpostos, icon: Scale, tone: dados.saldoImpostos >= 0 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-green-600 bg-green-50 border-green-200', sub: dados.saldoImpostos >= 0 ? 'A recolher / não lançado' : 'Já provisionado' },
  ];

  return (
    <div className="bg-card rounded-2xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" /> Dashboard de Impostos
          </h2>
          <p className="text-xs text-muted-foreground">Impostos das notas emitidas vs. contas a pagar</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonthOffset((o) => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium w-28 text-center capitalize">
            {format(base, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMonthOffset((o) => o + 1)} disabled={monthOffset >= 0}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border p-3 ${c.tone}`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase opacity-80">{c.label}</p>
              <c.icon className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-xl font-bold mt-1">R$ {BRL(c.value)}</p>
            <p className="text-[11px] opacity-70 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Carregando notas fiscais…</p>}
      {!isLoading && dados.qtdNotas === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma nota emitida neste mês.</p>
      )}
    </div>
  );
}