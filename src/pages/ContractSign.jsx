import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Pen, Trash2, CheckCircle2, Loader2, AlertCircle, FileText, ExternalLink, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function ContractSign() {
  const { accessKey } = useParams();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [errorOrder, setErrorOrder] = useState(null);

  const [rg, setRg] = useState('');
  const [cpf, setCpf] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { driveLink }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOrder(true); setOrder(null); setErrorOrder(null);
      if (!accessKey) { if (!cancelled) setErrorOrder('Link de assinatura inválido.'); setLoadingOrder(false); return; }
      try {
        const res = await base44.functions.invoke('buscarPedidoParaAssinatura', { access_key: accessKey.trim() });
        if (cancelled) return;
        const data = res?.data;
        if (data && data.id) setOrder(data);
        else setErrorOrder(data?.error || 'Pedido não encontrado. Verifique o link recebido.');
      } catch (e) {
        if (!cancelled) setErrorOrder('Não foi possível carregar o pedido.');
      } finally {
        if (!cancelled) setLoadingOrder(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessKey]);

  // Pre-fill if already signed
  useEffect(() => {
    if (order?.contract_signed_at) {
      setRg(order.contract_rg || '');
      setCpf(order.contract_cpf || '');
    }
  }, [order]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };
  const startDraw = (e) => { e.preventDefault(); setIsDrawing(true); setLastPos(getPos(e, canvasRef.current)); };
  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setLastPos(pos);
    setHasSignature(true);
  };
  const endDraw = () => setIsDrawing(false);
  const clearSignature = () => {
    const c = canvasRef.current; const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); setHasSignature(false);
  };

  const handleSubmit = async () => {
    if (!order) return;
    if (!rg.trim() || !cpf.trim()) { alert('Preencha RG e CPF.'); return; }
    if (!hasSignature) { alert('Assine no quadro acima.'); return; }
    setSubmitting(true);
    try {
      const signature = canvasRef.current.toDataURL('image/png');
      const res = await base44.functions.invoke('salvarAssinaturaContrato', {
        access_key: accessKey.trim(), rg: rg.trim(), cpf: cpf.trim(), signature,
      });
      setDone({ driveLink: res.data?.driveLink, pdfBase64: res.data?.pdfBase64 });
    } catch (e) {
      alert('Não foi possível salvar a assinatura. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadySigned = !!order?.contract_signed_at;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-slate-900 text-white py-5 px-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <FileText className="w-7 h-7 text-amber-400" />
          <div>
            <h1 className="text-lg font-bold">Modelajes — Assinatura de Contrato</h1>
            <p className="text-xs text-slate-400">Confirme seus dados e assine o contrato do seu pedido</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {loadingOrder && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Carregando contrato...</p>
          </div>
        )}

        {errorOrder && !loadingOrder && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-700 font-medium">{errorOrder}</p>
          </div>
        )}

        {order && !loadingOrder && (
          <div className="space-y-4">
            {/* Resumo do pedido */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Pedido</p>
                  <h2 className="text-2xl font-bold text-slate-900">#{order.order_number}</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Cliente</p>
                  <p className="font-semibold text-slate-700">{order.client_name}</p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-1 text-sm text-slate-600">
                {order.delivery_date && <p><strong>Entrega:</strong> {format(new Date(order.delivery_date), 'dd/MM/yyyy')}</p>}
                {order.delivery_address && <p><strong>Endereço:</strong> {order.delivery_address}</p>}
                {order.total_value > 0 && (
                  <p><strong>Valor:</strong> R$ {order.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                )}
                {order.payment_method && <p><strong>Pagamento:</strong> {order.payment_method}</p>}
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold text-slate-700 mb-2">Itens</p>
                <div className="space-y-1">
                  {(order.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{it.truss_type ? `${it.truss_type} ` : ''}{it.size}</span>
                      <span className="text-slate-500">{it.quantity} un</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {done ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-bold text-green-800">Contrato assinado com sucesso!</p>
                <p className="text-sm text-green-700 mt-1">O documento foi salvo no Google Drive da Modelajes.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
                  {done.pdfBase64 && (
                    <a
                      href={`data:application/pdf;base64,${done.pdfBase64}`}
                      download={`Contrato_${order.order_number || 'pedido'}.pdf`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
                    >
                      <Download className="w-4 h-4" /> Baixar PDF do Contrato
                    </a>
                  )}
                  {done.driveLink && (
                    <a href={done.driveLink} target="_blank" rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50">
                      <ExternalLink className="w-4 h-4" /> Ver no Google Drive
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                {alreadySigned && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">Este contrato já foi assinado em {format(new Date(order.contract_signed_at), 'dd/MM/yyyy HH:mm')}. Você pode assinar novamente se necessário.</p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Seus documentos</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">RG</label>
                      <Input value={rg} onChange={e => setRg(e.target.value)} placeholder="00.000.000-0" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">CPF</label>
                      <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Pen className="w-4 h-4" /> Sua assinatura</h3>
                    <Button size="sm" variant="ghost" onClick={clearSignature} className="text-xs text-slate-500">
                      <Trash2 className="w-3 h-3 mr-1" /> Limpar
                    </Button>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white touch-none">
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={160}
                      className="w-full rounded-xl cursor-crosshair"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 text-center">Assine acima com o dedo ou mouse</p>
                </div>

                <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Assinar e Enviar Contrato'}
                </Button>
                <p className="text-[11px] text-slate-400 text-center">
                  Ao assinar, o contrato em PDF é gerado e arquivado automaticamente no Google Drive da Modelajes.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-6 text-center">
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Modelajes. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}