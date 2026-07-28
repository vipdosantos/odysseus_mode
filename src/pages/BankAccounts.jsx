import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, QrCode, Landmark, CheckCircle2, RefreshCw, AlertTriangle, Link2, Link2Off } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const empty = { label: '', type: 'pix', pix_key_type: 'cnpj', pix_key: '', banco: '', agencia: '', conta: '', titular: '', cnpj_cpf: '', active: true };

export default function BankAccounts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [connectAcc, setConnectAcc] = useState(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank_accounts'],
    queryFn: () => base44.entities.BankAccount.list(),
  });

  const save = useMutation({
    mutationFn: (d) => editing ? base44.entities.BankAccount.update(editing.id, d) : base44.entities.BankAccount.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank_accounts'] }); setOpen(false); },
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.BankAccount.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_accounts'] }),
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm(a); setOpen(true); };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-sm text-muted-foreground">PIX e dados bancários usados nos pagamentos</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nova Conta</Button>
      </div>

      <div className="space-y-3">
        {accounts.length === 0 && (
          <div className="text-center text-muted-foreground py-12 border border-dashed rounded-xl">
            Nenhuma conta cadastrada. Adicione uma conta PIX ou bancária.
          </div>
        )}
        {accounts.map(acc => (
          <div key={acc.id} className="border rounded-xl p-4 bg-card flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${acc.type === 'pix' ? 'bg-green-100' : 'bg-blue-100'}`}>
              {acc.type === 'pix' ? <QrCode className="w-5 h-5 text-green-700" /> : <Landmark className="w-5 h-5 text-blue-700" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{acc.label}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${acc.type === 'pix' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {acc.type === 'pix' ? 'PIX' : 'Conta Bancária'}
                </span>
                {acc.active !== false && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
              {acc.type === 'pix' ? (
                <p className="text-sm text-muted-foreground mt-1">Chave: <span className="font-mono font-medium text-foreground">{acc.pix_key}</span> ({acc.pix_key_type})</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">{acc.banco} — Ag: {acc.agencia} | Conta: {acc.conta} | {acc.titular}</p>
              )}
              {acc.integration_type && acc.integration_type !== 'nenhum' && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className={acc.sync_status === 'conectado' ? 'text-green-700 border-green-300' : acc.sync_status === 'erro' ? 'text-red-700 border-red-300' : 'text-muted-foreground'}>
                    {acc.sync_status === 'conectado' ? <><CheckCircle2 className="w-3 h-3 mr-1" />Open Finance ativo</> : acc.sync_status === 'erro' ? <><AlertTriangle className="w-3 h-3 mr-1" />Erro</> : 'Desconectado'}
                  </Badge>
                  {acc.last_sync_at && (
                    <span className="text-xs text-muted-foreground">
                      Última sinc.: {new Date(acc.last_sync_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setConnectAcc(acc)} className="text-xs">
                {acc.sync_status === 'conectado' ? <RefreshCw className="w-3.5 h-3.5 mr-1 text-green-600" /> : <Link2 className="w-3.5 h-3.5 mr-1" />}
                {acc.sync_status === 'conectado' ? 'Sincronizar' : 'Conectar'}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(acc.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Apelido / Nome</Label>
              <Input value={form.label} onChange={e => f('label', e.target.value)} placeholder="Ex: PIX Principal, Banco do Brasil" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={v => f('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="conta_bancaria">Conta Bancária (TED/DOC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === 'pix' && (
              <>
                <div>
                  <Label className="text-xs">Tipo de Chave PIX</Label>
                  <Select value={form.pix_key_type} onValueChange={v => f('pix_key_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Chave PIX</Label>
                  <Input value={form.pix_key} onChange={e => f('pix_key', e.target.value)} placeholder="Digite a chave PIX" className="font-mono" />
                </div>
              </>
            )}

            {form.type === 'conta_bancaria' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Banco</Label>
                    <Input value={form.banco} onChange={e => f('banco', e.target.value)} placeholder="Ex: Banco do Brasil" />
                  </div>
                  <div>
                    <Label className="text-xs">Agência</Label>
                    <Input value={form.agencia} onChange={e => f('agencia', e.target.value)} placeholder="1234-5" />
                  </div>
                  <div>
                    <Label className="text-xs">Conta</Label>
                    <Input value={form.conta} onChange={e => f('conta', e.target.value)} placeholder="12345-6" />
                  </div>
                  <div>
                    <Label className="text-xs">CNPJ / CPF</Label>
                    <Input value={form.cnpj_cpf} onChange={e => f('cnpj_cpf', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Titular</Label>
                  <Input value={form.titular} onChange={e => f('titular', e.target.value)} />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={form.active !== false} onCheckedChange={v => f('active', v)} />
              <Label className="text-sm">Conta ativa</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={() => save.mutate(form)} disabled={save.isPending}>
                {save.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conectar via API Banking / Open Finance */}
      <Dialog open={!!connectAcc} onOpenChange={(o) => !o && setConnectAcc(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conectar via API Banking / Open Finance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 text-sm">
            <p className="text-muted-foreground">
              Para confirmar PIX e TED recebidos automaticamente nesta conta, é preciso contratar o acesso à API do banco.
            </p>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <p className="font-medium">O que é necessário (Bradesco API Banking):</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Contratar a API com o gerente da conta PJ</li>
                <li><code>client_id</code> e <code>client_secret</code></li>
                <li>Certificado digital para mTLS (.pfx/.pem)</li>
                <li>Escopos liberados (extrato, saldo, PIX)</li>
              </ul>
            </div>
            {connectAcc?.sync_status === 'conectado' ? (
              <p className="text-green-700 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Conta já conectada.</p>
            ) : (
              <p className="text-amber-700 flex items-start gap-1"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> A integração ainda não está ativa — aguardando credenciais do banco.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Alternativa: agregadores como Belvo ou Pluggy integram Bradesco (e outros bancos) via Open Finance, com consentimento do titular.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConnectAcc(null)}>Fechar</Button>
              <Button variant="secondary" className="flex-1" disabled>
                <Link2 className="w-4 h-4 mr-1" /> Conectar (indisponível)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}