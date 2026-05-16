// src/components/poll-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface VoteResult {
  option_text: string;
  count: number;
}

function CountUp({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const duration = 500;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const linearProgress = Math.min(elapsed / duration, 1);
      const progress = 1 - Math.pow(1 - linearProgress, 3);
      setCount(Math.round(progress * target));
      if (linearProgress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <>{count}</>;
}

export function PollResults({
  roomCode,
  interactionId,
  live,
  isCreator = false,
  initialRevealed = false,
}: {
  roomCode: string;
  interactionId: string;
  live: boolean;
  isCreator?: boolean;
  initialRevealed?: boolean;
}) {
  const [results, setResults] = useState<{ total: number; options: VoteResult[] }>({
    total: 0,
    options: [],
  });
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(initialRevealed);

  async function fetchResults() {
    const res = await fetch(`/api/room/${roomCode}/vote?interactionId=${interactionId}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchResults();
    const interval = live ? setInterval(fetchResults, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  async function handleReveal() {
    setRevealed(true);
    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: interactionId, config: { revealed: true } }),
    });
  }

  if (loading) return <p className="text-slate-400">加载中...</p>;

  const sortedOptions = [...results.options].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sortedOptions.map(o => o.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">共 {results.total} 票</p>
        {isCreator && !revealed && results.total > 0 && (
          <Button onClick={handleReveal} size="sm">
            揭示结果
          </Button>
        )}
      </div>

      <AnimatePresence>
        {!revealed && results.total > 0 && !isCreator && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-slate-400 text-lg">等待揭示结果...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealed && sortedOptions.map((option, i) => {
          const pct = (option.count / maxCount) * 100;
          const totalPct = results.total > 0 ? Math.round((option.count / results.total) * 100) : 0;
          return (
            <motion.div
              key={option.option_text}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 18 }}
              className="space-y-1"
            >
              <div className="flex justify-between text-sm">
                <span className={i === 0 ? 'font-semibold' : ''}>{option.option_text}</span>
                <span className="text-slate-500">
                  <CountUp target={option.count} /> 票 ({totalPct}%)
                </span>
              </div>
              <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    i === 0
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.1 + 0.2, type: 'spring', stiffness: 80, damping: 18 }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!revealed && isCreator && results.total === 0 && (
        <p className="text-slate-400 text-center py-8">等待投票中...</p>
      )}
    </div>
  );
}
