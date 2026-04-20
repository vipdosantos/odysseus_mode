import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { base44 } from '@/api/base44Client';

export default function AppLayout() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar user={user} />
      </div>
      <MobileNav user={user} />
      <main className="flex-1 min-w-0 md:pb-0 pb-16">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}