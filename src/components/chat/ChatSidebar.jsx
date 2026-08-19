import React from 'react';
import { Hash, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatSidebar({ users, currentUser, activeChannel, onSelect }) {
  const dmChannel = (otherId) => `dm:${[currentUser.id, otherId].sort().join(':')}`;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h2 className="font-semibold text-sm">Conversas</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <button
          onClick={() => onSelect('geral')}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
            activeChannel === 'geral' ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
          )}
        >
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Hash className="w-4 h-4 text-primary" />
          </div>
          <span className="truncate">Geral</span>
        </button>

        <div className="pt-3 pb-1 px-3 text-xs font-medium text-muted-foreground uppercase">Direto</div>
        {users.filter(u => u.id !== currentUser.id).map(u => {
          const ch = dmChannel(u.id);
          const active = activeChannel === ch;
          return (
            <button
              key={u.id}
              onClick={() => onSelect(ch)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {u.full_name?.[0] ? (
                  <span className="text-xs font-semibold text-muted-foreground">{u.full_name[0].toUpperCase()}</span>
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <span className="truncate">{u.full_name || u.email}</span>
            </button>
          );
        })}
        {users.length <= 1 && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum outro usuário</p>
        )}
      </div>
    </div>
  );
}