import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users as UsersIcon, UserPlus, Shield, Trash2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const roleLabels = {
  admin: { label: 'Administrador', class: 'bg-red-100 text-red-700' },
  operador: { label: 'Operador', class: 'bg-blue-100 text-blue-700' },
  financeiro: { label: 'Financeiro', class: 'bg-green-100 text-green-700' },
  vendedor: { label: 'Vendedor', class: 'bg-purple-100 text-purple-700' },
  visualizador: { label: 'Visualizador', class: 'bg-gray-100 text-gray-600' },
};

const roleDescriptions = [
  { role: 'admin', label: 'Administrador', color: 'bg-red-100 text-red-700 border-red-200', desc: 'Acesso total: gerencia usuários, aprova ordens, acessa financeiro, cadastros e todas as telas.' },
  { role: 'operador', label: 'Operador', color: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Acessa produção, scanner de QR, pedidos e calendário de entregas. Sem acesso financeiro.' },
  { role: 'financeiro', label: 'Financeiro', color: 'bg-green-100 text-green-700 border-green-200', desc: 'Acessa financeiro, contas a receber, notas fiscais, ordens de compra e aprovações.' },
  { role: 'vendedor', label: 'Vendedor', color: 'bg-purple-100 text-purple-700 border-purple-200', desc: 'Vê apenas seus próprios pedidos. Pode criar pedidos, mas não acessa financeiro ou produção.' },
  { role: 'visualizador', label: 'Visualizador', color: 'bg-gray-100 text-gray-600 border-gray-200', desc: 'Apenas visualiza pedidos e dashboard. Não pode criar, editar ou excluir nada.' },
];

export default function Users() {
  const { user } = useOutletContext();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('visualizador');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showRoles, setShowRoles] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuário removido!'); setDeleteTarget(null); },
    onError: () => toast.error('Não foi possível remover o usuário.'),
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    await base44.users.inviteUser(inviteEmail, inviteRole === 'admin' ? 'admin' : 'user');
    toast.success('Convite enviado!');
    setShowInvite(false);
    setInviteEmail('');
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">Acesso Restrito</p>
        <p className="text-muted-foreground">Apenas administradores podem gerenciar usuários</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os acessos do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRoles(!showRoles)}>
            <Info className="w-4 h-4 mr-1" /> Níveis de Acesso
          </Button>
          <Button onClick={() => setShowInvite(true)} className="bg-primary text-primary-foreground">
            <UserPlus className="w-4 h-4 mr-1" /> Convidar
          </Button>
        </div>
      </div>

      {showRoles && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {roleDescriptions.map(r => (
            <div key={r.role} className={cn("rounded-xl border p-4 space-y-1", r.color)}>
              <p className="font-semibold text-sm">{r.label}</p>
              <p className="text-xs opacity-80">{r.desc}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Usuário</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Função</th>
              <th className="text-right p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const r = roleLabels[u.role] || roleLabels.visualizador;
              return (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{u.full_name || '—'}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium", r.class)}>{r.label}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Select
                        value={u.role || 'visualizador'}
                        onValueChange={v => updateRoleMutation.mutate({ id: u.id, data: { role: v } })}
                        disabled={u.id === user?.id}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="financeiro">Financeiro</SelectItem>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="visualizador">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                      {u.id !== user?.id && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(u)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong> perderá o acesso ao sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteUserMutation.mutate(deleteTarget.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Email</Label>
              <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Função</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} className="bg-primary text-primary-foreground">Enviar Convite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}