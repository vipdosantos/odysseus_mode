import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Paperclip, X, Upload, FileText, Image, Sheet } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const fileIcon = (url) => {
  if (!url) return <FileText className="w-4 h-4" />;
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
  if (['jpg','jpeg','png','webp'].includes(ext)) return <Image className="w-4 h-4 text-blue-500" />;
  if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-red-500" />;
  if (['xlsx','xls','csv'].includes(ext)) return <FileText className="w-4 h-4 text-green-600" />;
  return <Paperclip className="w-4 h-4 text-muted-foreground" />;
};

const fileName = (url) => {
  try { return decodeURIComponent(url.split('/').pop().split('?')[0]).slice(-40); } catch { return 'arquivo'; }
};

export default function OrderAttachments({ attachments = [], onChange, label = 'Anexos', maxFiles = 10 }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (attachments.length + files.length > maxFiles) {
      alert(`Máximo de ${maxFiles} arquivos.`);
      return;
    }
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    onChange([...attachments, ...urls]);
    setUploading(false);
    e.target.value = '';
  };

  const remove = (idx) => onChange(attachments.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label} ({attachments.length}/{maxFiles})</Label>
        {attachments.length < maxFiles && (
          <label className="cursor-pointer">
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv" className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
              <span><Upload className="w-3.5 h-3.5 mr-1" />{uploading ? 'Enviando...' : 'Anexar'}</span>
            </Button>
          </label>
        )}
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((url, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
              {fileIcon(url)}
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-xs text-primary hover:underline">
                {fileName(url)}
              </a>
              <button onClick={() => remove(idx)} className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}