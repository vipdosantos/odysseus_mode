import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquare, X } from 'lucide-react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMessages from '@/components/chat/ChatMessages';
import { beep, unlockAudio } from '@/lib/beep';
import { useToast } from '@/components/ui/use-toast';
import { canView } from '@/lib/userPermissions';
import { cn } from '@/lib/utils';

const UNREAD_KEY = (uid) => `chat_unread_${uid}`;

export default function FloatingChat({ user }) {
  const [open, setOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState('geral');
  const [unread, setUnread] = useState({});
  const activeRef = useRef(activeChannel);
  const { toast } = useToast();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  useEffect(() => { activeRef.current = activeChannel; }, [activeChannel]);

  // Load persisted unread counts
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(UNREAD_KEY(user.id));
      if (raw) setUnread(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [user?.id]);

  const persistUnread = useCallback((next) => {
    if (!user?.id) return;
    try { localStorage.setItem(UNREAD_KEY(user.id), JSON.stringify(next)); } catch { /* ignore */ }
  }, [user?.id]);

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Global subscription: detect new incoming messages for sound + unread + toast
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.type !== 'create') return;
      const m = event.data;
      if (!m || m.sender_id === user.id) return;

      beep('msg');

      const ch = m.channel;
      const isActive = open && activeRef.current === ch;

      if (!isActive) {
        setUnread((prev) => {
          const next = { ...prev, [ch]: (prev[ch] || 0) + 1 };
          persistUnread(next);
          return next;
        });

        const sender = m.sender_name || 'Alguém';
        const label = ch === 'geral' ? 'Geral' : (users.find(u => ch.includes(u.id))?.full_name || 'Conversa');
        const preview = m.attachment_url ? '📷 Foto' : (m.content || '📷 Foto');
        toast({
          title: `${sender} em ${label}`,
          description: preview.length > 60 ? preview.slice(0, 60) + '…' : preview,
        });

        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(`${sender} em ${label}`, { body: preview }); } catch { /* ignore */ }
        }
      }
    });
    return unsubscribe;
  }, [user?.id, users, toast, persistUnread, open]);

  // Unlock audio on first user interaction
  useEffect(() => {
    const handler = () => { unlockAudio(); };
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  const selectChannel = (ch) => {
    setActiveChannel(ch);
    setUnread((prev) => {
      if (!prev[ch]) return prev;
      const next = { ...prev, [ch]: 0 };
      persistUnread(next);
      return next;
    });
  };

  const channelLabel = (ch) => {
    if (ch === 'geral') return 'Geral';
    const ids = ch.replace('dm:', '').split(':');
    const otherId = ids.find((id) => id !== user?.id);
    const other = users.find((u) => u.id === otherId);
    return other?.full_name || other?.email || 'Conversa';
  };

  if (!user || !canView(user, '/chat')) return null;

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(true); unlockAudio(); }}
        className="fixed bottom-20 lg:bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform no-print"
        title="Chat"
      >
        <MessageSquare className="w-6 h-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-4 z-50 sm:w-[540px] sm:h-[640px] sm:max-h-[80vh] no-print" onClick={unlockAudio}>
          {/* Mobile backdrop */}
          <div className="absolute inset-0 bg-black/30 sm:hidden" onClick={() => setOpen(false)} />
          <div className="relative w-full h-full sm:h-full bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <span className="font-semibold text-sm">{channelLabel(activeChannel)}</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex min-h-0">
              <div className="w-40 sm:w-44 border-r shrink-0">
                <ChatSidebar users={users} currentUser={user} activeChannel={activeChannel} onSelect={selectChannel} unread={unread} />
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <ChatMessages channel={activeChannel} currentUser={user} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}