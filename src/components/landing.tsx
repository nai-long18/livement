// src/components/landing.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

const RECENT_KEY = 'livement_recent_rooms';

interface RecentRoom {
  code: string;
  title: string;
  visitedAt: number;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，';
  if (h < 12) return '早上好，';
  if (h < 14) return '中午好，';
  if (h < 18) return '下午好，';
  return '晚上好，';
}

function loadRecent(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecent(room: RecentRoom) {
  const list = loadRecent().filter(r => r.code !== room.code);
  list.unshift(room);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
}

export function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [greeting] = useState(getGreeting);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [clipboardHint, setClipboardHint] = useState('');

  useEffect(() => {
    setRecentRooms(loadRecent());
  }, []);

  const checkClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/[A-Za-z0-9_-]{4,6}/);
      if (match && !joinCode) {
        setClipboardHint(`检测到房间码 ${match[0]}，点击粘贴`);
      }
    } catch {
      // Clipboard read requires permission / secure context
    }
  }, [joinCode]);

  useEffect(() => {
    checkClipboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setCreating(true);
    // 3-2-1 countdown
    for (let i = 3; i >= 0; i--) {
      setCountdown(i === 0 ? null : i);
      if (i > 0) await new Promise(r => setTimeout(r, 800));
    }
    const res = await fetch('/api/room', { method: 'POST' });
    const room = await res.json();
    saveRecent({ code: room.id, title: room.title || '未命名房间', visitedAt: Date.now() });
    router.push(`/room/${room.id}`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) return;
    saveRecent({ code, title: '加入的房间', visitedAt: Date.now() });
    router.push(`/join/${code}`);
  }

  function handleRecentClick(room: RecentRoom) {
    router.push(`/join/${room.code}`);
  }

  function handlePasteHint() {
    setJoinCode(clipboardHint.replace(/检测到房间码 /, '').replace(/，点击粘贴$/, ''));
    setClipboardHint('');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Ambient background glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 60%)',
            'radial-gradient(ellipse at 70% 40%, rgba(6,182,212,0.06) 0%, transparent 60%)',
            'radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 60%)',
          ],
        }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
      />

      <AnimatePresence mode="wait">
        {countdown !== null ? (
          <motion.div
            key="countdown"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="text-center z-10"
          >
            <motion.span
              key={countdown}
              initial={{ scale: 2, opacity: 0, filter: 'blur(8px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-7xl font-bold text-white tabular-nums"
            >
              {countdown}
            </motion.span>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-md px-4 text-center z-10"
          >
            {/* Greeting */}
            <motion.p
              className="text-slate-500 text-sm mb-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {greeting}今天想和谁连线？
            </motion.p>

            <h1 className="text-4xl font-bold text-white mb-2">LiveMent</h1>
            <p className="text-slate-400 mb-8">实时互动，三秒开始</p>

            {/* Create button with glow */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mb-4"
            >
              <Button
                size="lg"
                className="w-full text-lg relative overflow-hidden"
                onClick={handleCreate}
                disabled={creating}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                />
                {creating ? '创建中...' : '＋ 创建新房间'}
              </Button>
            </motion.div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-slate-500 text-sm">或</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {/* Join form */}
            <form onSubmit={handleJoin} className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="输入房间码"
                  className="text-center text-lg tracking-widest uppercase pr-9"
                  maxLength={6}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title="粘贴"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setJoinCode(text.trim().toUpperCase().slice(0, 6));
                    } catch { /* clipboard unavailable */ }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
              <Button type="submit" variant="secondary" disabled={!joinCode.trim()}>
                加入
              </Button>
            </form>

            {/* Clipboard hint */}
            <AnimatePresence>
              {clipboardHint && (
                <motion.button
                  className="text-xs text-cyan-400 mb-3 hover:text-cyan-300 transition-colors"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={handlePasteHint}
                >
                  {clipboardHint}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Recent rooms */}
            <AnimatePresence>
              {recentRooms.length > 0 && (
                <motion.div
                  className="flex items-center justify-center gap-2 flex-wrap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="text-xs text-slate-500">最近：</span>
                  {recentRooms.slice(0, 3).map(room => (
                    <motion.button
                      key={room.code}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50 transition-colors cursor-pointer"
                      onClick={() => handleRecentClick(room)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title={room.title}
                    >
                      {room.title.length > 8 ? room.title.slice(0, 8) + '…' : room.title}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
