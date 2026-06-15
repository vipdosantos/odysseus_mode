import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { Pen, Trash2, Upload, CheckCircle, FileText, Download, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DeliveryReceiptTab({ order }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);
  const [signerName, setSignerName] = useState(order.delivery_signed_by || '');
  const [signerDoc, setSignerDoc] = useState(order.delivery_signer_doc || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState(order.delivery_photos || []);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch {
      toast?.('Câmera não disponível');
    }
  };

  const closeCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setUploadingDoc(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updated = [...capturedPhotos, file_url];
      setCapturedPhotos(updated);
      await base44.entities.Order.update(order.id, { delivery_photos: updated });
      setUploadingDoc(false);
    }, 'image/jpeg', 0.85);
    closeCamera();
  };

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
    const updated = [...capturedPhotos, file_url];
    setCapturedPhotos(updated);
    await base44.entities.Order.update(order.id, { delivery_photos: updated });
    setUploadingDoc(false);
  };

  const handlePrintReceipt = () => {
    const signatureImg = hasSignature || order.delivery_signature
      ? `<img src="${order.delivery_signature || canvasRef.current.toDataURL()}" style="max-width:220px;border:1px solid #ccc;border-radius:4px;" />`
      : '<p style="color:#999;font-style:italic;">Sem assinatura</p>';

    const items = (order.items || []).map(i =>
      `<tr><td style="padding:3px 6px;border:1px solid #ddd;">${i.size}</td><td style="padding:3px 6px;border:1px solid #ddd;text-align:center;">${i.quantity}</td></tr>`
    ).join('');

    const logoImg = `<img src="https://media.base44.com/images/public/69e67ee13ca6bee2db939472/a733a5b7d_graph-paper-5mm-1-en.png" style="height:40px;width:auto;object-fit:contain;" alt="Modelajes" />`;

    const via = (num) => `
      <div class="via">
        <div class="header">
          <div class="logo-block">
            ${logoImg}
          </div>
          <div class="title-block">
            <div class="title">Recibo de Entrega</div>
            <div class="subtitle">Pedido #${order.order_number} &nbsp;|&nbsp; ${num}ª via</div>
          </div>
        </div>
        <div class="info">
          <p><strong>Cliente:</strong> ${order.client_name}</p>
          ${order.client_phone ? `<p><strong>Telefone:</strong> ${order.client_phone}</p>` : ''}
          ${order.delivery_address ? `<p><strong>Endereço:</strong> ${order.delivery_address}</p>` : ''}
          <p><strong>Data:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qtd</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
        <p class="decl">Declaro ter recebido os itens acima em perfeito estado.</p>
        <div class="sig-area">
          ${signatureImg}
          <div class="sig-line">Assinatura do Recebedor</div>
          <p><strong>Nome:</strong> ${signerName || '___________________________'}</p>
          <p><strong>Documento:</strong> ${signerDoc || '___________________________'}</p>
          ${order.delivery_signed_at ? `<p><strong>Assinado em:</strong> ${format(new Date(order.delivery_signed_at), 'dd/MM/yyyy HH:mm')}</p>` : ''}
        </div>
      </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo #${order.order_number}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #111; font-size: 12px; }
      .via { width: 100%; padding: 10px 0; }
      .via + .via { border-top: 2px dashed #999; margin-top: 10px; padding-top: 14px; }
      .header { display: flex; align-items: center; gap: 12px; background: #fff; color: #111; padding: 6px 12px; border-radius: 6px; margin-bottom: 10px; border: 1.5px solid #e5e7eb; }
      .logo-block { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 100px; }
      .brand { font-size: 13px; font-weight: 900; letter-spacing: 2px; color: #111; }
      .title-block { flex: 1; }
      .title { font-size: 15px; font-weight: 700; }
      .subtitle { font-size: 11px; color: #666; margin-top: 2px; }
      .info p { margin: 2px 0; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      th { background: #f3f3f3; padding: 3px 6px; border: 1px solid #ddd; text-align: left; font-size: 11px; }
      .decl { font-style: italic; margin: 6px 0; color: #444; }
      .sig-area { margin-top: 10px; }
      .sig-area img { display: block; }
      .sig-line { border-top: 1px solid #333; width: 240px; margin-top: 6px; padding-top: 3px; font-size: 10px; color: #444; }
      .sig-area p { margin: 3px 0; }
      @media print { body { margin: 0; } }
    </style></head>
    <body>${via(1)}${via(2)}<script>window.onload=function(){window.print();}<\/script></body></html>`;

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

      {/* Fotos / Documentos */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Fotos / Documento de Recebimento</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCamera}
            disabled={uploadingDoc}
            className="flex-1 flex items-center justify-center gap-2 border border-dashed border-border rounded-xl p-3 hover:bg-muted/30 transition-colors text-sm text-muted-foreground"
          >
            <Camera className="w-4 h-4" /> Tirar Foto
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer border border-dashed border-border rounded-xl p-3 hover:bg-muted/30 transition-colors text-sm text-muted-foreground">
            <Upload className="w-4 h-4" />
            {uploadingDoc ? 'Enviando...' : 'Anexar Arquivo'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadDoc} disabled={uploadingDoc} />
          </label>
        </div>

        {/* Camera Modal */}
        {cameraOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm rounded-xl" />
            <div className="flex gap-4 mt-6">
              <Button onClick={capturePhoto} className="bg-primary text-primary-foreground px-8">Capturar</Button>
              <Button variant="outline" onClick={closeCamera} className="text-white border-white"><X className="w-4 h-4 mr-1" /> Cancelar</Button>
            </div>
          </div>
        )}

        {capturedPhotos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {capturedPhotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Foto ${i+1}`} className="w-16 h-16 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity" />
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