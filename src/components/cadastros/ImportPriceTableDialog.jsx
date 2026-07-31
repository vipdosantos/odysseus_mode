import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportPriceTableDialog({ open, onOpenChange, sellerId, sellerName }) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [tabelaNome, setTabelaNome] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setFileName('');
    setFileUrl('');
    setTabelaNome('');
    setLoading(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
      setFileName(file.name);
      const baseName = file.name.replace(/\.xlsx?$/i, '').replace(/_/g, ' ');
      if (!tabelaNome) setTabelaNome(baseName);
    } catch (err) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!fileUrl) {
      toast.error('Selecione um arquivo Excel');
      return;
    }
    setLoading(true);
    try {
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: 'object',
          properties: {
            tabela_nome: { type: 'string', description: 'Nome da tabela (ex: TABELA 29)' },
            precos_trelica: {
              type: 'array',
              description: 'Preços de venda por metro linear de treliça por tipo',
              items: {
                type: 'object',
                properties: {
                  truss_type: { type: 'string', description: 'Tipo de treliça: H8, H12, H16, H20, H25, H30' },
                  preco_metro_linear: { type: 'number', description: 'Preço de venda por metro linear' }
                }
              }
            }
          }
        }
      });

      const precos = result?.precos_trelica || result?.precos || [];
      if (!precos.length) {
        toast.error('Nenhum preço encontrado no arquivo');
        setLoading(false);
        return;
      }

      // Delete existing prices for this seller
      const existing = await base44.entities.SellerPriceTable.filter({ seller_id: sellerId }, 'product_size', 500);
      if (existing.length) {
        await base44.entities.SellerPriceTable.deleteMany({ seller_id: sellerId });
      }

      // Create new records
      const records = precos
        .filter(p => p.truss_type && p.preco_metro_linear != null)
        .map(p => ({
          seller_id: sellerId,
          seller_name: sellerName,
          product_size: p.truss_type,
          price: Number(p.preco_metro_linear) || 0,
          discount_pct: 0,
          notes: 'Importado via Excel'
        }));

      if (records.length) {
        await base44.entities.SellerPriceTable.bulkCreate(records);
      }

      // Update seller with tabela_nome
      if (tabelaNome) {
        await base44.entities.Seller.update(sellerId, { tabela_nome: tabelaNome });
      }

      toast.success(`${records.length} preços importados para ${sellerName}`);
      queryClient.invalidateQueries({ queryKey: ['price_tables'] });
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      queryClient.invalidateQueries({ queryKey: ['seller-prices'] });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao importar preços: ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Tabela de Preços — {sellerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Arquivo Excel (.xlsx)</Label>
            <div className="flex items-center gap-2 mt-1">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 border-2 border-dashed border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground truncate">
                    {fileName || 'Selecionar arquivo...'}
                  </span>
                </div>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={loading} />
              </label>
            </div>
          </div>
          <div>
            <Label>Nome da Tabela</Label>
            <Input value={tabelaNome} onChange={e => setTabelaNome(e.target.value)} placeholder="Ex: TABELA 29" />
          </div>
          <p className="text-xs text-muted-foreground">
            O sistema vai extrair os preços de venda por metro linear para cada tipo de treliça (H8–H30)
            e substituir os preços atuais deste vendedor.
          </p>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={loading}>Cancelar</Button>
          <Button onClick={handleImport} disabled={loading || !fileUrl} className="bg-primary text-primary-foreground">
            {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importando...</> : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}