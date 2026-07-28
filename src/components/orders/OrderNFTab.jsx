import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Printer, Save, CheckCircle2, Plus, Trash2, FileText, Send, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { DEFAULT_EMITENTE, recalcular, calcularTotaisNFe } from '@/lib/nfTax';
import { buildDanfeHtml, buildNfseHtml } from '@/lib/nfPrintLayouts';

const UF_LIST = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const camposNumericos = ['valor', 'aliquota_iss', 'deducoes', 'valor_frete', 'valor_seguro', 'outras_despesas', 'base_calculo_icms_st', 'valor_icms_st', 'qtde_volumes', 'peso_bruto', 'peso_liquido'];

export default function OrderNFTab({ order }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [transmitting, setTransmitting] = useState(false);
  const { data: existingNotes = [] } = useQuery({
    queryKey: ['fiscal_notes', order?.id],
    queryFn: () => base44.entities.FiscalNote.filter({ order_id: order.id }),
    enabled: !!order?.id,
  });
  const existingNote = existingNotes[0] || null;

  const [nf, setNf] = useState(() => buildInitial(order));

  useEffect(() => {
    if (existingNote) setNf(n => ({ ...n, ...existingNote }));
  }, [existingNote?.id]);

  // Recálculo automático de impostos quando itens/tipo/valores mudam.
  const nfCalc = useMemo(() => recalcular(nf), [nf]);

  const save = useMutation({
    mutationFn: (d) => existingNote
      ? base44.entities.FiscalNote.update(existingNote.id, d)
      : base44.entities.FiscalNote.create(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal_notes'] }),
  });

  const f = (k, v) => setNf(prev => recalcular({ ...prev, [k]: v }));
  const fNum = (k) => (e) => f(k, Number(e.target.value) || 0);

  const setItem = (idx, field, value) => {
    const itens = [...(nf.itens || [])];
    itens[idx] = { ...itens[idx], [field]: value };
    setNf(prev => recalcular({ ...prev, itens }));
  };
  const addItem = () => setNf(prev => recalcular({ ...prev, itens: [...(prev.itens || []), novoItem()] }));
  const removeItem = (idx) => setNf(prev => recalcular({ ...prev, itens: (prev.itens || []).filter((_, i) => i !== idx) }));

  const handleSave = () => save.mutate(nfCalc);

  const handlePrint = () => {
    const html = nfCalc.tipo === 'nfe' ? buildDanfeHtml(nfCalc, order) : buildNfseHtml(nfCalc, order);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const [downloading, setDownloading] = useState(false);
  const [transmittingNfse, setTransmittingNfse] = useState(false);

  const handleTransmitNfse = async () => {
    if (!existingNote?.id) { toast({ title: 'Salve a nota antes de transmitir', variant: 'destructive' }); return; }
    if (nf.tipo !== 'nfs') { toast({ title: 'Transmissão municipal disponível apenas para NFS-e', variant: 'destructive' }); return; }
    setTransmittingNfse(true);
    try {
      const res = await base44.functions.invoke('emitirNFSe', { fiscalNoteId: existingNote.id, ambiente: 2 });
      const data = res?.data || res;
      if (data?.ok) toast({ title: 'NFS-e autorizada!', description: `Nº ${data.numero}` });
      else toast({ title: 'Erro na transmissão', description: data?.error || 'Falha', variant: 'destructive' });
      qc.invalidateQueries({ queryKey: ['fiscal_notes'] });
    } catch (e) {
      toast({ title: 'Erro na transmissão', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setTransmittingNfse(false);
    }
  };
  const handleTransmit = async () => {
    if (!existingNote?.id) { toast({ title: 'Salve a nota antes de transmitir', variant: 'destructive' }); return; }
    if (nf.tipo !== 'nfe') { toast({ title: 'Transmissão SEFAZ disponível apenas para NF-e', variant: 'destructive' }); return; }
    setTransmitting(true);
    try {
      const res = await base44.functions.invoke('emitirNFe', { fiscalNoteId: existingNote.id, ambiente: 2 });
      const data = res?.data || res;
      if (data?.cStat === '100' || data?.cStat === '150') {
        toast({ title: 'NF-e autorizada pela SEFAZ', description: `Protocolo ${data.protocolo}` });
      } else if (data?.error) {
        toast({ title: 'Erro na transmissão', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: `SEFAZ: ${data?.cStat || ''} — ${data?.xMotivo || ''}`, variant: 'destructive' });
      }
      qc.invalidateQueries({ queryKey: ['fiscal_notes'] });
    } catch (e) {
      toast({ title: 'Erro na transmissão', description: e.message, variant: 'destructive' });
    } finally {
      setTransmitting(false);
    }
  };

  const handleDownloadXml = async () => {
    if (!existingNote?.id) { toast({ title: 'Salve a nota antes de gerar o XML', variant: 'destructive' }); return; }
    if (nf.tipo !== 'nfe') { toast({ title: 'Geração de XML disponível apenas para NF-e', variant: 'destructive' }); return; }
    setDownloading(true);
    try {
      const res = await base44.functions.invoke('gerarXmlNFe', { fiscalNoteId: existingNote.id, ambiente: 2 });
      const data = res?.data || res;
      if (data?.error) { toast({ title: 'Erro ao gerar XML', description: data.error, variant: 'destructive' }); return; }
      const blob = new Blob([data.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NFe-${data.chave || existingNote.numero}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'XML gerado e assinado', description: `Chave ${data.chave?.slice(-12) || ''}` });
    } catch (e) {
      toast({ title: 'Erro ao gerar XML', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const isNFe = nf.tipo === 'nfe';

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
        <span>Prévia conforme layout da Receita Federal (DANFE/NFS-e). Para validade fiscal, transmita via emissor SEFAZ/municipal homologado.</span>
      </div>

      <Section title="Identificação da Nota">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nº da Nota"><Input value={nf.numero} onChange={e => f('numero', e.target.value)} /></Field>
          <Field label="Tipo de Nota">
            <Select value={nf.tipo} onValueChange={v => f('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nfe">NF-e (Produto)</SelectItem>
                <SelectItem value="nfs">NFS-e (Serviço)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data de Emissão"><Input type="date" value={nf.data_emissao} onChange={e => f('data_emissao', e.target.value)} /></Field>
          <Field label="Status">
            <Select value={nf.status} onValueChange={v => f('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="emitida">Emitida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Natureza da Operação"><Input value={nf.natureza} onChange={e => f('natureza', e.target.value)} /></Field>
          <Field label="CFOP"><Input value={nf.cfop} onChange={e => f('cfop', e.target.value)} placeholder="5.102" /></Field>
          <Field label={isNFe ? 'Chave de Acesso (44 dígitos)' : 'Protocolo Municipal'}>
            <Input value={isNFe ? nf.chave_acesso : nf.protocolo} onChange={e => f(isNFe ? 'chave_acesso' : 'protocolo', e.target.value)} />
          </Field>
          <Field label="Inscrição Municipal Emitente"><Input value={nf.emitente_im} onChange={e => f('emitente_im', e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Emitente">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Razão Social"><Input value={nf.emitente_razao} onChange={e => f('emitente_razao', e.target.value)} /></Field>
          <Field label="CNPJ"><Input value={nf.emitente_cnpj} onChange={e => f('emitente_cnpj', e.target.value)} /></Field>
          <Field label="IE"><Input value={nf.emitente_ie} onChange={e => f('emitente_ie', e.target.value)} /></Field>
          <Field label="Endereço"><Input value={nf.emitente_endereco} onChange={e => f('emitente_endereco', e.target.value)} /></Field>
          <Field label="Bairro"><Input value={nf.emitente_bairro} onChange={e => f('emitente_bairro', e.target.value)} /></Field>
          <Field label="Município"><Input value={nf.emitente_municipio} onChange={e => f('emitente_municipio', e.target.value)} /></Field>
          <Field label="UF"><UFSelect value={nf.emitente_uf} onChange={v => f('emitente_uf', v)} /></Field>
          <Field label="CEP"><Input value={nf.emitente_cep} onChange={e => f('emitente_cep', e.target.value)} /></Field>
          <Field label="Telefone"><Input value={nf.emitente_fone} onChange={e => f('emitente_fone', e.target.value)} /></Field>
        </div>
      </Section>

      <Section title={isNFe ? 'Destinatário' : 'Tomador de Serviço'}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nome / Razão Social"><Input value={nf.client_name} onChange={e => f('client_name', e.target.value)} /></Field>
          <Field label="CNPJ / CPF"><Input value={nf.cliente_cnpj} onChange={e => f('cliente_cnpj', e.target.value)} placeholder="000.000.000-00" /></Field>
          <Field label="IE"><Input value={nf.cliente_ie} onChange={e => f('cliente_ie', e.target.value)} /></Field>
          <Field label="IM"><Input value={nf.cliente_im} onChange={e => f('cliente_im', e.target.value)} /></Field>
          <Field label="Endereço"><Input value={nf.cliente_endereco} onChange={e => f('cliente_endereco', e.target.value)} /></Field>
          <Field label="Bairro"><Input value={nf.cliente_bairro} onChange={e => f('cliente_bairro', e.target.value)} /></Field>
          <Field label="Município"><Input value={nf.cliente_municipio} onChange={e => f('cliente_municipio', e.target.value)} /></Field>
          <Field label="UF"><UFSelect value={nf.cliente_uf} onChange={v => f('cliente_uf', v)} /></Field>
          <Field label="CEP"><Input value={nf.cliente_cep} onChange={e => f('cliente_cep', e.target.value)} /></Field>
          <Field label="Telefone"><Input value={nf.cliente_fone} onChange={e => f('cliente_fone', e.target.value)} /></Field>
          <Field label="E-mail"><Input value={nf.cliente_email} onChange={e => f('cliente_email', e.target.value)} /></Field>
        </div>
      </Section>

      {isNFe ? (
        <Section title="Itens da NF-e" action={<Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Item</Button>}>
          <div className="space-y-2">
            {(nf.itens || []).map((it, idx) => (
              <div key={idx} className="border border-border rounded-lg p-2 bg-muted/30">
                <div className="grid grid-cols-6 gap-2 text-xs">
                  <Field label="Código"><Input value={it.codigo || ''} onChange={e => setItem(idx, 'codigo', e.target.value)} /></Field>
                  <Field label="NCM"><Input value={it.ncm || ''} onChange={e => setItem(idx, 'ncm', e.target.value)} placeholder="0000.00.00" /></Field>
                  <Field label="CST"><Input value={it.cst || '00'} onChange={e => setItem(idx, 'cst', e.target.value)} /></Field>
                  <Field label="CFOP"><Input value={it.cfop || ''} onChange={e => setItem(idx, 'cfop', e.target.value)} /></Field>
                  <Field label="Un."><Input value={it.unidade || 'UN'} onChange={e => setItem(idx, 'unidade', e.target.value)} /></Field>
                  <Field label="Qtd."><Input type="number" value={it.quantidade || 0} onChange={e => setItem(idx, 'quantidade', Number(e.target.value) || 0)} /></Field>
                </div>
                <div className="grid grid-cols-6 gap-2 text-xs mt-2">
                  <div className="col-span-2"><Field label="Descrição"><Input value={it.descricao || ''} onChange={e => setItem(idx, 'descricao', e.target.value)} /></Field></div>
                  <Field label="Vlr. Unit."><Input type="number" value={it.valor_unitario || 0} onChange={e => setItem(idx, 'valor_unitario', Number(e.target.value) || 0)} /></Field>
                  <Field label="Desc."><Input type="number" value={it.valor_desconto || 0} onChange={e => setItem(idx, 'valor_desconto', Number(e.target.value) || 0)} /></Field>
                  <Field label="Alíq. ICMS %"><Input type="number" value={it.aliquota_icms || 0} onChange={e => setItem(idx, 'aliquota_icms', Number(e.target.value) || 0)} /></Field>
                  <Field label="Alíq. IPI %"><Input type="number" value={it.aliquota_ipi || 0} onChange={e => setItem(idx, 'aliquota_ipi', Number(e.target.value) || 0)} /></Field>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    Vlr. item: R$ {(it.valor_item || ((it.quantidade || 0) * (it.valor_unitario || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ·
                    ICMS: R$ {(it.valor_icms || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(idx)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
            {(!nf.itens || nf.itens.length === 0) && <p className="text-xs text-muted-foreground text-center py-2">Nenhum item. Clique em "Item" para adicionar.</p>}
          </div>
        </Section>
      ) : (
        <Section title="Discriminação do Serviço">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código do Serviço"><Input value={nf.codigo_servico} onChange={e => f('codigo_servico', e.target.value)} /></Field>
            <Field label="Item da Lista (LC 116/03)"><Input value={nf.item_lista_servico} onChange={e => f('item_lista_servico', e.target.value)} /></Field>
            <Field label="Código Tributação Município"><Input value={nf.codigo_tributacao_municipio} onChange={e => f('codigo_tributacao_municipio', e.target.value)} /></Field>
            <Field label="Natureza"><Input value={nf.natureza} onChange={e => f('natureza', e.target.value)} /></Field>
          </div>
          <Field label="Discriminação dos Serviços"><Textarea value={nf.descricao} onChange={e => f('descricao', e.target.value)} rows={2} /></Field>
        </Section>
      )}

      <Section title="Cálculo de Impostos">
        {isNFe ? (
          <div className="grid grid-cols-3 gap-3">
            <ReadOnly label="Base Cálculo ICMS" value={nfCalc.base_calculo_icms} />
            <ReadOnly label="Valor ICMS" value={nfCalc.valor_icms} />
            <Field label="Alíquota ICMS ST %"><Input type="number" value={nf.aliquota_iss} onChange={e => f('aliquota_iss', Number(e.target.value) || 0)} /></Field>
            <Field label="Base Cálculo ICMS ST"><Input type="number" value={nf.base_calculo_icms_st} onChange={fNum('base_calculo_icms_st')} /></Field>
            <Field label="Valor ICMS ST"><Input type="number" value={nf.valor_icms_st} onChange={fNum('valor_icms_st')} /></Field>
            <ReadOnly label="Valor IPI" value={nfCalc.valor_ipi} />
            <ReadOnly label="Valor dos Produtos" value={nfCalc.valor_produtos} />
            <Field label="Valor Desconto"><Input type="number" value={nf.valor_desconto} onChange={fNum('valor_desconto')} /></Field>
            <Field label="Valor Frete"><Input type="number" value={nf.valor_frete} onChange={fNum('valor_frete')} /></Field>
            <Field label="Valor Seguro"><Input type="number" value={nf.valor_seguro} onChange={fNum('valor_seguro')} /></Field>
            <Field label="Outras Despesas"><Input type="number" value={nf.outras_despesas} onChange={fNum('outras_despesas')} /></Field>
            <ReadOnly label="Valor Total da Nota" value={nfCalc.valor_total_nfe} highlight />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor dos Serviços"><Input type="number" value={nf.valor} onChange={e => f('valor', Number(e.target.value) || 0)} /></Field>
            <Field label="Deduções"><Input type="number" value={nf.deducoes} onChange={fNum('deducoes')} /></Field>
            <Field label="Alíquota ISS %"><Input type="number" value={nf.aliquota_iss} onChange={e => f('aliquota_iss', Number(e.target.value) || 0)} /></Field>
            <ReadOnly label="Base de Cálculo ISS" value={nfCalc.base_calculo_iss} />
            <ReadOnly label="Valor ISS" value={nfCalc.valor_iss} />
            <ReadOnly label="Valor Líquido" value={nfCalc.valor_liquido_nfs} highlight />
            <div className="flex items-center gap-2 col-span-3 pt-1">
              <Switch checked={!!nf.iss_retido} onCheckedChange={v => f('iss_retido', v)} />
              <Label className="text-xs">ISS Retido pelo Tomador</Label>
            </div>
          </div>
        )}
      </Section>

      {isNFe && (
        <Section title="Transporte">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Modalidade do Frete">
              <Select value={nf.modalidade_frete || '0'} onValueChange={v => f('modalidade_frete', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Por conta do emitente</SelectItem>
                  <SelectItem value="1">Por conta do destinatário</SelectItem>
                  <SelectItem value="2">Por conta de terceiros</SelectItem>
                  <SelectItem value="9">Sem frete</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Transportadora"><Input value={nf.transportadora_nome} onChange={e => f('transportadora_nome', e.target.value)} /></Field>
            <Field label="CNPJ Transportadora"><Input value={nf.transportadora_cnpj} onChange={e => f('transportadora_cnpj', e.target.value)} /></Field>
            <Field label="Placa do Veículo"><Input value={nf.placa_veiculo} onChange={e => f('placa_veiculo', e.target.value)} /></Field>
            <Field label="UF da Placa"><UFSelect value={nf.uf_placa} onChange={v => f('uf_placa', v)} /></Field>
            <Field label="Qtd. Volumes"><Input type="number" value={nf.qtde_volumes} onChange={fNum('qtde_volumes')} /></Field>
            <Field label="Espécie"><Input value={nf.especie} onChange={e => f('especie', e.target.value)} /></Field>
            <Field label="Peso Bruto (kg)"><Input type="number" value={nf.peso_bruto} onChange={fNum('peso_bruto')} /></Field>
            <Field label="Peso Líquido (kg)"><Input type="number" value={nf.peso_liquido} onChange={fNum('peso_liquido')} /></Field>
          </div>
        </Section>
      )}

      {isNFe && (
        <Section title="Pagamento">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Forma de Pagamento">
              <Select value={nf.forma_pagamento || '0'} onValueChange={v => f('forma_pagamento', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">À vista</SelectItem>
                  <SelectItem value="1">A prazo</SelectItem>
                  <SelectItem value="2">Outros</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Condição de Pagamento"><Input value={nf.condicao_pagamento} onChange={e => f('condicao_pagamento', e.target.value)} /></Field>
          </div>
        </Section>
      )}

      {!isNFe && (
        <Section title="Dados do RPS">
          <div className="grid grid-cols-3 gap-3">
            <Field label="RPS Nº"><Input value={nf.rps_numero} onChange={e => f('rps_numero', e.target.value)} /></Field>
            <Field label="Série"><Input value={nf.rps_serie} onChange={e => f('rps_serie', e.target.value)} /></Field>
            <Field label="Tipo">
              <Select value={nf.rps_tipo || '1'} onValueChange={v => f('rps_tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">RPS</SelectItem>
                  <SelectItem value="2">RPS Cupom</SelectItem>
                  <SelectItem value="3">Cupom</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Competência"><Input type="date" value={nf.competencia} onChange={e => f('competencia', e.target.value)} /></Field>
            <Field label="Protocolo de Autorização"><Input value={nf.protocolo} onChange={e => f('protocolo', e.target.value)} /></Field>
          </div>
        </Section>
      )}

      <Section title="Observações / Informações Complementares">
        <Textarea value={nf.observacoes} onChange={e => f('observacoes', e.target.value)} rows={2} />
      </Section>

      <div className="pt-2 border-t flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{isNFe ? 'Valor Total da Nota' : 'Valor Líquido NFS-e'}</p>
          <p className="text-xl font-bold text-primary">
            {(isNFe ? nfCalc.valor_total_nfe : nfCalc.valor_liquido_nfs).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          {isNFe ? (
            <>
              <Button variant="outline" onClick={handleDownloadXml} disabled={downloading} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                <Download className="w-4 h-4 mr-1" /> {downloading ? 'Gerando...' : 'Baixar XML'}
              </Button>
              <Button variant="outline" onClick={handleTransmit} disabled={transmitting} className="border-green-300 text-green-700 hover:bg-green-50">
                <Send className="w-4 h-4 mr-1" /> {transmitting ? 'Transmitindo...' : 'Transmitir SEFAZ'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleTransmitNfse} disabled={transmittingNfse} className="border-green-300 text-green-700 hover:bg-green-50">
              <Send className="w-4 h-4 mr-1" /> {transmittingNfse ? 'Transmitindo...' : 'Transmitir NFS-e'}
            </Button>
          )}
          <Button onClick={handlePrint} className="bg-primary text-primary-foreground">
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──
function buildInitial(order) {
  const itens = (order?.items || []).map((it, idx) => ({
    codigo: it.qr_code_id || `${order.order_number}-${idx}`,
    ncm: '',
    cst: '00',
    cfop: '5.102',
    descricao: [it.size, it.truss_type].filter(Boolean).join(' '),
    unidade: 'UN',
    quantidade: Number(it.quantity) || 0,
    valor_unitario: 0,
    valor_desconto: 0,
    valor_frete: 0,
    base_calculo_icms: 0,
    aliquota_icms: 0,
    valor_icms: 0,
    aliquota_ipi: 0,
    valor_ipi: 0,
  }));
  return recalcular({
    ...DEFAULT_EMITENTE,
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
    itens,
    modalidade_frete: '0',
    forma_pagamento: '0',
    rps_serie: 'A1',
    rps_tipo: '1',
  });
}

function novoItem() {
  return { codigo: '', ncm: '', cst: '00', cfop: '5.102', descricao: '', unidade: 'UN', quantidade: 1, valor_unitario: 0, valor_desconto: 0, aliquota_icms: 0, aliquota_ipi: 0 };
}

function Section({ title, action, children }) {
  return (
    <div className="border border-border rounded-xl p-3 bg-card">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnly({ label, value, highlight }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className={`h-9 flex items-center px-3 rounded-md border border-border text-sm ${highlight ? 'bg-primary/10 font-bold text-primary' : 'bg-muted/40'}`}>
        {(Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </div>
    </div>
  );
}

function UFSelect({ value, onChange }) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
      <SelectContent>
        {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}