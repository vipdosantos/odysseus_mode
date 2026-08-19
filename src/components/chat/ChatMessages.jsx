import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Send, Camera, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

export default function ChatMessages({ channel, currentUser }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState(null); // { file, previewUrl }
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', channel],
    queryFn: () => base44.entities.Message.filter({ channel }, 'created_date', 500),
  });

  const sendMutation = useMutation({
    mutationFn: (payload) => base44.entities.Message.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', channel] }),
  });

  useEffect(() => {
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.data?.channel === channel) {
        queryClient.invalidateQueries({ queryKey: ['messages', channel] });
      }
    });
    return unsubscribe;
  }, [channel, queryClient]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    sendMutation.mutate({
      channel,
      sender_id: currentUser.id,
      sender_name: currentUser.full_name || currentUser.email,
      content: t,
    });
    setText('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
    setCaption('');
  };

  const sendPhoto = async () => {
    if (!pendingImage) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: pendingImage.file });
      await sendMutation.mutateAsync({
        channel,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name || currentUser.email,
        content: caption.trim(),
        attachment_url: file_url,
      });
      setPendingImage(null);
      setCaption('');
    } finally {
      setUploading(false);
    }
  };

  const cancelPhoto = () => {
    if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    setCaption('');
  };

  let lastDay = null;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Diga olá!
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === currentUser.id;
          const d = m.created_date ? new Date(m.created_date) : null;
          const dayLabel = d ? (isToday(d) ? 'Hoje' : isYesterday(d) ? 'Ontem' : format(d, 'dd/MM/yyyy')) : '';
          const showDay = dayLabel !== lastDay;
          lastDay = dayLabel;
          const prev = messages[i - 1];
          const sameSender = prev && prev.sender_id === m.sender_id && !showDay;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{dayLabel}</span>
                </div>
              )}
              <div className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                {!mine && (
                  <div className={cn("w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0", sameSender && "invisible")}>
                    <span className="text-xs font-semibold text-muted-foreground">{(m.sender_name || '?')[0].toUpperCase()}</span>
                  </div>
                )}
                <div className={cn("max-w-[75%] flex flex-col", mine ? "items-end" : "items-start")}>
                  {!sameSender && !mine && (
                    <span className="text-xs font-medium text-muted-foreground mb-0.5 px-1">{m.sender_name}</span>
                  )}
                  <div className={cn(
                    "px-3 py-2 rounded-2xl text-sm break-words overflow-hidden",
                    mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                  )}>
                    {m.attachment_url && (
                      <img
                        src={m.attachment_url}
                        alt="foto"
                        className="rounded-lg max-w-full max-h-72 object-cover mb-1 cursor-pointer"
                        onClick={() => window.open(m.attachment_url, '_blank')}
                      />
                    )}
                    {m.content && <p>{m.content}</p>}
                  </div>
                  {d && (
                    <span className="text-[10px] text-muted-foreground px-1 mt-0.5">{format(d, 'HH:mm')}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t flex items-center gap-2">
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickFile} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        <Button variant="ghost" size="icon" onClick={() => cameraRef.current?.click()} title="Tirar foto">
          <Camera className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => galleryRef.current?.click()} title="Anexar imagem">
          <Paperclip className="w-5 h-5" />
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escreva uma mensagem..."
          className="flex-1"
        />
        <Button onClick={sendText} disabled={!text.trim() || sendMutation.isPending} className="bg-primary text-primary-foreground" size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={!!pendingImage} onOpenChange={(o) => { if (!o) cancelPhoto(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4" /> Enviar foto
            </DialogTitle>
          </DialogHeader>
          {pendingImage && (
            <div className="space-y-3">
              <img src={pendingImage.previewUrl} alt="preview" className="w-full max-h-80 object-contain rounded-lg bg-muted" />
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Adicione uma legenda..."
                onKeyDown={(e) => { if (e.key === 'Enter' && !uploading) sendPhoto(); }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancelPhoto} disabled={uploading}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={sendPhoto} disabled={uploading || !pendingImage} className="bg-primary text-primary-foreground">
              <Send className="w-4 h-4 mr-1" /> {uploading ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}