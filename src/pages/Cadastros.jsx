import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import CadastroTable from '@/components/cadastros/CadastroTable';
import SellerPriceTables from '@/components/cadastros/SellerPriceTables';

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

// ─── Produtos ────────────────────────────────────────────────
const productFields = [
  { key: 'name', label: 'Nome', fullWidth: true },
  { key: 'code', label: 'Código' },
  { key: 'size', label: 'Tamanho / Dimensão' },
  { key: 'unit', label: 'Unidade', default: 'un' },
  { key: 'price', label: 'Preço (R$)', type: 'number', default: 0 },
  { key: 'stock', label: 'Estoque Atual', type: 'number', default: 0 },
  { key: 'min_stock', label: 'Estoque Mínimo', type: 'number', default: 0 },
  { key: 'category', label: 'Categoria', type: 'select', default: 'trelica',
    enum: ['trelica', 'madeira', 'ferro', 'outros'],
    enumLabels: { trelica: 'Treliça', madeira: 'Madeira', ferro: 'Ferro', outros: 'Outros' }
  },
  { key: 'active', label: 'Ativo', type: 'boolean', default: true },
  { key: 'notes', label: 'Observações', fullWidth: true },
];
const productColumns = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Nome' },
  { key: 'size', label: 'Tamanho' },
  { key: 'price', label: 'Preço', render: (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—' },
  { key: 'stock', label: 'Estoque', render: (v, item) => (
    <span className={`font-medium ${v <= (item.min_stock || 0) && v >= 0 ? 'text-red-600' : ''}`}>{v ?? 0}</span>
  )},
  { key: 'active', label: 'Ativo', render: (v) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {v !== false ? 'Ativo' : 'Inativo'}
    </span>
  )},
];

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
          <CadastroTable
            entity={base44.entities.Product}
            entityKey="products"
            title="Produto"
            fields={productFields}
            columns={productColumns}
          />
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
      </Tabs>
    </div>
  );
}