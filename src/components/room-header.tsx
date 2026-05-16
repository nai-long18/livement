'use client';

import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';

export function RoomHeader({ roomCode }: { roomCode: string }) {
  const { toast } = useToast();
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join/${roomCode}`);
  }, [roomCode]);

  function handleCopyCode() {
    navigator.clipboard.writeText(roomCode);
    toast('房间码已复制', 'success');
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(joinUrl);
    toast('加入链接已复制', 'success');
  }

  return (
    <header className="flex items-center justify-between p-3 lg:p-4 border-b border-slate-200 dark:border-slate-800 gap-2">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
        <h2 className="text-base lg:text-lg font-semibold whitespace-nowrap">
          房间: <span className="font-mono tracking-widest">{roomCode}</span>
        </h2>
        <Button variant="ghost" size="xs" onClick={handleCopyCode} className="hidden sm:inline-flex">
          复制码
        </Button>
        <Button variant="ghost" size="xs" onClick={handleCopyLink}>
          复制链接
        </Button>
      </div>
      <div className="flex items-center gap-1 lg:gap-2 shrink-0">
        <Button
          variant="outline"
          size="xs"
          className="lg:size-sm"
          nativeButton={false}
          render={<Link href={`/room/${roomCode}/present`} target="_blank" />}
        >
          演示
        </Button>
      </div>
    </header>
  );
}
