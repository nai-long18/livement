// src/components/landing.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    const res = await fetch('/api/room', { method: 'POST' });
    const room = await res.json();
    router.push(`/room/${room.id}`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (joinCode.trim()) {
      router.push(`/join/${joinCode.trim()}`);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md px-4 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">LiveMent</h1>
        <p className="text-slate-400 mb-8">实时互动，三秒开始</p>

        <Button
          size="lg"
          className="w-full mb-4 text-lg"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? '创建中...' : '＋ 创建新房间'}
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-sm">或</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <Input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="输入房间码"
            className="text-center text-lg tracking-widest uppercase"
            maxLength={6}
          />
          <Button type="submit" variant="secondary" disabled={!joinCode.trim()}>
            加入
          </Button>
        </form>
      </div>
    </main>
  );
}
