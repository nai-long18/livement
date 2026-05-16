// src/components/poll-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface VoteResult {
  option_text: string;
  count: number;
}

export function PollResults({
  roomCode,
  interactionId,
  live,
}: {
  roomCode: string;
  interactionId: string;
  live: boolean;
}) {
  const [results, setResults] = useState<{ total: number; options: VoteResult[] }>({
    total: 0,
    options: [],
  });
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p className="text-slate-400">加载中...</p>;

  const maxCount = Math.max(...results.options.map(o => o.count), 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">共 {results.total} 票</p>
      {results.options.map((option, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{option.option_text}</span>
            <span className="text-slate-500">
              {option.count} 票
              {results.total > 0 && ` (${Math.round((option.count / results.total) * 100)}%)`}
            </span>
          </div>
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(option.count / maxCount) * 100}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
