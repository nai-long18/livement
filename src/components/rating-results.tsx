// src/components/rating-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/count-up';

interface RatingResult {
  type: 'rating';
  average: number;
  distribution: Record<string, number>;
  total: number;
  npsScore: number | null;
}

export function RatingResults({
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
  const [results, setResults] = useState<RatingResult>({ type: 'rating', average: 0, distribution: {}, total: 0, npsScore: null });
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

  const distribution = results.distribution;
  const entries = Object.entries(distribution)
    .sort(([a], [b]) => Number(b) - Number(a));
  const maxCount = Math.max(...Object.values(distribution), 1);
  const isNps = results.npsScore !== null;

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

      {revealed && results.total > 0 && (
        <>
          {/* Score display */}
          {isNps ? (
            <div className="text-center py-4">
              <motion.p
                className={`text-5xl font-bold ${
                  results.npsScore! >= 50 ? 'text-green-400' :
                  results.npsScore! >= 0 ? 'text-yellow-400' :
                  'text-red-400'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CountUp target={results.npsScore!} />
              </motion.p>
              <p className="text-sm text-slate-500 mt-1">NPS 分数 (-100 ~ +100)</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3">
              <motion.span
                className="text-5xl font-bold text-white"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                {results.average}
              </motion.span>
              <span className="text-2xl text-amber-400">{'★'.repeat(Math.round(results.average))}</span>
            </div>
          )}

          {/* NPS zone breakdown */}
          {isNps && (
            <div className="flex gap-2 text-center text-sm">
              {[
                { label: '贬损者 0-6', count: entries.filter(([k]) => Number(k) <= 6).reduce((s, [, c]) => s + c, 0), color: 'bg-red-500/20 text-red-400' },
                { label: '被动者 7-8', count: entries.filter(([k]) => Number(k) >= 7 && Number(k) <= 8).reduce((s, [, c]) => s + c, 0), color: 'bg-yellow-500/20 text-yellow-400' },
                { label: '推荐者 9-10', count: entries.filter(([k]) => Number(k) >= 9).reduce((s, [, c]) => s + c, 0), color: 'bg-green-500/20 text-green-400' },
              ].map(zone => (
                <div key={zone.label} className={`flex-1 rounded-lg p-2 ${zone.color}`}>
                  <p className="text-lg font-bold">{zone.count}</p>
                  <p className="text-xs opacity-80">{zone.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Distribution bars */}
          <div className="space-y-1.5">
            {entries.map(([value, count], i) => {
              const pct = (count / maxCount) * 100;
              const totalPct = results.total > 0 ? Math.round((count / results.total) * 100) : 0;
              const isMax = count === maxCount;
              return (
                <motion.div
                  key={value}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-2"
                >
                  <span className={`w-6 text-right text-sm font-mono ${isMax ? 'text-white font-semibold' : 'text-slate-400'}`}>
                    {isNps ? value : `${value}★`}
                  </span>
                  <div className="flex-1 h-7 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        isMax
                          ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
                          : 'bg-blue-500/50'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.08 + 0.3, type: 'spring', stiffness: 80 }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs text-slate-500">
                    <CountUp target={count} /> ({totalPct}%)
                  </span>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {revealed && results.total === 0 && (
        <p className="text-slate-400 text-center py-8">等待评分中...</p>
      )}
    </div>
  );
}
