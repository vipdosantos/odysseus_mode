import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, QrCode, CreditCard, Banknote, Check, Landmark, AlertCircle } from 'lucide-react';

export default function OrderPaymentTab({ order }) {
  const [method, setMethod] = useState('pix');
  const [copied, setCopied] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank_accounts'],
    queryFn: () => base44.entities.BankAccount.list(),
  });

  const pixAccounts = accounts.filter(a => a.type === 'pix' && a.active !== false);
  const bankAccounts = accounts.filter(a => a.type === 'conta_bancaria' && a.active !== false);

  const [selectedPix, setSelectedPix] = useState('');
  const [selectedBank, setSelectedBank] = useState('');

  const pixAcc = pixAccounts.find(a => a.id === selectedPix) || pixAccounts[0];
  const bankAcc = bankAccounts.find(a => a.id === selectedBank) || bankAccounts[0];

  const amount = order?.total_value || 0;
  const amountFmt = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const phone = order?.client_phone?.replace(/\D/g, '');

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const sendWhatsApp = (msg) => {
    if (!phone) return alert('Cliente sem telefone cadastrado.');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const CopyBtn = ({ text, id }) => (
    <Button variant="outline" size="icon" className="shrink-0" onClick={() => copy(text, id)}>
      {copied === id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </Button>
  );

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
            <SelectItem value="boleto"><span className="flex items-center gap-2"><Landmark className="w-4 h-4" /> TED / Depósito</span></SelectItem>
            <SelectItem value="cartao"><span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Cartão</span></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* PIX */}
      {method === 'pix' && (
        <div className="space-y-3">
          {pixAccounts.length === 0 ? (
            <div className="flex gap-2 items-center text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Nenhuma conta PIX cadastrada. Acesse <strong>Contas Bancárias</strong> no menu.
            </div>
          ) : (
            <>
              {pixAccounts.length > 1 && (
                <Select value={selectedPix || pixAcc?.id} onValueChange={setSelectedPix}>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta PIX" /></SelectTrigger>
                  <SelectContent>
                    {pixAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {pixAcc && (
                <>
                  <div className="flex flex-col items-center gap-3 py-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixAcc.pix_key)}`}
                      alt="QR PIX"
                      className="rounded-xl border p-2 bg-white w-48 h-48"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      {pixAcc.label} — {pixAcc.pix_key_type?.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2 font-mono text-sm truncate">{pixAcc.pix_key}</div>
                    <CopyBtn text={pixAcc.pix_key} id="pix_key" />
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => sendWhatsApp(
                      `Olá ${order.client_name}! 😊\n\nSegue a chave PIX para pagamento do pedido *#${order.order_number}*:\n\n💰 Valor: *${amountFmt}*\n🔑 Chave PIX (${pixAcc.pix_key_type}): *${pixAcc.pix_key}*\n\nApós o pagamento, envie o comprovante. Obrigado!`
                    )}
                  >
                    📱 Enviar PIX via WhatsApp
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* TED / Depósito */}
      {method === 'boleto' && (
        <div className="space-y-3">
          {bankAccounts.length === 0 ? (
            <div className="flex gap-2 items-center text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Nenhuma conta bancária cadastrada. Acesse <strong>Contas Bancárias</strong> no menu.
            </div>
          ) : (
            <>
              {bankAccounts.length > 1 && (
                <Select value={selectedBank || bankAcc?.id} onValueChange={setSelectedBank}>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {bankAcc && (
                <>
                  <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                    <p className="font-semibold mb-2">Dados Bancários — {bankAcc.label}</p>
                    {[
                      ['Banco', bankAcc.banco],
                      ['Agência', bankAcc.agencia],
                      ['Conta', bankAcc.conta],
                      ['Titular', bankAcc.titular],
                      ['CNPJ/CPF', bankAcc.cnpj_cpf],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center gap-2">
                        <span className="text-muted-foreground">{k}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{v}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(v, k)}>
                            {copied === k ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-1 flex justify-between font-bold text-primary">
                      <span>Valor:</span><span>{amountFmt}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => sendWhatsApp(
                      `Olá ${order.client_name}! 😊\n\nSegue os dados para pagamento do pedido *#${order.order_number}*:\n\n💰 Valor: *${amountFmt}*\n\n🏦 Banco: ${bankAcc.banco}\n📋 Agência: ${bankAcc.agencia}\n📋 Conta: ${bankAcc.conta}\n👤 Titular: ${bankAcc.titular}\n🔢 CNPJ/CPF: ${bankAcc.cnpj_cpf || '—'}\n\nApós o pagamento, envie o comprovante. Obrigado!`
                    )}
                  >
                    📱 Enviar Dados via WhatsApp
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Cartão */}
      {method === 'cartao' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠️ Pagamento via Cartão</p>
            <p>Para gerar link de cartão, conecte sua conta do Mercado Pago, PagSeguro ou similar. Envie uma mensagem ao cliente para combinar.</p>
          </div>
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={() => sendWhatsApp(
              `Olá ${order.client_name}! 😊\n\nPara pagamento do pedido *#${order.order_number}* no valor de *${amountFmt}* via cartão, entre em contato conosco para enviarmos o link de pagamento.`
            )}
          >
            📱 Enviar Mensagem via WhatsApp
          </Button>
        </div>
      )}
    </div>
  );
}