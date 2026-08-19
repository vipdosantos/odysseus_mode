import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMessages from '@/components/chat/ChatMessages';
import { beep, unlockAudio } from '@/lib/beep';
import { useToast } from '@/components/ui/use-toast';

const UNREAD_KEY = (uid) => `chat_unread_${uid}`;

export default function Chat() {
  const { user } = useOutletContext();
  const [activeChannel, setActiveChannel] = useState('geral');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Persist unread counts
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
      if (!m || m.sender_id === user.id) return; // ignore my own messages

      // Sound for every incoming message
      beep('msg');

      const ch = m.channel;
      const isActive = activeRef.current === ch;

      if (!isActive) {
        setUnread((prev) => {
          const next = { ...prev, [ch]: (prev[ch] || 0) + 1 };
          persistUnread(next);
          return next;
        });

        // Toast notification
        const sender = m.sender_name || 'Alguém';
        const label = ch === 'geral' ? 'Geral' : (users.find(u => ch.includes(u.id))?.full_name || 'Conversa');
        const preview = m.attachment_url ? '📷 Foto' : (m.content || '📷 Foto');
        toast({
          title: `${sender} em ${label}`,
          description: preview.length > 60 ? preview.slice(0, 60) + '…' : preview,
        });

        // Browser notification if tab hidden
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`${sender} em ${label}`, { body: preview });
          } catch { /* ignore */ }
        }
      }
    });
    return unsubscribe;
  }, [user?.id, users, toast, persistUnread]);

  // Unlock audio on first user interaction (browsers require a gesture)
  useEffect(() => {
    const handler = () => { unlockAudio(); };
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  const selectChannel = (ch) => {
    setActiveChannel(ch);
    setSidebarOpen(false);
    // Clear unread for the opened channel
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

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">Carregando...</div>
    );
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" onClick={unlockAudio}>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <MessageSquare className="w-6 h-6 text-primary" />
          {totalUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground">Comunicação interna da equipe</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden flex h-[calc(100vh-13rem)]">
        {/* Sidebar - desktop */}
        <div className="hidden md:block w-64 border-r shrink-0">
          <ChatSidebar users={users} currentUser={user} activeChannel={activeChannel} onSelect={selectChannel} unread={unread} />
        </div>

        {/* Sidebar - mobile drawer */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-64 bg-card h-full border-r">
              <ChatSidebar
                users={users}
                currentUser={user}
                activeChannel={activeChannel}
                onSelect={selectChannel}
                unread={unread}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 p-3 border-b">
            <button className="md:hidden text-muted-foreground relative" onClick={() => setSidebarOpen(true)}>
              <MessageSquare className="w-5 h-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
            <h3 className="font-semibold text-sm truncate">{channelLabel(activeChannel)}</h3>
          </div>
          <ChatMessages channel={activeChannel} currentUser={user} />
        </div>
      </div>
    </div>
  );
}