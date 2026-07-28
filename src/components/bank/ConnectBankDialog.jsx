import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Shield, KeyRound, FileKey, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const INTEGRATIONS = [
  { value: 'bradesco_api_banking', label: 'Bradesco API Banking' },
  { value: 'belvo', label: 'Belvo (Open Finance)' },
  { value: 'pluggy', label: 'Pluggy (Open Finance)' },
];

export default function ConnectBankDialog({ account, onClose }) {
  const qc = useQueryClient();
  const [integration, setIntegration] = useState(account?.integration_type && account.integration_type !== 'nenhum' ? account.integration_type : 'bradesco_api_banking');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [certName, setCertName] = useState('');
  const [certUrl, setCertUrl] = useState('');
  const [certPass, setCertPass] = useState('');
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      // 1. salva credenciais/certificado em EmpresaConfig (vinculado à conta)
      const cfgTipo = `banco_api_${account.id}`;
      const existing = await base44.entities.EmpresaConfig.filter({ tipo: cfgTipo });
      const payload = {
        tipo: cfgTipo,
        valor: JSON.stringify({ integration, client_id: clientId, client_secret: clientSecret }),
        arquivo_url: certUrl || '',
        arquivo_nome: certName || '',
        senha_certificado: certPass || '',
      };
      if (existing.length > 0) {
        await base44.entities.EmpresaConfig.update(existing[0].id, payload);
      } else {
        await base44.entities.EmpresaConfig.create(payload);
      }
      // 2. marca a conta com a integração escolhida (status conectado quando credenciais preenchidas)
      const conectado = !!(clientId && clientSecret);
      await base44.entities.BankAccount.update(account.id, {
        integration_type: integration,
        sync_status: conectado ? 'conectado' : 'desconectado',
        last_sync_at: conectado ? new Date().toISOString() : '',
        sync_error: conectado ? '' : 'Credenciais incompletas',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_accounts'] });
      qc.invalidateQueries({ queryKey: ['empresa-config-api'] });
      toast.success('Credenciais salvas para esta conta.');
      onClose();
    },
    onError: (e) => toast.error('Erro ao salvar: ' + (e?.message || e)),
  });

  const handleCert = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCertUrl(file_url);
      setCertName(file.name);
      toast.success('Certificado enviado.');
    } catch (err) {
      toast.error('Falha no upload do certificado');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Conectar API do Banco
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Conta: <span className="font-medium text-foreground">{account?.label}</span>
        </p>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Provedor / Integração</Label>
            <Select value={integration} onValueChange={setIntegration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTEGRATIONS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><KeyRound className="w-3 h-3" /> Client ID</Label>
            <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID (OAuth)" className="font-mono text-xs" />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><KeyRound className="w-3 h-3" /> Client Secret</Label>
            <Input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Client Secret" className="font-mono text-xs" />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><FileKey className="w-3 h-3" /> Certificado Digital (mTLS .pfx/.pem)</Label>
            <label className="flex items-center gap-2 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/40">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1 truncate">
                {uploading ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</span> : (certName || 'Selecionar arquivo do certificado')}
              </span>
              <input type="file" accept=".pfx,.pem,.cer,.crt,.key" className="hidden" onChange={handleCert} disabled={uploading} />
            </label>
            {certUrl && <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Certificado carregado</p>}
          </div>

          <div>
            <Label className="text-xs">Senha do Certificado</Label>
            <Input type="password" value={certPass} onChange={e => setCertPass(e.target.value)} placeholder="Senha do .pfx" className="font-mono text-xs" />
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>As credenciais ficam salvas com esta conta. A sincronização real (extrato/PIX) é ativada após validarmos o acesso com o banco.</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending || uploading}>
              {save.isPending ? <span className="flex items-center gap-1"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</span> : 'Salvar Credenciais'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}