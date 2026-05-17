// src/components/leaderboard-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface VoteOption {
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

const medals = ['🥇', '🥈', '🥉'];

export function LeaderboardResults({
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
  const [results, setResults] = useState<{ total: number; options: VoteOption[] }>({
    total: 0,
    options: [],
  });
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(!isCreator || initialRevealed);

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

  const sorted = [...results.options].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sorted.map(o => o.count), 1);

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

      {!revealed && results.total > 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">等待揭示结果...</p>
        </div>
      )}

      {revealed && sorted.length > 0 && (
        <div className="space-y-1.5">
          {sorted.map((option, i) => {
            const pct = (option.count / maxCount) * 100;
            const totalPct = results.total > 0 ? Math.round((option.count / results.total) * 100) : 0;
            return (
              <motion.div
                key={option.option_text}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 120 }}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  i === 0
                    ? 'bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20'
                    : 'border border-transparent'
                }`}
              >
                {/* Rank badge */}
                <span className="w-8 text-center text-lg font-bold">
                  {i < 3 ? medals[i] : (
                    <span className="text-slate-500 text-sm">#{i + 1}</span>
                  )}
                </span>
                {/* Option name */}
                <span className={`flex-1 font-medium ${i === 0 ? 'text-white' : 'text-slate-300'}`}>
                  {option.option_text}
                </span>
                {/* Bar + count */}
                <div className="flex items-center gap-2 w-32">
                  <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        i === 0
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                          : i === 1
                            ? 'bg-slate-400'
                            : i === 2
                              ? 'bg-amber-600/60'
                              : 'bg-slate-600'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.1 + 0.3, type: 'spring', stiffness: 80 }}
                    />
                  </div>
                  <span className="w-14 text-right text-sm text-slate-400">
                    <CountUp target={option.count} /> <span className="text-xs">({totalPct}%)</span>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {revealed && results.total === 0 && (
        <p className="text-slate-400 text-center py-8">等待投票中...</p>
      )}
    </div>
  );
}
