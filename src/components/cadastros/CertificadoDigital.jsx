import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Upload, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function CertificadoDigital() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: cert } = useQuery({
    queryKey: ['certificado_digital'],
    queryFn: () => base44.entities.EmpresaConfig.filter({ tipo: 'certificado_digital' }, '-created_date', 1).then(r => r[0] || null),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (cert?.id) return base44.entities.EmpresaConfig.update(cert.id, data);
      return base44.entities.EmpresaConfig.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificado_digital'] }),
  });

  const handleSave = async () => {
    setUploading(true);
    let file_url = cert?.arquivo_url || '';
    let file_name = cert?.arquivo_nome || '';

    if (file) {
      const { file_url: url } = await base44.integrations.Core.UploadFile({ file });
      file_url = url;
      file_name = file.name;
    }

    await saveMutation.mutateAsync({
      tipo: 'certificado_digital',
      arquivo_url: file_url,
      arquivo_nome: file_name,
      senha_certificado: senha || cert?.senha_certificado || '',
    });
    setFile(null);
    setSenha('');
    setUploading(false);
  };

  const isValid = cert?.arquivo_url;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/30">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isValid ? 'bg-green-100' : 'bg-yellow-100'}`}>
          {isValid
            ? <CheckCircle2 className="w-5 h-5 text-green-600" />
            : <AlertCircle className="w-5 h-5 text-yellow-600" />
          }
        </div>
        <div>
          <p className="text-sm font-semibold">{isValid ? 'Certificado configurado' : 'Nenhum certificado configurado'}</p>
          {isValid && <p className="text-xs text-muted-foreground">{cert.arquivo_nome}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="mb-1 block">Arquivo do Certificado (.pfx / .p12)</Label>
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => document.getElementById('cert-upload').click()}
          >
            <input
              id="cert-upload"
              type="file"
              accept=".pfx,.p12,.cer,.crt"
              className="hidden"
              onChange={e => setFile(e.target.files[0])}
            />
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            {file
              ? <p className="text-sm font-medium text-primary">{file.name}</p>
              : <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo .pfx / .p12</p>
            }
          </div>
        </div>

        <div>
          <Label className="mb-1 block">Senha do Certificado</Label>
          <div className="relative">
            <Input
              type={showSenha ? 'text' : 'password'}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder={cert?.senha_certificado ? '••••••••' : 'Digite a senha'}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowSenha(v => !v)}
            >
              {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={uploading || (!file && !senha)}
          className="w-full bg-primary text-primary-foreground"
        >
          {uploading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
            : <><ShieldCheck className="w-4 h-4 mr-2" /> Salvar Certificado</>
          }
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        O certificado digital (e-CNPJ A1) é necessário para a emissão de NF-e e comunicação com a SEFAZ.
        O arquivo é armazenado de forma segura e utilizado apenas para assinatura de notas fiscais.
      </p>
    </div>
  );
}