// src/components/room-header.tsx
'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import Link from 'next/link';

export function RoomHeader({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">
          房间: <span className="font-mono tracking-widest">{roomCode}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/room/${roomCode}/present`} target="_blank" />}
        >
          进入演示
        </Button>
      </div>
    </header>
  );
}
