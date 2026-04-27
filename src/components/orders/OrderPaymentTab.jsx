import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, QrCode, CreditCard, Banknote, Check } from 'lucide-react';

const PIX_KEY = '00.000.000/0001-00'; // Chave pix padrão — pode ser editada aqui
const BANK_DATA = {
  banco: 'Banco do Brasil',
  agencia: '1234-5',
  conta: '12345-6',
  titular: 'Modelajes Indústria Ltda',
  cnpj: '00.000.000/0001-00',
};

export default function OrderPaymentTab({ order }) {
  const [method, setMethod] = useState('pix');
  const [pixKey, setPixKey] = useState(PIX_KEY);
  const [copied, setCopied] = useState(false);

  const amount = order?.total_value || 0;
  const amountFmt = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const pixPayload = `00020126330014BR.GOV.BCB.PIX0111${pixKey.replace(/\D/g, '')}5204000053039865802BR5925MODELAJES INDUSTRIA LTDA6009SAO PAULO62070503***630461B0`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixKey)}`;

  const whatsappBoleto = () => {
    const msg = encodeURIComponent(
      `Olá ${order.client_name}, segue o boleto referente ao pedido #${order.order_number}.\n\nValor: ${amountFmt}\nVencimento: ${order.delivery_date || 'a combinar'}\n\n_Para emissão do boleto, entre em contato conosco._`
    );
    window.open(`https://wa.me/${order.client_phone?.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  const whatsappCartao = () => {
    const msg = encodeURIComponent(
      `Olá ${order.client_name}, segue o link de pagamento via cartão referente ao pedido #${order.order_number}.\n\nValor: ${amountFmt}\n\n_Entre em contato para receber o link de pagamento._`
    );
    window.open(`https://wa.me/${order.client_phone?.replace(/\D/g, '')}?text=${msg}`, '_blank');
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Valor do Pedido</p>
          <p className="text-2xl font-bold text-primary">{amountFmt}</p>
        </div>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pix"><span className="flex items-center gap-2"><QrCode className="w-4 h-4" /> PIX</span></SelectItem>
            <SelectItem value="boleto"><span className="flex items-center gap-2"><Banknote className="w-4 h-4" /> Boleto / TED</span></SelectItem>
            <SelectItem value="cartao"><span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Cartão</span></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* PIX */}
      {method === 'pix' && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Chave PIX</Label>
            <div className="flex gap-2 mt-1">
              <Input value={pixKey} onChange={e => setPixKey(e.target.value)} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => copy(pixKey)}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 py-4">
            <img src={qrUrl} alt="QR Code PIX" className="rounded-xl border p-2 bg-white w-48 h-48" />
            <p className="text-xs text-muted-foreground">Escaneie o QR Code para pagar via PIX</p>
            <Button variant="outline" onClick={() => copy(pixKey)} className="w-full">
              {copied ? <><Check className="w-4 h-4 mr-2 text-green-500" /> Copiado!</> : <><Copy className="w-4 h-4 mr-2" /> Copiar Chave PIX</>}
            </Button>
          </div>
          {order.client_phone && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const msg = encodeURIComponent(`Olá ${order.client_name}! Pedido #${order.order_number} — ${amountFmt}\n\nChave PIX: ${pixKey}\n\nApós o pagamento, envie o comprovante.`);
                window.open(`https://wa.me/${order.client_phone?.replace(/\D/g, '')}?text=${msg}`, '_blank');
              }}
            >
              📱 Enviar Chave PIX via WhatsApp
            </Button>
          )}
        </div>
      )}

      {/* BOLETO / TED */}
      {method === 'boleto' && (
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-semibold text-base mb-2">Dados Bancários</p>
            {Object.entries(BANK_DATA).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground capitalize">{k.replace('_', ' ')}:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{v}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(v)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold text-primary">
              <span>Valor:</span>
              <span>{amountFmt}</span>
            </div>
          </div>
          <Button variant="outline" onClick={() => copy(Object.entries(BANK_DATA).map(([k,v]) => `${k}: ${v}`).join('\n') + `\nValor: ${amountFmt}`)}>
            <Copy className="w-4 h-4 mr-2" /> Copiar Dados Bancários
          </Button>
          {order.client_phone && (
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={whatsappBoleto}>
              📱 Enviar Dados por WhatsApp
            </Button>
          )}
        </div>
      )}

      {/* CARTÃO */}
      {method === 'cartao' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠️ Link de Pagamento via Cartão</p>
            <p>Para aceitar cartão de crédito/débito online, conecte sua conta do Mercado Pago ou PagSeguro. Enquanto isso, envie uma mensagem ao cliente para combinar o pagamento.</p>
          </div>
          {order.client_phone && (
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={whatsappCartao}>
              📱 Enviar Informações via WhatsApp
            </Button>
          )}
          <div className="text-xs text-muted-foreground text-center">
            Para integração com maquininha ou link de cartão, entre em contato com o suporte.
          </div>
        </div>
      )}
    </div>
  );
}