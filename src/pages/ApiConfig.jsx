import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOutletContext } from 'react-router-dom';
import { Code2, Plus, Trash2, Copy, Eye, EyeOff, Shield, Globe, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ENDPOINTS = [
  { method: 'GET', path: '/api/orders', desc: 'Lista todos os pedidos ativos', params: '?status=producao&limit=50' },
  { method: 'GET', path: '/api/orders/:id', desc: 'Detalhes de um pedido específico', params: '' },
  { method: 'GET', path: '/api/orders/status/:access_key', desc: 'Status do pedido via chave de acesso (público)', params: '' },
  { method: 'POST', path: '/api/orders', desc: 'Cria um novo pedido', params: '' },
  { method: 'PUT', path: '/api/orders/:id/status', desc: 'Atualiza status do pedido', params: '' },
  { method: 'GET', path: '/api/supplies', desc: 'Lista insumos em estoque', params: '' },
  { method: 'GET', path: '/api/clients', desc: 'Lista clientes', params: '' },
  { method: 'GET', path: '/api/receivables', desc: 'Contas a receber', params: '' },
];

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return 'mk_' + Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function ApiConfig() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [showKeys, setShowKeys] = useState({});
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const { data: configs = [] } = useQuery({
    queryKey: ['empresa-config-api'],
    queryFn: () => base44.entities.EmpresaConfig.filter({ tipo: 'api_key' }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmpresaConfig.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['empresa-config-api'] }); setNewKeyLabel(''); toast.success('Chave criada!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmpresaConfig.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['empresa-config-api'] }); toast.success('Chave removida'); },
  });

  const handleCreateKey = () => {
    if (!newKeyLabel.trim()) return;
    createMutation.mutate({
      tipo: 'api_key',
      arquivo_nome: newKeyLabel.trim(),
      valor: generateKey(),
    });
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">Acesso Restrito</p>
        <p className="text-muted-foreground">Apenas administradores podem gerenciar a API</p>
      </div>
    );
  }

  const baseUrl = window.location.origin;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Code2 className="w-6 h-6 text-primary" /> Integração via API
        </h1>
        <p className="text-sm text-muted-foreground">Conecte outros sistemas usando as chaves de API abaixo</p>
      </div>

      {/* Chaves de API */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Chaves de API</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Criar nova chave */}
          <div className="flex gap-2">
            <Input
              value={newKeyLabel}
              onChange={e => setNewKeyLabel(e.target.value)}
              placeholder="Nome da chave (ex: ERP, Parceiro...)"
              className="flex-1"
            />
            <Button onClick={handleCreateKey} disabled={!newKeyLabel.trim()} className="bg-primary text-primary-foreground shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Gerar Chave
            </Button>
          </div>

          {/* Lista de chaves */}
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma chave gerada ainda</p>
          ) : (
            <div className="space-y-2">
              {configs.map(cfg => (
                <div key={cfg.id} className="flex items-center gap-3 border rounded-xl p-3 bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cfg.arquivo_nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-muted-foreground truncate max-w-xs">
                        {showKeys[cfg.id] ? cfg.valor : '•'.repeat(20) + cfg.valor?.slice(-4)}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowKeys(prev => ({ ...prev, [cfg.id]: !prev[cfg.id] }))}>
                      {showKeys[cfg.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(cfg.valor, cfg.id)}>
                      {copiedKey === cfg.id ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(cfg.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Como usar */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Como usar a API</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-muted/40 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase">Autenticação (header)</p>
            <code className="text-xs font-mono">Authorization: Bearer {'{'}sua-chave-api{'}'}</code>
          </div>
          <div className="bg-muted/40 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase">Base URL</p>
            <code className="text-xs font-mono">{baseUrl}</code>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <strong>Nota:</strong> A API utiliza o sistema Base44 como backend. Para integração avançada com sistemas externos (ERP, WMS, etc.), configure webhooks ou use as chaves acima nos seus scripts de integração.
          </div>
        </div>
      </div>

      {/* Endpoints disponíveis */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Endpoints Disponíveis</h3>
        </div>
        <div className="divide-y">
          {ENDPOINTS.map((ep, i) => (
            <div key={i} className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
              <span className={cn("text-xs font-bold px-2 py-1 rounded font-mono shrink-0 mt-0.5", METHOD_COLORS[ep.method])}>
                {ep.method}
              </span>
              <div className="flex-1 min-w-0">
                <code className="text-sm font-mono text-foreground">{ep.path}{ep.params && <span className="text-muted-foreground">{ep.params}</span>}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{ep.desc}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-xs h-7"
                onClick={() => copyToClipboard(`${baseUrl}${ep.path}`, `ep-${i}`)}
              >
                {copiedKey === `ep-${i}` ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Exemplo de uso */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Exemplo de Requisição</h3>
        </div>
        <div className="p-4">
          <pre className="bg-muted/60 rounded-xl p-4 text-xs font-mono overflow-x-auto whitespace-pre">{`# Buscar pedidos em produção
curl -X GET \\
  "${baseUrl}/api/orders?status=producao" \\
  -H "Authorization: Bearer mk_sua_chave_aqui" \\
  -H "Content-Type: application/json"

# Resposta
{
  "data": [
    {
      "id": "abc123",
      "order_number": "0042",
      "client_name": "João Silva",
      "status": "producao",
      "items": [...]
    }
  ]
}`}</pre>
        </div>
      </div>
    </div>
  );
}