import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ClientPhotoCapture({ photoUrl, onChange }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [uploading, setUploading] = useState(false);

  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(s);
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch {
      toast.error('Não foi possível acessar a câmera.');
    }
  };

  const closeCamera = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      closeCamera();
      await uploadFile(new File([blob], 'foto_cliente.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      toast.success('Foto salva!');
    } catch {
      toast.error('Erro ao enviar foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div className="space-y-2">
      {/* Preview */}
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt="Foto cliente" className="w-full h-full object-cover" />
          ) : (
            <User className="w-7 h-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={openCamera} disabled={uploading}>
            <Camera className="w-4 h-4 mr-1" /> Câmera
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-1" /> {uploading ? 'Enviando...' : 'Arquivo'}
          </Button>
          {photoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-destructive">
              <X className="w-4 h-4 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="bg-background rounded-2xl overflow-hidden max-w-sm w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold">Tirar Foto</span>
              <button onClick={closeCamera} className="p-1 rounded hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full max-h-[50vh] object-cover" />
            </div>
            <div className="p-4 flex gap-3">
              <Button type="button" variant="outline" onClick={closeCamera} className="flex-1">Cancelar</Button>
              <Button type="button" onClick={capturePhoto} className="flex-1 bg-primary text-primary-foreground">
                <Camera className="w-4 h-4 mr-2" /> Capturar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}