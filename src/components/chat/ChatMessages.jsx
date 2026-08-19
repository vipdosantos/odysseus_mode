import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

export default function ChatMessages({ channel, currentUser }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', channel],
    queryFn: () => base44.entities.Message.filter({ channel }, 'created_date', 500),
  });

  const sendMutation = useMutation({
    mutationFn: (content) => base44.entities.Message.create({
      channel,
      sender_id: currentUser.id,
      sender_name: currentUser.full_name || currentUser.email,
      content,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', channel] }),
  });

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.data?.channel === channel) {
        queryClient.invalidateQueries({ queryKey: ['messages', channel] });
      }
    });
    return unsubscribe;
  }, [channel, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    sendMutation.mutate(t);
    setText('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group by day
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
                    "px-3 py-2 rounded-2xl text-sm break-words",
                    mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                  )}>
                    {m.content}
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

      <div className="p-3 border-t flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escreva uma mensagem..."
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={!text.trim() || sendMutation.isPending} className="bg-primary text-primary-foreground" size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}