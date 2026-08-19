import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatMessages from '@/components/chat/ChatMessages';

export default function Chat() {
  const { user } = useOutletContext();
  const [activeChannel, setActiveChannel] = useState('geral');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground">Comunicação interna da equipe</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden flex h-[calc(100vh-13rem)]">
        {/* Sidebar - desktop */}
        <div className="hidden md:block w-64 border-r shrink-0">
          <ChatSidebar users={users} currentUser={user} activeChannel={activeChannel} onSelect={setActiveChannel} />
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
                onSelect={(c) => { setActiveChannel(c); setSidebarOpen(false); }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 p-3 border-b">
            <button className="md:hidden text-muted-foreground" onClick={() => setSidebarOpen(true)}>
              <MessageSquare className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-sm truncate">{channelLabel(activeChannel)}</h3>
          </div>
          <ChatMessages channel={activeChannel} currentUser={user} />
        </div>
      </div>
    </div>
  );
}