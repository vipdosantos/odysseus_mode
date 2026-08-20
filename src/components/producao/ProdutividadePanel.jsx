import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Star, ClipboardList, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const emptyForm = {
  employee_name: '',
  employee_email: '',
  date: new Date().toISOString().split('T')[0],
  order_number: '',
  activity: '',
  quantity_produced: 0,
  hours_worked: 8,
  observations: '',
  rating: 3,
};

export default function ProdutividadePanel({ user }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: logs = [] } = useQuery({
    queryKey: ['productivity_logs'],
    queryFn: () => base44.entities.ProductivityLog.list('-date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductivityLog.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['productivity_logs'] }); setDialogOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductivityLog.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productivity_logs'] }),
  });

  const openForm = () => {
    setForm({ ...emptyForm, employee_name: user?.full_name || '', employee_email: user?.email || '' });
    setDialogOpen(true);
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openForm} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-1" /> Novo Registro
        </Button>
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum registro ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Data</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Funcionário</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Atividade</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Pedido</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Qtd</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Horas</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground uppercase">Avaliação</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">{log.date ? format(parseISO(log.date), 'dd/MM/yyyy') : '—'}</td>
                    <td className="p-3 font-medium">{log.employee_name}</td>
                    <td className="p-3 max-w-xs truncate">{log.activity}</td>
                    <td className="p-3 text-muted-foreground">{log.order_number || '—'}</td>
                    <td className="p-3">{log.quantity_produced ?? '—'}</td>
                    <td className="p-3">{log.hours_worked}h</td>
                    <td className="p-3">
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= (log.rating||0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      {(user?.role === 'admin' || log.employee_email === user?.email) && (
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(log.id)} className="h-7 w-7">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Registro de Produtividade</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Funcionário</Label>
              <Input value={form.employee_name} onChange={e => f('employee_name', e.target.value)} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={e => f('date', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Atividade realizada</Label>
              <Input value={form.activity} onChange={e => f('activity', e.target.value)} placeholder="Ex: Montagem de treliças 8cm" />
            </div>
            <div>
              <Label>Pedido relacionado</Label>
              <Input value={form.order_number} onChange={e => f('order_number', e.target.value)} placeholder="PED-XXXXXX" />
            </div>
            <div>
              <Label>Quantidade produzida</Label>
              <Input type="number" value={form.quantity_produced} onChange={e => f('quantity_produced', Number(e.target.value))} />
            </div>
            <div>
              <Label>Horas trabalhadas</Label>
              <Input type="number" value={form.hours_worked} onChange={e => f('hours_worked', Number(e.target.value))} />
            </div>
            <div>
              <Label>Auto-avaliação (1–5)</Label>
              <Select value={String(form.rating)} onValueChange={v => f('rating', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} {'★'.repeat(n)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observations} onChange={e => f('observations', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(form)} className="bg-primary text-primary-foreground">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}