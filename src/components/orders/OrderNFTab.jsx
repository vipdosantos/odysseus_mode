import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Printer, FileText } from 'lucide-react';

const COMPANY = {
  razao_social: 'Modelajes Indústria Ltda',
  cnpj: '00.000.000/0001-00',
  ie: '000.000.000.000',
  endereco: 'Rua das Treliças, 123 - São Paulo/SP',
  cep: '01310-100',
  fone: '(11) 99999-9999',
};

export default function OrderNFTab({ order }) {
  const [nf, setNf] = useState({
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
  });

  const f = (k, v) => setNf(prev => ({ ...prev, [k]: v }));

  const handlePrint = () => {
    const valorFmt = Number(nf.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const issValor = (Number(nf.valor) * nf.aliquota_iss / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const html = `
    <html><head><title>Nota Fiscal - ${nf.numero}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #111; }
      .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #F47920; padding-bottom: 12px; margin-bottom: 16px; }
      .logo { background: #F47920; border-radius: 8px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; }
      h1 { color: #2B3A8F; font-size: 22px; margin: 0; }
      h2 { color: #F47920; font-size: 14px; margin: 12px 0 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .field { margin-bottom: 6px; }
      .label { color: #666; font-size: 10px; }
      .value { font-weight: bold; font-size: 12px; }
      .total { font-size: 18px; font-weight: bold; color: #F47920; }
      .footer { margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px; font-size: 10px; color: #999; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #f5f5f5; padding: 6px; text-align: left; font-size: 10px; }
      td { padding: 6px; border-bottom: 1px solid #eee; }
    </style></head><body>
    <div class="header">
      <div class="logo">
        <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><path d="M6 32 L6 12 L20 26 L34 12 L34 32" stroke="white" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none"/></svg>
      </div>
      <div>
        <h1>MODELAJES</h1>
        <div style="font-size:10px;color:#666">${COMPANY.razao_social} | CNPJ: ${COMPANY.cnpj}</div>
        <div style="font-size:10px;color:#666">${COMPANY.endereco} | ${COMPANY.fone}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:18px;font-weight:bold;color:#2B3A8F">${nf.tipo === 'nfs' ? 'NFS-e' : 'NF-e'}</div>
        <div style="font-size:14px;font-weight:bold">${nf.numero}</div>
        <div style="font-size:10px;color:#666">Emissão: ${new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>

    <h2>Dados do Cliente / Tomador</h2>
    <div class="grid2">
      <div class="field"><div class="label">Nome / Razão Social</div><div class="value">${order.client_name}</div></div>
      <div class="field"><div class="label">Telefone</div><div class="value">${order.client_phone || '—'}</div></div>
      <div class="field"><div class="label">CPF / CNPJ</div><div class="value">${nf.cliente_cnpj || '—'}</div></div>
      <div class="field"><div class="label">IE</div><div class="value">${nf.cliente_ie || '—'}</div></div>
    </div>

    <h2>Discriminação dos Serviços / Produtos</h2>
    <table>
      <tr><th>Descrição</th><th>Pedido</th><th>CFOP</th><th>Valor</th></tr>
      <tr>
        <td>${nf.descricao}</td>
        <td>#${order.order_number}</td>
        <td>${nf.cfop}</td>
        <td>${valorFmt}</td>
      </tr>
    </table>

    <h2>Natureza da Operação</h2>
    <div>${nf.natureza}</div>

    <h2>Totais</h2>
    <div class="grid2">
      <div class="field"><div class="label">Valor dos Serviços / Produtos</div><div class="total">${valorFmt}</div></div>
      <div class="field"><div class="label">Alíquota ISS / ICMS</div><div class="value">${nf.aliquota_iss}%</div></div>
      <div class="field"><div class="label">Valor ISS / ICMS</div><div class="value">${issValor}</div></div>
    </div>

    <div class="footer">
      Este documento é uma prévia de Nota Fiscal gerada pelo sistema Modelajes. Para emissão oficial com validade legal, utilize um emissor NF-e/NFS-e autorizado pela SEFAZ.
    </div>
    <script>setTimeout(()=>window.print(),500)</script>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
        <FileText className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Esta é uma <strong>prévia de NF</strong> para impressão interna. Para emissão com validade fiscal, use o emissor homologado pela SEFAZ do seu estado.</span>
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
          <Label className="text-xs">CFOP</Label>
          <Input value={nf.cfop} onChange={e => f('cfop', e.target.value)} placeholder="5.102" />
        </div>
        <div>
          <Label className="text-xs">Natureza da Operação</Label>
          <Input value={nf.natureza} onChange={e => f('natureza', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Alíquota ISS/ICMS (%)</Label>
          <Input type="number" value={nf.aliquota_iss} onChange={e => f('aliquota_iss', Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">CPF / CNPJ do Cliente</Label>
          <Input value={nf.cliente_cnpj} onChange={e => f('cliente_cnpj', e.target.value)} placeholder="000.000.000-00" />
        </div>
        <div>
          <Label className="text-xs">IE do Cliente</Label>
          <Input value={nf.cliente_ie} onChange={e => f('cliente_ie', e.target.value)} placeholder="Inscrição Estadual" />
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
        <Button onClick={handlePrint} className="bg-primary text-primary-foreground">
          <Printer className="w-4 h-4 mr-2" /> Imprimir NF
        </Button>
      </div>
    </div>
  );
}