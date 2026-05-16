// src/components/countdown-timer.tsx
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function CountdownTimer({
  timerSeconds,
  timerStartedAt,
  onExpired,
}: {
  timerSeconds: number;
  timerStartedAt: string;
  onExpired?: () => void;
}) {
  const [remaining, setRemaining] = useState(() => {
    const end = new Date(timerStartedAt).getTime() + timerSeconds * 1000;
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  });

  useEffect(() => {
    const end = new Date(timerStartedAt).getTime() + timerSeconds * 1000;
    const interval = setInterval(() => {
      const r = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [timerSeconds, timerStartedAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 10 && remaining > 0;
  const isExpired = remaining <= 0;

  return (
    <div className={cn(
      'text-center font-mono tabular-nums',
      isExpired ? 'text-red-500' : isUrgent ? 'text-amber-500 animate-pulse' : 'text-white',
    )}>
      {isExpired ? (
        <span className="text-lg font-bold">时间到！</span>
      ) : (
        <span className="text-xl md:text-2xl font-bold">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      )}
    </div>
  );
}
