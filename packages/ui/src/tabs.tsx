'use client';

import type { ReactNode } from 'react';
import { cn } from './cn.ts';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export function Tabs({
  items,
  active,
  onChange,
  className,
  size = 'md',
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}
      onKeyDown={(e) => {
        const idx = items.findIndex((i) => i.id === active);
        if (e.key === 'ArrowRight') onChange(items[(idx + 1) % items.length]!.id);
        if (e.key === 'ArrowLeft') onChange(items[(idx - 1 + items.length) % items.length]!.id);
      }}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'shrink-0 border-b-2 font-medium transition-colors',
              size === 'sm' ? 'px-2.5 pb-1.5 text-xs' : 'px-3 pb-2 text-sm',
              selected
                ? 'border-brand text-fg'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge !== 0 && (
              <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] tabular-nums text-fg-muted">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0}>
      {children}
    </div>
  );
}
