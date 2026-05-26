import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Pen, Trash2, Upload, CheckCircle, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function DeliveryReceiptTab({ order }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);
  const [signerName, setSignerName] = useState(order.delivery_signed_by || '');
  const [signerDoc, setSignerDoc] = useState(order.delivery_signer_doc || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Load existing signature on open
  useEffect(() => {
    if (order.delivery_signature && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = order.delivery_signature;
    }
  }, [order.delivery_signature]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    setLastPos(getPos(e, canvasRef.current));
  };

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
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setLastPos(pos);
    setHasSignature(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const signatureDataUrl = hasSignature ? canvasRef.current.toDataURL('image/png') : null;
    await base44.entities.Order.update(order.id, {
      delivery_signature: signatureDataUrl,
      delivery_signed_by: signerName,
      delivery_signer_doc: signerDoc,
      delivery_signed_at: new Date().toISOString(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleUploadDoc = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const existing = order.delivery_photos || [];
    await base44.entities.Order.update(order.id, { delivery_photos: [...existing, file_url] });
    setUploadingDoc(false);
  };

  const handlePrintReceipt = () => {
    const signatureImg = hasSignature || order.delivery_signature
      ? `<img src="${order.delivery_signature || canvasRef.current.toDataURL()}" style="max-width:260px;border:1px solid #ccc;" />`
      : '<p style="color:#999;font-style:italic;">Sem assinatura</p>';

    const items = (order.items || []).map(i =>
      `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${i.size}</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:center;">${i.quantity}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo de Entrega</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 30px; color: #111; font-size: 13px; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th { background: #f3f3f3; padding: 4px 8px; border: 1px solid #ddd; text-align: left; }
      .sig-area { margin-top: 24px; }
      .line { border-top: 1px solid #333; width: 260px; margin-top: 8px; padding-top: 4px; font-size: 11px; color: #444; }
      @media print { body { margin: 10px; } }
    </style></head>
    <body>
      <h1>Recibo de Entrega — Pedido #${order.order_number}</h1>
      <div class="sub">Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
      <p><strong>Cliente:</strong> ${order.client_name}</p>
      ${order.client_phone ? `<p><strong>Telefone:</strong> ${order.client_phone}</p>` : ''}
      ${order.delivery_address ? `<p><strong>Endereço:</strong> ${order.delivery_address}</p>` : ''}
      <table>
        <thead><tr><th>Item</th><th>Qtd</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <p>Declaro ter recebido os itens acima em perfeito estado.</p>
      <div class="sig-area">
        ${signatureImg}
        <div class="line">Assinatura do Recebedor</div>
        <p style="margin-top:8px;"><strong>Nome:</strong> ${signerName || '___________________________'}</p>
        <p><strong>Documento:</strong> ${signerDoc || '___________________________'}</p>
        ${order.delivery_signed_at ? `<p><strong>Data:</strong> ${format(new Date(order.delivery_signed_at), 'dd/MM/yyyy HH:mm')}</p>` : ''}
      </div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-5 mt-4">
      {/* Dados do recebedor */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Dados do Recebedor</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome completo</label>
            <Input
              placeholder="Nome do recebedor"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">CPF / RG</label>
            <Input
              placeholder="Documento"
              value={signerDoc}
              onChange={e => setSignerDoc(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Assinatura */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5"><Pen className="w-4 h-4" /> Assinatura</h4>
          <Button size="sm" variant="ghost" onClick={clearSignature} className="text-xs text-muted-foreground">
            <Trash2 className="w-3 h-3 mr-1" /> Limpar
          </Button>
        </div>
        <div className="border-2 border-dashed border-border rounded-xl bg-white touch-none">
          <canvas
            ref={canvasRef}
            width={480}
            height={150}
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
        <p className="text-xs text-muted-foreground mt-1 text-center">Assine acima com o dedo ou mouse</p>
      </div>

      {/* Upload de documento */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Documento de Recebimento</h4>
        <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-xl p-3 hover:bg-muted/30 transition-colors">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{uploadingDoc ? 'Enviando...' : 'Anexar foto ou PDF'}</span>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadDoc} disabled={uploadingDoc} />
        </label>
        {order.delivery_photos?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {order.delivery_photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary underline">
                <Download className="w-3 h-3" /> Arquivo {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saved ? <><CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Salvo!</> : saving ? 'Salvando...' : 'Salvar Recibo'}
        </Button>
        <Button variant="outline" onClick={handlePrintReceipt} className="flex-1">
          Imprimir Recibo
        </Button>
      </div>
    </div>
  );
}