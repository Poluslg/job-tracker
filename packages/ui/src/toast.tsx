'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn.ts';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface ToastContextValue {
  toast: (message: string, tone?: Toast['tone']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASS: Record<Toast['tone'], string> = {
  info: 'border-border bg-surface text-fg',
  success: 'border-strong/40 bg-strong-subtle text-strong',
  error: 'border-danger/40 bg-danger-subtle text-danger',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-center gap-2 p-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto max-w-sm rounded-lg border px-3 py-2 text-xs shadow-lg',
              TONE_CLASS[t.tone],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  
  return ctx ?? { toast: () => {} };
}
