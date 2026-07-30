import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import CadastroTable from '@/components/cadastros/CadastroTable';
import SellerPriceTables from '@/components/cadastros/SellerPriceTables';
import ProductsWithCategory from '@/components/cadastros/ProductsWithCategory';
import CertificadoDigital from '@/components/cadastros/CertificadoDigital';
import NfseConfig from '@/components/cadastros/NfseConfig';

// ─── Clientes ───────────────────────────────────────────────
const clientFields = [
  { key: 'name', label: 'Nome', fullWidth: true },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'cpf_cnpj', label: 'CPF / CNPJ' },
  { key: 'city', label: 'Cidade' },
  { key: 'address', label: 'Endereço', fullWidth: true },
  { key: 'notes', label: 'Observações', fullWidth: true },
];
const clientColumns = [
  { key: 'name', label: 'Nome' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'city', label: 'Cidade' },
];

// ─── Vendedores ─────────────────────────────────────────────
const sellerFields = [
  { key: 'name', label: 'Nome', fullWidth: true },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'commission_rate', label: 'Comissão (%)', type: 'number', default: 0 },
  { key: 'active', label: 'Ativo', type: 'boolean', default: true },
  { key: 'notes', label: 'Observações', fullWidth: true },
];
const sellerColumns = [
  { key: 'name', label: 'Nome' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'commission_rate', label: 'Comissão', render: (v) => v ? `${v}%` : '0%' },
  { key: 'active', label: 'Ativo', render: (v) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {v !== false ? 'Ativo' : 'Inativo'}
    </span>
  )},
];

// ─── Fornecedores ────────────────────────────────────────────
const supplierFields = [
  { key: 'name', label: 'Nome', fullWidth: true },
  { key: 'contact_person', label: 'Contato' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'category', label: 'Categoria', type: 'select', default: 'material',
    enum: ['material', 'servico', 'transporte', 'outros'],
    enumLabels: { material: 'Material', servico: 'Serviço', transporte: 'Transporte', outros: 'Outros' }
  },
  { key: 'active', label: 'Ativo', type: 'boolean', default: true },
  { key: 'notes', label: 'Observações', fullWidth: true },
];
const supplierColumns = [
  { key: 'name', label: 'Nome' },
  { key: 'contact_person', label: 'Contato' },
  { key: 'phone', label: 'Telefone' },
  { key: 'category', label: 'Categoria', render: (v) => {
    const map = { material: 'Material', servico: 'Serviço', transporte: 'Transporte', outros: 'Outros' };
    return map[v] || v || '—';
  }},
  { key: 'active', label: 'Ativo', render: (v) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {v !== false ? 'Ativo' : 'Inativo'}
    </span>
  )},
];

// ─── Categorias de Insumo ────────────────────────────────────
const supplyCatFields = [
  { key: 'name', label: 'Nome da Categoria', fullWidth: true },
  { key: 'code', label: 'Código' },
  { key: 'color', label: 'Cor (hex)', default: '#6b7280' },
  { key: 'active', label: 'Ativo', type: 'boolean', default: true },
];
const supplyCatColumns = [
  { key: 'name', label: 'Nome' },
  { key: 'code', label: 'Código' },
  { key: 'color', label: 'Cor', render: (v) => (
    <span className="flex items-center gap-2">
      <span className="w-4 h-4 rounded-full inline-block border" style={{ background: v || '#6b7280' }} />
      <span className="text-xs font-mono">{v || '—'}</span>
    </span>
  )},
  { key: 'active', label: 'Ativo', render: (v) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {v !== false ? 'Ativo' : 'Inativo'}
    </span>
  )},
];

