import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Printer, FileText, Save, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const COMPANY = {
  razao_social: 'Modelajes Indústria Ltda',
  cnpj: '00.000.000/0001-00',
  endereco: 'Rua das Treliças, 123 - São Paulo/SP',
  fone: '(11) 99999-9999',
};

export default function OrderNFTab({ order }) {
  const qc = useQueryClient();

  const { data: existingNotes = [] } = useQuery({
    queryKey: ['fiscal_notes', order?.id],
    queryFn: () => base44.entities.FiscalNote.filter({ order_id: order.id }),
    enabled: !!order?.id,
  });

  const existingNote = existingNotes[0] || null;

  const [nf, setNf] = useState({
    order_id: order?.id || '',
    order_number: order?.order_number || '',
    client_name: order?.client_name || '',
    numero: `NF-${order?.order_number || '000'}`,
    natureza: 'Venda de Mercadoria',
    cfop: '5.102',
    tipo: 'nfs',
    cliente_cnpj: '',
    cliente_ie: '',
    descricao: order?.items?.map(i => `${i.size} x ${i.quantity} un`).join(', ') || '',
    valor: order?.total_value || 0,
    aliquota_iss: 5,
    data_emissao: new Date().toISOString().split('T')[0],
    status: 'rascunho',
  });

  useEffect(() => {
    if (existingNote) setNf(existingNote);
  }, [existingNote?.id]);

  const save = useMutation({
    mutationFn: (d) => existingNote
      ? base44.entities.FiscalNote.update(existingNote.id, d)
      : base44.entities.FiscalNote.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal_notes'] }),
  });

  const f = (k, v) => setNf(prev => ({ ...prev, [k]: v }));

  const handlePrint = () => {
    const valorFmt = Number(nf.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const issValor = (Number(nf.valor) * nf.aliquota_iss / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const html = `<html><head><title>NF ${nf.numero}</title>
    <style>body{font-family:Arial;font-size:12px;margin:24px;color:#111}
    .header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #F47920;padding-bottom:12px;margin-bottom:16px}
    h2{color:#F47920;font-size:14px;margin:12px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .label{color:#666;font-size:10px}.value{font-weight:bold}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#f5f5f5;padding:6px;text-align:left;font-size:10px}
    td{padding:6px;border-bottom:1px solid #eee}</style></head><body>
    <div class="header">
      <div style="background:#F47920;border-radius:8px;width:48px;height:48px;display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><path d="M6 32 L6 12 L20 26 L34 12 L34 32" stroke="white" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/></svg>
      </div>
      <div>
        <h1 style="color:#2B3A8F;font-size:22px;margin:0">MODELAJES</h1>
        <div style="font-size:10px;color:#666">${COMPANY.razao_social} | CNPJ: ${COMPANY.cnpj}</div>
        <div style="font-size:10px;color:#666">${COMPANY.endereco}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:18px;font-weight:bold;color:#2B3A8F">${nf.tipo === 'nfs' ? 'NFS-e' : 'NF-e'}</div>
        <div style="font-size:14px;font-weight:bold">${nf.numero}</div>
        <div style="font-size:10px;color:#666">Emissão: ${new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
    <h2>Cliente</h2>
    <div class="grid2">
      <div><div class="label">Nome/Razão Social</div><div class="value">${order.client_name}</div></div>
      <div><div class="label">Telefone</div><div class="value">${order.client_phone || '—'}</div></div>
      <div><div class="label">CPF/CNPJ</div><div class="value">${nf.cliente_cnpj || '—'}</div></div>
      <div><div class="label">IE</div><div class="value">${nf.cliente_ie || '—'}</div></div>
    </div>
    <h2>Discriminação</h2>
    <table><tr><th>Descrição</th><th>Pedido</th><th>CFOP</th><th>Valor</th></tr>
    <tr><td>${nf.descricao}</td><td>#${order.order_number}</td><td>${nf.cfop}</td><td>${valorFmt}</td></tr></table>
    <h2>Natureza: ${nf.natureza}</h2>
    <h2>Totais</h2>
    <div class="grid2">
      <div><div class="label">Valor</div><div style="font-size:18px;font-weight:bold;color:#F47920">${valorFmt}</div></div>
      <div><div class="label">ISS/ICMS (${nf.aliquota_iss}%)</div><div class="value">${issValor}</div></div>
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
    <div className="space-y-4 mt-4">
      {existingNote && (
        <div className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          NF já registrada — Status: <strong className="capitalize">{existingNote.status}</strong>
        </div>
      )}

      <div className="flex gap-2 items-center bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <FileText className="w-4 h-4 shrink-0" />
        <span>Prévia para impressão interna. Para emissão com validade fiscal, use emissor SEFAZ homologado.</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Nº da Nota</Label>
          <Input value={nf.numero} onChange={e => f('numero', e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={nf.tipo} onValueChange={v => f('tipo', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nfs">NFS-e (Serviço)</SelectItem>
              <SelectItem value="nfe">NF-e (Produto)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Data de Emissão</Label>
          <Input type="date" value={nf.data_emissao} onChange={e => f('data_emissao', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={nf.status} onValueChange={v => f('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="emitida">Emitida</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">CFOP</Label>
          <Input value={nf.cfop} onChange={e => f('cfop', e.target.value)} placeholder="5.102" />
        </div>
        <div>
          <Label className="text-xs">Alíquota ISS/ICMS (%)</Label>
          <Input type="number" value={nf.aliquota_iss} onChange={e => f('aliquota_iss', Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Natureza da Operação</Label>
          <Input value={nf.natureza} onChange={e => f('natureza', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">CPF / CNPJ do Cliente</Label>
          <Input value={nf.cliente_cnpj} onChange={e => f('cliente_cnpj', e.target.value)} placeholder="000.000.000-00" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Discriminação dos Serviços / Produtos</Label>
          <Textarea value={nf.descricao} onChange={e => f('descricao', e.target.value)} rows={2} />
        </div>
        <div>
          <Label className="text-xs">Valor Total (R$)</Label>
          <Input type="number" value={nf.valor} onChange={e => f('valor', Number(e.target.value))} />
        </div>
      </div>

      <div className="pt-2 border-t flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">ISS ({nf.aliquota_iss}%)</p>
          <p className="text-sm font-semibold">
            {(Number(nf.valor) * nf.aliquota_iss / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Valor Total</p>
          <p className="text-xl font-bold text-primary">
            {Number(nf.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save.mutate(nf)} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button onClick={handlePrint} className="bg-primary text-primary-foreground">
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>
    </div>
  );
}