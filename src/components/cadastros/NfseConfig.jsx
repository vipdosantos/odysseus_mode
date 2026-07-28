import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function NfseConfig() {
  const qc = useQueryClient();
  const [homologacao, setHomologacao] = useState('');
  const [producao, setProducao] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ['nfse_config'],
    queryFn: async () => {
      const r = await base44.entities.EmpresaConfig.filter({ tipo: 'nfse_config' }, '-created_date', 1);
      return r[0] || null;
    },
  });

  React.useEffect(() => {
    if (cfg?.valor) {
      try {
        const urls = JSON.parse(cfg.valor);
        setHomologacao(urls.homologacao || '');
        setProducao(urls.producao || '');
      } catch { setHomologacao(cfg.valor); }
    }
  }, [cfg?.id]);

  const handleSave = async () => {
    setSaving(true);
    const valor = JSON.stringify({ homologacao, producao });
    try {
      if (cfg?.id) await base44.entities.EmpresaConfig.update(cfg.id, { tipo: 'nfse_config', valor });
      else await base44.entities.EmpresaConfig.create({ tipo: 'nfse_config', valor });
      qc.invalidateQueries({ queryKey: ['nfse_config'] });
      toast.success('Configuração da NFS-e salva!');
    } catch (e) {
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const isValid = !!(homologacao || producao);

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/30">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isValid ? 'bg-green-100' : 'bg-yellow-100'}`}>
          {isValid ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-yellow-600" />}
        </div>
        <div>
          <p className="text-sm font-semibold">{isValid ? 'Webservice municipal configurado' : 'Nenhum webservice configurado'}</p>
          {isValid && <p className="text-xs text-muted-foreground truncate">{homologacao || producao}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="mb-1 block">URL do Webservice — Homologação</Label>
          <Input
            value={homologacao}
            onChange={e => setHomologacao(e.target.value)}
            placeholder="https://homologacao.../NfseWSService.svc"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Usada no ambiente de testes (padrão ao transmitir).</p>
        </div>
        <div>
          <Label className="mb-1 block">URL do Webservice — Produção</Label>
          <Input
            value={producao}
            onChange={e => setProducao(e.target.value)}
            placeholder="https://.../NfseWSService.svc"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Usada quando transmitir em ambiente de produção.</p>
        </div>

        <Button onClick={handleSave} disabled={saving || (!homologacao && !producao)} className="w-full bg-primary text-primary-foreground">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Building2 className="w-4 h-4 mr-2" /> Salvar Configuração</>}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        A NFS-e é transmitida ao webservice da prefeitura (padrão ABRASF). Cadastre a URL fornecida pela sua prefeitura.
        O certificado digital (e-CNPJ A1) cadastrado na aba anterior é usado para assinar o RPS.
      </p>
    </div>
  );
}