import React from 'react';
import { cn } from '@/lib/utils';

export default function StatsCard({ title, value, icon: Icon, trend, color = "text-primary" }) {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1 font-medium", trend > 0 ? "text-green-600" : "text-red-500")}>
              {trend > 0 ? "+" : ""}{trend}% este mês
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl bg-primary/10", color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}