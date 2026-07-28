import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileSignature, Send, Copy, Check, ExternalLink, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

export default function ContractTab({ order, canEdit }) {
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const signed = !!order.contract_signed_at;

  const contractUrl = order.access_key
    ? `${window.location.origin}/contrato/${order.access_key}`
    : '';

  const handleCopy = () => {
    if (!contractUrl) { toast.error('Pedido sem chave de acesso.'); return; }
    navigator.clipboard.writeText(contractUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link de assinatura copiado!');
  };

  const handleWhatsApp = () => {
    if (!contractUrl) { toast.error('Pedido sem chave de acesso.'); return; }
    const msg = `Olá ${order.client_name || ''}! Segue o link para assinar o contrato do seu pedido #${order.order_number} na Modelajes: ${contractUrl}`;
    let phone = (order.client_phone || '').replace(/\D/g, '');
    if (phone && phone.length === 10) phone = '55' + phone;
    if (phone && phone.length === 11) phone = '55' + phone;
    const wa = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, '_blank');
  };

  const handleMarkSent = async () => {
    if (!order.id) return;
    setMarking(true);
    try {
      await base44.entities.Order.update(order.id, { contract_link_sent_at: new Date().toISOString() });
      toast.success('Envio do link registrado.');
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast.error('Não foi possível registrar o envio.');
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2">
        <FileSignature className="w-5 h-5 text-primary" />
        <h4 className="text-sm font-semibold">Contrato do Cliente</h4>
      </div>

      {/* Status da assinatura */}
      <div className={`rounded-xl border p-3 ${signed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        {signed ? (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-green-800">Contrato assinado</p>
              <p className="text-green-700 text-xs">
                Por {order.contract_signed_by || order.client_name} em {format(new Date(order.contract_signed_at), 'dd/MM/yyyy HH:mm')}
              </p>
              <p className="text-green-700 text-xs mt-0.5">RG: {order.contract_rg || '—'} · CPF: {order.contract_cpf || '—'}</p>
              {order.contract_drive_link && (
                <a href={order.contract_drive_link} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-600 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Ver no Google Drive
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Aguardando assinatura do cliente</p>
              <p className="text-amber-700 text-xs">Envie o link abaixo para o cliente assinar o contrato com RG e CPF.</p>
            </div>
          </div>
        )}
      </div>

      {/* Link + compartilhar */}
      {canEdit && (
        <div className="space-y-2">
          {contractUrl && (
            <Input readOnly value={contractUrl} className="font-mono text-xs bg-muted/30" />
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleWhatsApp} className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 text-white">
              <Send className="w-4 h-4 mr-2" /> Enviar por WhatsApp
            </Button>
            <Button onClick={handleCopy} variant="outline" className="flex-1 min-w-[120px]">
              {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </Button>
          </div>
          {!signed && (
            <Button onClick={handleMarkSent} variant="ghost" size="sm" className="text-xs w-full" disabled={marking}>
              {marking ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : null}
              Marcar como enviado
            </Button>
          )}
        </div>
      )}
    </div>
  );
}