// ─── Tipos de Caminhão ───────────────────────────────────────
const truckFields = [
  { key: 'name', label: 'Nome', fullWidth: true },
  { key: 'code', label: 'Código (ex: toco, carreta)', default: '' },
  { key: 'capacity_kg', label: 'Capacidade (kg)', type: 'number', default: 0 },
  { key: 'active', label: 'Ativo', type: 'boolean', default: true },
  { key: 'notes', label: 'Observações', fullWidth: true },
];
const truckColumns = [
  { key: 'name', label: 'Nome' },
  { key: 'code', label: 'Código' },
  { key: 'capacity_kg', label: 'Capacidade', render: (v) => v ? `${Number(v).toLocaleString('pt-BR')} kg` : '—' },
  { key: 'active', label: 'Ativo', render: (v) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {v !== false ? 'Ativo' : 'Inativo'}
    </span>
  )},
];

// ─── Dimensões de EPS/Lajota ─────────────────────────────────
const epsFields = [
  { key: 'tipo_laje', label: 'Tipo de Laje', default: 'Laje',
    enum: ['Laje', 'Painel'] },
  { key: 'truss_type', label: 'Tipo de Treliça', default: 'H8',
    enum: ['H8', 'H12', 'H16', 'H20', 'H25', 'H30'] },
  { key: 'tipo_enchimento', label: 'Tipo de Enchimento', default: 'EPS',
    enum: ['EPS', 'Lajota'] },
  { key: 'dimension', label: 'Dimensão', fullWidth: true, default: '' },
  { key: 'active', label: 'Ativo', type: 'boolean', default: true },
];
const epsColumns = [
  { key: 'tipo_laje', label: 'Tipo de Laje' },
  { key: 'truss_type', label: 'Treliça' },
  { key: 'tipo_enchimento', label: 'Enchimento' },
  { key: 'dimension', label: 'Dimensão' },
  { key: 'active', label: 'Ativo', render: (v) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {v !== false ? 'Ativo' : 'Inativo'}
    </span>
  )},
];

// Produtos gerenciados pelo componente ProductsWithCategory

export default function Cadastros() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">Gerencie clientes, vendedores, fornecedores, produtos e mais</p>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="tabelas">Tabelas de Preço</TabsTrigger>
          <TabsTrigger value="caminhoes">Tipos de Caminhão</TabsTrigger>
          <TabsTrigger value="cat-insumos">Cat. Produtos</TabsTrigger>
          <TabsTrigger value="eps">Dimensões EPS</TabsTrigger>
          <TabsTrigger value="certificado">Certificado Digital</TabsTrigger>
          <TabsTrigger value="nfse">NFS-e</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes">
          <CadastroTable
            entity={base44.entities.Client}
            entityKey="clients"
            title="Cliente"
            fields={clientFields}
            columns={clientColumns}
          />
        </TabsContent>

        <TabsContent value="vendedores">
          <CadastroTable
            entity={base44.entities.Seller}
            entityKey="sellers"
            title="Vendedor"
            fields={sellerFields}
            columns={sellerColumns}
          />
        </TabsContent>

        <TabsContent value="fornecedores">
          <CadastroTable
            entity={base44.entities.Supplier}
            entityKey="suppliers"
            title="Fornecedor"
            fields={supplierFields}
            columns={supplierColumns}
          />
        </TabsContent>

        <TabsContent value="produtos">
          <ProductsWithCategory />
        </TabsContent>

        <TabsContent value="tabelas">
          <SellerPriceTables />
        </TabsContent>

        <TabsContent value="caminhoes">
          <CadastroTable
            entity={base44.entities.TruckType}
            entityKey="truck_types"
            title="Tipo de Caminhão"
            fields={truckFields}
            columns={truckColumns}
          />
        </TabsContent>

        <TabsContent value="cat-insumos">
          <CadastroTable
            entity={base44.entities.SupplyCategory}
            entityKey="supply_categories"
            title="Categoria de Produto"
            fields={supplyCatFields}
            columns={supplyCatColumns}
          />
        </TabsContent>

        <TabsContent value="eps">
          <CadastroTable
            entity={base44.entities.EpsDimension}
            entityKey="eps_dimensions"
            title="Dimensão"
            fields={epsFields}
            columns={epsColumns}
          />
        </TabsContent>

        <TabsContent value="certificado">
          <CertificadoDigital />
        </TabsContent>

        <TabsContent value="nfse">
          <NfseConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}