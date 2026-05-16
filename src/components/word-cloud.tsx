// src/components/word-cloud.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

interface WordData {
  word: string;
  count: number;
}

const COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#f59e0b', '#14b8a6', '#0ea5e9', '#d946ef',
];

export function WordCloud({
  roomCode,
  interactionId,
  live,
}: {
  roomCode: string;
  interactionId: string;
  live: boolean;
}) {
  const [words, setWords] = useState<WordData[]>([]);

  async function fetchWords() {
    const res = await fetch(`/api/room/${roomCode}/vote?interactionId=${interactionId}`);
    if (!res.ok) return;
    const data = await res.json();
    setWords(data);
  }

  useEffect(() => {
    fetchWords();
    const interval = live ? setInterval(fetchWords, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  const maxCount = Math.max(...words.map(w => w.count), 1);
  const minCount = Math.min(...words.map(w => w.count), maxCount);

  // Generate scattered positions deterministically from word index
  const positioned = useMemo(() => {
    return words.slice(0, 60).map((item, i) => {
      // Pseudo-random offset based on word string
      const seed = item.word.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const xJitter = ((seed * 7 + i * 13) % 80) - 40;
      const yJitter = ((seed * 11 + i * 17) % 60) - 30;
      const rotation = ((seed * 3) % 20) - 10;

      const ratio = (item.count - minCount) / (maxCount - minCount || 1);
      const size = 0.9 + ratio * 2.8; // 0.9rem to 3.7rem
      const opacity = 0.5 + ratio * 0.5; // 0.5 to 1.0
      const color = COLORS[i % COLORS.length];

      return { ...item, xJitter, yJitter, rotation, size, opacity, color };
    });
  }, [words, maxCount, minCount]);

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-slate-400">等待词云生成...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[320px] flex items-center justify-center overflow-hidden">
      <div className="relative w-full max-w-2xl" style={{ paddingBottom: '60%' }}>
        {positioned.map((item, i) => (
          <motion.span
            key={item.word}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: item.opacity,
              scale: 1,
              x: `${item.xJitter}px`,
              y: `${item.yJitter}px`,
              rotate: `${item.rotation}deg`,
            }}
            transition={{
              type: 'spring',
              stiffness: 200 - i * 2,
              damping: 15,
              delay: i * 0.04,
            }}
            className="absolute top-1/2 left-1/2 font-bold cursor-default select-none whitespace-nowrap"
            style={{
              fontSize: `${item.size}rem`,
              color: item.color,
              transform: 'translate(-50%, -50%)',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            title={`${item.word} (${item.count})`}
          >
            {item.word}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
