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

function AuroraBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Deep space backdrop — center stage light behind content */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(30,64,175,0.12) 0%, rgba(15,23,42,0) 70%)',
        }}
      />
      {/* Top-left aurora — cool blue */}
      <motion.div
        className="absolute w-[900px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.1) 0%, transparent 65%)',
          left: '-20%', top: '-15%',
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, 30, -10, 0], y: [0, -20, 10, 0] }}
        transition={{ repeat: Infinity, duration: 16, ease: 'easeInOut' }}
      />
      {/* Bottom-right aurora — cyan tint */}
      <motion.div
        className="absolute w-[800px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.07) 0%, transparent 65%)',
          right: '-15%', bottom: '-10%',
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, -40, 10, 0], y: [0, 25, -15, 0] }}
        transition={{ repeat: Infinity, duration: 14, ease: 'easeInOut' }}
      />
      {/* Subtle top edge light */}
      <motion.div
        className="absolute w-full h-[400px]"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(147,197,253,0.04) 0%, transparent 70%)',
          top: 0, left: 0,
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
      />
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [greeting, setGreeting] = useState('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [clipboardHint, setClipboardHint] = useState('');

  useEffect(() => {
    setGreeting(getGreeting());
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
      {/* Aurora ambient glow */}
      <AuroraBackground />

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
              className="text-blue-200/50 text-sm font-light tracking-wide mb-6"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {greeting}今天想和谁连线？
            </motion.p>

            <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">LiveMent</h1>
            <p className="text-blue-200/40 text-sm font-light mb-12">实时互动，三秒开始</p>

            {/* CTA — refined jewel-like button */}
            <motion.div
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="mb-5"
            >
              <motion.button
                type="button"
                disabled={creating}
                onClick={handleCreate}
                className="relative w-full py-4 rounded-2xl text-lg font-semibold text-white overflow-hidden disabled:opacity-50 group"
                style={{
                  background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                  boxShadow: [
                    '0 2px 4px rgba(0,0,0,0.3)',
                    '0 6px 20px -4px rgba(37,99,235,0.4)',
                    '0 12px 40px -8px rgba(37,99,235,0.25)',
                    'inset 0 1px 0 rgba(255,255,255,0.15)',
                  ].join(', '),
                }}
              >
                {/* Inner top highlight — glass feel */}
                <div className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 40%)' }}
                />
                {/* Subtle center glow on hover */}
                <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)' }}
                />
                <span className="relative z-10">{creating ? '创建中...' : '＋ 创建新房间'}</span>
              </motion.button>
            </motion.div>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-slate-500 text-xs font-light tracking-wider">或</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Join form — glassmorphism */}
            <form onSubmit={handleJoin} className="flex gap-2.5 mb-3">
              <div className="relative flex-1">
                <Input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="输入房间码"
                  className="text-center text-lg tracking-widest uppercase font-mono border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-white placeholder:text-slate-500 rounded-xl h-11"
                  maxLength={6}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-blue-300 transition-colors"
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
              <motion.button
                type="submit"
                disabled={!joinCode.trim()}
                animate={{
                  background: joinCode.trim()
                    ? 'linear-gradient(180deg, #3b82f6, #2563eb)'
                    : 'linear-gradient(180deg, rgba(30,41,59,0.8), rgba(15,23,42,0.8))',
                  color: joinCode.trim() ? '#fff' : '#64748b',
                  boxShadow: joinCode.trim()
                    ? '0 0 20px -4px rgba(59,130,246,0.35)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  borderColor: joinCode.trim() ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                }}
                transition={{ duration: 0.3 }}
                className="px-5 py-2 rounded-xl text-sm font-semibold disabled:cursor-not-allowed border"
              >
                加入
              </motion.button>
            </form>

            {/* Clipboard hint */}
            <AnimatePresence>
              {clipboardHint && (
                <motion.button
                  className="text-xs text-blue-300/80 mb-3 hover:text-blue-200 transition-colors"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={handlePasteHint}
                >
                  {clipboardHint}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Recent rooms — glass pill tags */}
            <AnimatePresence>
              {recentRooms.length > 0 && (
                <motion.div
                  className="flex items-center justify-center gap-2 flex-wrap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="text-xs text-slate-500 font-light">最近：</span>
                  {recentRooms.slice(0, 3).map(room => (
                    <motion.button
                      key={room.code}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.04] backdrop-blur-sm text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/[0.06] transition-colors cursor-pointer"
                      onClick={() => handleRecentClick(room)}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
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
