import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { canEdit } from '@/lib/userPermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Headphones, Plus, Search, Monitor, Printer, Wifi, Keyboard, Package, AlertTriangle,
  CheckCircle2, Clock, Loader2, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS = {
  hardware: { label: 'Hardware', icon: Monitor, color: 'bg-blue-100 text-blue-700' },
  software: { label: 'Software', icon: Package, color: 'bg-purple-100 text-purple-700' },
  rede: { label: 'Rede/Internet', icon: Wifi, color: 'bg-cyan-100 text-cyan-700' },
  impressora: { label: 'Impressora', icon: Printer, color: 'bg-amber-100 text-amber-700' },
  periferico: { label: 'Periférico', icon: Keyboard, color: 'bg-teal-100 text-teal-700' },
  outros: { label: 'Outros', icon: AlertTriangle, color: 'bg-gray-100 text-gray-700' },
};

const STATUS = {
  aberto: { label: 'Aberto', icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200' },
  em_andamento: { label: 'Em Andamento', icon: Loader2, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolvido: { label: 'Resolvido', icon: CheckCircle2, color: 'bg-green-100 text-green-700 border-green-200' },
  fechado: { label: 'Fechado', icon: XCircle, color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const PRIORIDADE = {
  baixa: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

const emptyForm = {
  titulo: '', solicitante_nome: '', solicitante_email: '', categoria: 'hardware',
  equipamento: '', local: '', descricao: '', prioridade: 'media',
};

export default function ChamadosTI() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const editable = canEdit(user, '/chamados-ti');

  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: chamados = [], isLoading } = useQuery({
    queryKey: ['chamados-ti'],
    queryFn: () => base44.entities.ChamadoTI.list('-created_date', 200)
  });

  const filtered = useMemo(() => {
    return chamados.filter(c => {
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (filtroCategoria !== 'todas' && c.categoria !== filtroCategoria) return false;
      if (search) {
        const q = search.toLowerCase();
        const blob = `${c.titulo} ${c.solicitante_nome} ${c.equipamento} ${c.local} ${c.descricao || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [chamados, search, filtroStatus, filtroCategoria]);

  const stats = useMemo(() => ({
    total: chamados.length,
    abertos: chamados.filter(c => c.status === 'aberto').length,
    andamento: chamados.filter(c => c.status === 'em_andamento').length,
    resolvidos: chamados.filter(c => c.status === 'resolvido').length,
  }), [chamados]);

  const openNew = () => {
    setForm({ ...emptyForm, solicitante_nome: user?.full_name || '', solicitante_email: user?.email || '' });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.titulo.trim() || !form.solicitante_nome.trim()) {
      toast({ title: 'Preencha título e solicitante', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.ChamadoTI.create(form);
      await qc.invalidateQueries({ queryKey: ['chamados-ti'] });
      toast({ title: 'Chamado aberto', description: form.titulo });
      setDialogOpen(false);
    } catch (e) {
      toast({ title: 'Erro ao abrir chamado', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status, extra = {}) => {
    try {
      const patch = { status, ...extra };
      if (status === 'resolvido' && !extra.resolvido_em) {
        patch.resolvido_em = new Date().toISOString().slice(0, 10);
      }
      await base44.entities.ChamadoTI.update(id, patch);
      await qc.invalidateQueries({ queryKey: ['chamados-ti'] });
      toast({ title: 'Chamado atualizado' });
      setDetailOpen(null);
    } catch (e) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-20 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Chamados de TI</h1>
            <p className="text-sm text-muted-foreground">Abertura e acompanhamento de suporte de informática</p>
          </div>
        </div>
        {editable && (
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Abrir Chamado
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} icon={Headphones} color="bg-slate-100 text-slate-700" />
        <StatCard label="Abertos" value={stats.abertos} icon={AlertTriangle} color="bg-red-100 text-red-700" />
        <StatCard label="Em Andamento" value={stats.andamento} icon={Clock} color="bg-amber-100 text-amber-700" />
        <StatCard label="Resolvidos" value={stats.resolvidos} icon={CheckCircle2} color="bg-green-100 text-green-700" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, solicitante, equipamento, local..."
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {Object.entries(CATEGORIAS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Headphones className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Nenhum chamado encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(c => {
            const cat = CATEGORIAS[c.categoria] || CATEGORIAS.outros;
            const st = STATUS[c.status] || STATUS.aberto;
            const CatIcon = cat.icon;
            const StIcon = st.icon;
            return (
              <button
                key={c.id}
                onClick={() => setDetailOpen(c)}
                className="text-left bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cat.color)}>
                      <CatIcon className="w-4 h-4" />
                    </span>
                    <Badge variant="outline" className={cn('border', st.color)}>
                      <StIcon className="w-3 h-3 mr-1" /> {st.label}
                    </Badge>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', PRIORIDADE[c.prioridade] || PRIORIDADE.media)}>
                    {c.prioridade}
                  </span>
                </div>
                <h3 className="font-semibold text-sm mb-1 line-clamp-1">{c.titulo}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.descricao || '—'}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span><strong>Solicitante:</strong> {c.solicitante_nome}</span>
                  {c.equipamento && <span><strong>Equip:</strong> {c.equipamento}</span>}
                  {c.local && <span><strong>Local:</strong> {c.local}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New ticket dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abrir Chamado de TI</DialogTitle>
            <DialogDescription>Descreva o problema com o equipamento/sistema para a equipe de TI.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: PC não liga / internet caiu / impressora atolou" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Solicitante *</Label>
                <Input value={form.solicitante_nome} onChange={(e) => setForm({ ...form, solicitante_nome: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.solicitante_email} onChange={(e) => setForm({ ...form, solicitante_email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria *</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIAS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Equipamento</Label>
                <Input value={form.equipamento} onChange={(e) => setForm({ ...form, equipamento: e.target.value })} placeholder="Hostname, tag, modelo" />
              </div>
              <div>
                <Label>Local</Label>
                <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Setor / sala" />
              </div>
            </div>
            <div>
              <Label>Descrição do problema</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="O que aconteceu? Quando? Já tentou alguma solução?"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Abrir Chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailOpen} onOpenChange={(o) => !o && setDetailOpen(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailOpen && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-primary" /> {detailOpen.titulo}
                </DialogTitle>
                <DialogDescription>
                  Aberto em {new Date(detailOpen.created_date).toLocaleString('pt-BR')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={STATUS[detailOpen.status]?.color}>
                    {STATUS[detailOpen.status]?.label}
                  </Badge>
                  <Badge className={PRIORIDADE[detailOpen.prioridade]}>{detailOpen.prioridade}</Badge>
                  <Badge variant="secondary">{CATEGORIAS[detailOpen.categoria]?.label}</Badge>
                </div>
                <Field label="Solicitante" value={`${detailOpen.solicitante_nome}${detailOpen.solicitante_email ? ` — ${detailOpen.solicitante_email}` : ''}`} />
                <Field label="Equipamento" value={detailOpen.equipamento || '—'} />
                <Field label="Local" value={detailOpen.local || '—'} />
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <p className="mt-1 whitespace-pre-wrap bg-muted/50 rounded-md p-3">{detailOpen.descricao || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Técnico responsável</Label>
                  <Input
                    defaultValue={detailOpen.tecnico_nome || ''}
                    onBlur={(e) => updateStatus(detailOpen.id, detailOpen.status, { tecnico_nome: e.target.value })}
                    placeholder="Atribuir técnico"
                    disabled={!editable}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Solução / Diagnóstico</Label>
                  <Textarea
                    defaultValue={detailOpen.solucao || ''}
                    onBlur={(e) => updateStatus(detailOpen.id, detailOpen.status, { solucao: e.target.value })}
                    placeholder="Descreva a solução aplicada"
                    rows={3}
                    disabled={!editable}
                  />
                </div>
              </div>
              {editable && (
                <DialogFooter className="flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => updateStatus(detailOpen.id, 'em_andamento')}>
                    <Loader2 className="w-4 h-4" /> Em Andamento
                  </Button>
                  <Button variant="default" size="sm" onClick={() => updateStatus(detailOpen.id, 'resolvido')}>
                    <CheckCircle2 className="w-4 h-4" /> Resolver
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => updateStatus(detailOpen.id, 'fechado')}>
                    <XCircle className="w-4 h-4" /> Fechar
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
      <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="font-medium">{value}</p>
    </div>
  );
}