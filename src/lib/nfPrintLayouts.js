// Layouts de impressão oficiais: DANFE (NF-e) e NFS-e, conforme padrão SEFAZ / Receita Federal.
// Recebem o objeto da nota (já recalculado) e o pedido, devolvem o HTML completo para impressão.

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v, d = 4) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '');

export function buildDanfeHtml(nf, order) {
  const emit = {
    razao: nf.emitente_razao || 'MODELAJES',
    cnpj: nf.emitente_cnpj || '',
    ie: nf.emitente_ie || '',
    im: nf.emitente_im || '',
    endereco: [nf.emitente_endereco, nf.emitente_numero].filter(Boolean).join(', '),
    bairro: nf.emitente_bairro || '',
    municipio: nf.emitente_municipio || '',
    uf: nf.emitente_uf || '',
    cep: nf.emitente_cep || '',
    fone: nf.emitente_fone || '',
  };
  const dest = {
    nome: order?.client_name || nf.client_name || '',
    cnpj: nf.cliente_cnpj || '',
    ie: nf.cliente_ie || '',
    im: nf.cliente_im || '',
    endereco: [nf.cliente_endereco, nf.cliente_numero].filter(Boolean).join(', '),
    complemento: nf.cliente_complemento || '',
    bairro: nf.cliente_bairro || '',
    municipio: nf.cliente_municipio || '',
    uf: nf.cliente_uf || '',
    cep: nf.cliente_cep || '',
    fone: nf.cliente_fone || '',
    pais: nf.cliente_pais || 'Brasil',
  };
  const modFrete = {
    '0': 'Por conta do emitente', '1': 'Por conta do destinatário', '2': 'Por conta de terceiros', '3': 'Próprio', '9': 'Sem frete',
  }[nf.modalidade_frete] || 'Por conta do emitente';
  const formaPgto = { '0': 'À vista', '1': 'A prazo', '2': 'Outros' }[nf.forma_pagamento] || 'À vista';

  const linhasItens = (nf.itens || []).map((it, i) => `
    <tr>
      <td>${it.codigo || i + 1}</td>
      <td>${it.ncm || ''}</td>
      <td>${it.cst || '00'}</td>
      <td>${it.cfop || nf.cfop || ''}</td>
      <td class="desc">${it.descricao || ''}</td>
      <td class="n">${it.unidade || 'UN'}</td>
      <td class="n">${fmtNum(it.quantidade)}</td>
      <td class="n">${fmtNum(it.valor_unitario, 2)}</td>
      <td class="n">${fmtNum(it.valor_desconto, 2)}</td>
      <td class="n">${fmtNum(it.base_calculo_icms, 2)}</td>
      <td class="n">${fmtNum(it.aliquota_icms, 2)}</td>
      <td class="n">${fmtNum(it.valor_icms, 2)}</td>
      <td class="n">${fmtNum(it.valor_ipi, 2)}</td>
      <td class="n">${fmtNum(it.valor_item + it.valor_ipi, 2)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>DANFE ${nf.numero}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 8px; color: #000; margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 0.4mm solid #000; padding: 1mm 1.5mm; vertical-align: top; }
    th { background: #f0f0f0; font-weight: bold; font-size: 7px; }
    .n { text-align: right; }
    .desc { text-align: left; }
    .titulo { font-size: 9px; font-weight: bold; text-transform: uppercase; }
    .label { font-size: 6.5px; color: #444; }
    .box { border: 0.4mm solid #000; padding: 1mm 1.5mm; }
    .grid8 { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0; }
    .grid8 > div { padding: 0.5mm 1mm; border-right: 0.4mm solid #000; }
    .grid8 > div:last-child { border-right: none; }
    .row { display: flex; gap: 0; }
    .row > .box { flex: 1; border-left: none; }
    .row > .box:first-child { border-left: 0.4mm solid #000; }
    h2 { font-size: 8px; margin: 1.5mm 0 0.5mm; padding: 0.6mm 1mm; background: #e8e8e8; border: 0.4mm solid #000; }
    .itens th { font-size: 6.5px; }
    .itens td { font-size: 7.5px; }
    .logo { font-size: 16px; font-weight: bold; color: #2B3A8F; }
    .small { font-size: 6.5px; }
  </style></head><body>

  <!-- Cabeçalho -->
  <table>
    <tr>
      <td style="width:42mm;text-align:center">
        <div class="logo">M</div>
        <div class="titulo">${emit.razao}</div>
        <div class="small">${emit.endereco}</div>
        <div class="small">${emit.bairro} - ${emit.municipio}/${emit.uf}</div>
        <div class="small">CEP: ${emit.cep} - Fone: ${emit.fone}</div>
      </td>
      <td style="width:42mm;text-align:center">
        <div class="titulo" style="font-size:11px">DANFE</div>
        <div class="small">DOCUMENTO AUXILIAR DA NF-e</div>
        <div style="font-size:10px;font-weight:bold;margin-top:1mm">Nº ${nf.numero}</div>
        <div class="small">SÉRIE 001</div>
        <div style="font-size:7px;letter-spacing:1px;margin-top:1mm;font-family:monospace">${nf.chave_acesso || ''}</div>
      </td>
      <td style="width:38mm;text-align:center">
        <div class="titulo">NF-e</div>
        <div class="small">${fmtDate(nf.data_emissao)}</div>
        <div class="small">PROTOCOLO</div>
        <div style="font-size:7px">${nf.protocolo || ''}</div>
      </td>
    </tr>
  </table>

  <!-- Natureza / CFOP -->
  <table><tr>
    <td style="width:70%"><span class="label">NATUREZA DA OPERAÇÃO</span><br>${nf.natureza || ''}</td>
    <td><span class="label">CFOP</span><br>${nf.cfop || ''}</td>
    <td><span class="label">INSC. ESTADUAL</span><br>${emit.ie}</td>
    <td><span class="label">INSC. MUNICIPAL</span><br>${emit.im}</td>
    <td><span class="label">CNPJ</span><br>${emit.cnpj}</td>
  </tr></table>

  <!-- Destinatário / Remetente -->
  <h2>DESTINATÁRIO / REMETENTE</h2>
  <table><tr>
    <td style="width:40%"><span class="label">NOME / RAZÃO SOCIAL</span><br>${dest.nome}</td>
    <td style="width:18%"><span class="label">CNPJ / CPF</span><br>${dest.cnpj}</td>
    <td style="width:14%"><span class="label">DATA EMISSÃO</span><br>${fmtDate(nf.data_emissao)}</td>
    <td style="width:14%"><span class="label">IE / RG</span><br>${dest.ie}</td>
    <td style="width:14%"><span class="label">IM</span><br>${dest.im}</td>
  </tr></table>
  <table><tr>
    <td style="width:42%"><span class="label">ENDEREÇO</span><br>${dest.endereco}</td>
    <td style="width:12%"><span class="label">BAIRRO / DISTRITO</span><br>${dest.bairro}</td>
    <td style="width:10%"><span class="label">CEP</span><br>${dest.cep}</td>
    <td style="width:16%"><span class="label">MUNICÍPIO</span><br>${dest.municipio}</td>
    <td style="width:4%"><span class="label">UF</span><br>${dest.uf}</td>
    <td style="width:10%"><span class="label">FONE / FAX</span><br>${dest.fone}</td>
    <td style="width:6%"><span class="label">PAÍS</span><br>${dest.pais}</td>
  </tr></table>

  <!-- Itens -->
  <h2>DADOS DO PRODUTO / SERVIÇO</h2>
  <table class="itens">
    <tr>
      <th style="width:8mm">CÓD.</th><th style="width:11mm">NCM/SH</th><th style="width:7mm">CST</th>
      <th style="width:10mm">CFOP</th><th>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
      <th style="width:8mm">UN.</th><th style="width:13mm">QTD.</th><th style="width:15mm">VLR. UNIT.</th>
      <th style="width:12mm">DESC.</th><th style="width:15mm">BC ICMS</th>
      <th style="width:9mm">ALÍQ.</th><th style="width:12mm">VLR. ICMS</th>
      <th style="width:12mm">VLR. IPI</th><th style="width:16mm">VLR. TOTAL</th>
    </tr>
    ${linhasItens}
  </table>

  <!-- Totais -->
  <h2>CÁLCULO DO IMPOSTO</h2>
  <table><tr>
    <td><span class="label">BASE CÁLC. ICMS</span><br>${fmtBRL(nf.base_calculo_icms)}</td>
    <td><span class="label">VLR. ICMS</span><br>${fmtBRL(nf.valor_icms)}</td>
    <td><span class="label">BC CÁLC. ICMS ST</span><br>${fmtBRL(nf.base_calculo_icms_st)}</td>
    <td><span class="label">VLR. ICMS ST</span><br>${fmtBRL(nf.valor_icms_st)}</td>
    <td><span class="label">VLR. IPI</span><br>${fmtBRL(nf.valor_ipi)}</td>
  </tr></table>
  <table><tr>
    <td><span class="label">VLR. PRODUTOS</span><br>${fmtBRL(nf.valor_produtos)}</td>
    <td><span class="label">VLR. FRETE</span><br>${fmtBRL(nf.valor_frete)}</td>
    <td><span class="label">VLR. SEGURO</span><br>${fmtBRL(nf.valor_seguro)}</td>
    <td><span class="label">OUTRAS DESPESAS</span><br>${fmtBRL(nf.outras_despesas)}</td>
    <td><span class="label">VLR. DESCONTO</span><br>${fmtBRL(nf.valor_desconto)}</td>
    <td style="background:#fff8e1"><span class="label">VLR. TOTAL NOTA</span><br><strong>${fmtBRL(nf.valor_total_nfe)}</strong></td>
  </tr></table>

  <!-- Transporte -->
  <h2>TRANSPORTADOR / VOLUMES TRANSPORTADOS</h2>
  <table><tr>
    <td><span class="label">MODALIDADE FRETE</span><br>${modFrete}</td>
    <td style="width:30%"><span class="label">RAZÃO SOCIAL</span><br>${nf.transportadora_nome || ''}</td>
    <td><span class="label">CNPJ/CPF</span><br>${nf.transportadora_cnpj || ''}</td>
    <td><span class="label">IE</span><br>${nf.transportadora_ie || ''}</td>
  </tr></table>
  <table><tr>
    <td><span class="label">ENDEREÇO</span><br>${nf.transportadora_endereco || ''}</td>
    <td><span class="label">MUNICÍPIO</span><br>${nf.transportadora_municipio || ''}</td>
    <td><span class="label">UF</span><br>${nf.transportadora_uf || ''}</td>
    <td><span class="label">PLACA</span><br>${nf.placa_veiculo || ''}</td>
    <td><span class="label">UF PLACA</span><br>${nf.uf_placa || ''}</td>
  </tr></table>
  <table><tr>
    <td><span class="label">QTDE. VOLUMES</span><br>${nf.qtde_volumes || 0}</td>
    <td><span class="label">ESPÉCIE</span><br>${nf.especie || ''}</td>
    <td><span class="label">PESO BRUTO (kg)</span><br>${fmtNum(nf.peso_bruto, 3)}</td>
    <td><span class="label">PESO LÍQUIDO (kg)</span><br>${fmtNum(nf.peso_liquido, 3)}</td>
  </tr></table>

  <!-- Pagamento -->
  <h2>COBRANÇA / FORMA DE PAGAMENTO</h2>
  <table><tr>
    <td><span class="label">FORMA DE PAGAMENTO</span><br>${formaPgto}</td>
    <td><span class="label">CONDIÇÃO DE PAGAMENTO</span><br>${nf.condicao_pagamento || ''}</td>
    <td><span class="label">VALOR</span><br>${fmtBRL(nf.valor_total_nfe)}</td>
  </tr></table>

  ${nf.observacoes ? `<h2>INFORMAÇÕES COMPLEMENTARES</h2><div class="box">${nf.observacoes}</div>` : ''}

  <div style="margin-top:6mm;text-align:center;font-size:7px;color:#666">
    Prévia do DANFE gerada pelo sistema Modelajes. Para validade fiscal, transmita via emissor SEFAZ homologado.
  </div>
  <script>setTimeout(()=>window.print(),400)</script>
  </body></html>`;
}

export function buildNfseHtml(nf, order) {
  const emit = {
    razao: nf.emitente_razao || 'MODELAJES',
    cnpj: nf.emitente_cnpj || '',
    im: nf.emitente_im || '',
    endereco: [nf.emitente_endereco, nf.emitente_numero].filter(Boolean).join(', '),
    municipio: nf.emitente_municipio || '',
    uf: nf.emitente_uf || '',
    fone: nf.emitente_fone || '',
  };
  const tomador = {
    nome: order?.client_name || nf.client_name || '',
    cnpj: nf.cliente_cnpj || '',
    im: nf.cliente_im || '',
    endereco: [nf.cliente_endereco, nf.cliente_numero].filter(Boolean).join(', '),
    bairro: nf.cliente_bairro || '',
    municipio: nf.cliente_municipio || '',
    uf: nf.cliente_uf || '',
    cep: nf.cliente_cep || '',
    email: nf.cliente_email || '',
    fone: nf.cliente_fone || '',
  };

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>NFS-e ${nf.numero}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 0.3mm solid #999; padding: 1.2mm 2mm; vertical-align: top; }
    th { background: #f3f3f3; font-weight: bold; font-size: 9px; text-align: left; }
    .label { font-size: 8px; color: #666; }
    .valor { font-size: 11px; font-weight: bold; }
    h2 { font-size: 11px; margin: 2.5mm 0 0.8mm; padding: 1mm 2mm; background: #f0f0f0; border: 0.3mm solid #999; }
    .total { background: #fff8e1; }
    .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 0.6mm solid #2B3A8F; padding-bottom: 2mm; margin-bottom: 3mm; }
    .selo { border: 0.4mm solid #2B3A8F; border-radius: 2mm; padding: 2mm 3mm; text-align: center; color: #2B3A8F; }
    .selo .num { font-size: 14px; font-weight: bold; }
  </style></head><body>

  <div class="topo">
    <div>
      <div style="font-size:18px;font-weight:bold;color:#2B3A8F">${emit.razao}</div>
      <div class="label">CNPJ: ${emit.cnpj} — IM: ${emit.im}</div>
      <div class="label">${emit.endereco} — ${emit.municipio}/${emit.uf} — Fone: ${emit.fone}</div>
    </div>
    <div class="selo">
      <div style="font-size:9px">NOTA FISCAL DE SERVIÇO ELETRÔNICA</div>
      <div class="num">NFS-e Nº ${nf.numero}</div>
      <div class="label">Competência: ${fmtDate(nf.competencia || nf.data_emissao)}</div>
    </div>
  </div>

  <h2>DADOS DO RPS</h2>
  <table><tr>
    <th>RPS Nº</th><td>${nf.rps_numero || ''}</td>
    <th>Série</th><td>${nf.rps_serie || ''}</td>
    <th>Tipo</th><td>${({ '1': 'RPS', '2': 'RPS Cupom', '3': 'Cupom' })[nf.rps_tipo] || ''}</td>
    <th>Data Emissão</th><td>${fmtDate(nf.data_emissao)}</td>
  </tr></table>

  <h2>TOMADOR DE SERVIÇOS</h2>
  <table><tr>
    <th style="width:40%">Razão Social / Nome</th><td>${tomador.nome}</td>
    <th>CNPJ / CPF</th><td>${tomador.cnpj}</td>
  </tr></table>
  <table><tr>
    <th style="width:40%">Endereço</th><td>${tomador.endereco} — ${tomador.bairro}</td>
    <th>Município/UF</th><td>${tomador.municipio}/${tomador.uf}</td>
  </tr></table>
  <table><tr>
    <th style="width:40%">CEP</th><td>${tomador.cep}</td>
    <th>E-mail / Fone</th><td>${tomador.email} ${tomador.fone ? '/ ' + tomador.fone : ''}</td>
  </tr></table>

  <h2>DISCRIMINAÇÃO DO SERVIÇO</h2>
  <table>
    <tr><th style="width:20%">Código do Serviço</th><td>${nf.codigo_servico || ''}</td>
        <th style="width:20%">Item LC 116/03</th><td>${nf.item_lista_servico || ''}</td></tr>
    <tr><th>Código Trib. Município</th><td>${nf.codigo_tributacao_municipio || ''}</td>
        <th>Natureza</th><td>${nf.natureza || 'Prestação de Serviço'}</td></tr>
  </table>
  <table><tr><th>Discriminação</th><td style="min-height:14mm">${nf.descricao || ''}</td></tr></table>

  <h2>VALORES E TRIBUTOS</h2>
  <table>
    <tr><th>Valor dos Serviços</th><td class="valor">${fmtBRL(nf.valor)}</td>
        <th>Deduções</th><td>${fmtBRL(nf.deducoes)}</td></tr>
    <tr><th>Base de Cálculo</th><td>${fmtBRL(nf.base_calculo_iss)}</td>
        <th>Alíquota ISS</th><td>${fmtNum(nf.aliquota_iss, 2)}%</td></tr>
    <tr><th>Valor ISS</th><td>${fmtBRL(nf.valor_iss)}</td>
        <th>ISS Retido</th><td>${nf.iss_retido ? 'Sim' : 'Não'}</td></tr>
    <tr class="total"><th>Valor Líquido</th><td class="valor">${fmtBRL(nf.valor_liquido_nfs)}</td>
        <th>Valor Total</th><td class="valor">${fmtBRL(nf.valor)}</td></tr>
  </table>

  ${nf.observacoes ? `<h2>OBSERVAÇÕES</h2><table><tr><td>${nf.observacoes}</td></tr></table>` : ''}

  ${nf.protocolo ? `<h2>PROTOCOLO DE AUTORIZAÇÃO</h2><table><tr><th>Nº</th><td>${nf.protocolo}</td><th>Data</th><td>${fmtDate(nf.data_emissao)}</td></tr></table>` : ''}

  <div style="margin-top:6mm;text-align:center;font-size:8px;color:#666">
    Prévia da NFS-e gerada pelo sistema Modelajes. Para validade fiscal, transmita via emissor municipal homologado.
  </div>
  <script>setTimeout(()=>window.print(),400)</script>
  </body></html>`;
}