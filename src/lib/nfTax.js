// Cálculos fiscais para NF-e (ICMS/IPI) e NFS-e (ISS), conforme regras da Receita Federal.
// Funções puras — recebem o objeto da nota e devolvem os totais calculados.

export const DEFAULT_EMITENTE = {
  emitente_razao: 'Modelajes Indústria Ltda',
  emitente_cnpj: '00.000.000/0001-00',
  emitente_ie: '000.000.000.000',
  emitente_im: '0000000',
  emitente_cep: '00000-000',
  emitente_endereco: 'Rua das Treliças, 123',
  emitente_numero: '123',
  emitente_bairro: 'Centro',
  emitente_municipio: 'São Paulo',
  emitente_uf: 'SP',
  emitente_fone: '(11) 99999-9999',
};

// Calcula totais da NF-e a partir dos itens: base de cálculo, valor ICMS, IPI,
// valor dos produtos, desconto, frete, seguro, outras despesas e valor total.
export function calcularTotaisNFe(nf) {
  const itens = (nf.itens || []).map(it => {
    const quantidade = Number(it.quantidade) || 0;
    const valorUnitario = Number(it.valor_unitario) || 0;
    const valorDesconto = Number(it.valor_desconto) || 0;
    const valorFrete = Number(it.valor_frete) || 0;
    const valorBruto = quantidade * valorUnitario;
    const valorItem = valorBruto - valorDesconto;
    const aliquotaIcms = Number(it.aliquota_icms) || 0;
    const baseIcms = valorItem + valorFrete;
    const valorIcms = (baseIcms * aliquotaIcms) / 100;
    const aliquotaIpi = Number(it.aliquota_ipi) || 0;
    const valorIpi = (valorItem * aliquotaIpi) / 100;
    return {
      ...it,
      quantidade,
      valor_unitario: valorUnitario,
      valor_desconto: valorDesconto,
      valor_frete: valorFrete,
      valor_bruto: valorBruto,
      valor_item: valorItem,
      base_calculo_icms: baseIcms,
      aliquota_icms: aliquotaIcms,
      valor_icms: valorIcms,
      aliquota_ipi: aliquotaIpi,
      valor_ipi: valorIpi,
    };
  });

  const valorProdutos = itens.reduce((s, it) => s + it.valor_bruto, 0);
  const valorDesconto = itens.reduce((s, it) => s + it.valor_desconto, 0);
  const valorFrete = Number(nf.valor_frete) || 0;
  const valorSeguro = Number(nf.valor_seguro) || 0;
  const outrasDespesas = Number(nf.outras_despesas) || 0;
  const baseIcms = itens.reduce((s, it) => s + it.base_calculo_icms, 0);
  const valorIcms = itens.reduce((s, it) => s + it.valor_icms, 0);
  const valorIpi = itens.reduce((s, it) => s + it.valor_ipi, 0);
  const valorTotal = valorProdutos - valorDesconto + valorFrete + valorSeguro + outrasDespesas + valorIpi;

  return {
    ...nf,
    itens,
    valor_produtos: valorProdutos,
    valor_desconto: valorDesconto,
    valor_frete: valorFrete,
    valor_seguro: valorSeguro,
    outras_despesas: outrasDespesas,
    base_calculo_icms: baseIcms,
    valor_icms: valorIcms,
    valor_ipi: valorIpi,
    valor_total_nfe: valorTotal,
    valor: valorTotal,
  };
}

// Calcula totais da NFS-e: base de cálculo = valor serviços - deduções,
// valor ISS = base × alíquota, valor líquido = valor serviços - deduções - retenções.
export function calcularTotaisNFSe(nf) {
  const valorServicos = Number(nf.valor) || 0;
  const deducoes = Number(nf.deducoes) || 0;
  const aliquotaIss = Number(nf.aliquota_iss) || 0;
  const baseCalculo = Math.max(valorServicos - deducoes, 0);
  const valorIss = (baseCalculo * aliquotaIss) / 100;
  const valorLiquido = baseCalculo - (nf.iss_retido ? valorIss : 0);
  return {
    ...nf,
    base_calculo_iss: baseCalculo,
    valor_iss: valorIss,
    valor_liquido_nfs: valorLiquido,
  };
}

// Recalcula conforme o tipo de nota.
export function recalcular(nf) {
  return nf.tipo === 'nfe' ? calcularTotaisNFe(nf) : calcularTotaisNFSe(nf);
}