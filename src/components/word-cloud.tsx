// src/components/word-cloud.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordData {
  word: string;
  count: number;
}

const COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#f59e0b', '#14b8a6', '#0ea5e9', '#d946ef',
];

function seededPosition(word: string, index: number, total: number) {
  const seed = word.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  // Golden-ratio spiral for even area-filling distribution
  const goldenAngle = 137.508;
  const angle = ((index * goldenAngle + seed * 47) % 360) * (Math.PI / 180);
  // sqrt growth fills the circle evenly (not clustered at center)
  const radiusPct = 12 + Math.sqrt((index + 0.5) / total) * 82;
  // Per-word jitter to break up spiral regularity
  const jx = ((seed * 7 + index * 11) % 14) - 7;
  const jy = ((seed * 13 + index * 17) % 14) - 7;
  return {
    x: Math.cos(angle) * radiusPct + jx,
    y: Math.sin(angle) * radiusPct * 0.78 + jy,
    rotation: ((seed * 3 + index * 11) % 24) - 12,
  };
}

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
  const prevCounts = useRef<Map<string, number>>(new Map());

  async function fetchWords() {
    const res = await fetch(`/api/room/${roomCode}/vote?interactionId=${interactionId}`);
    if (!res.ok) return;
    const data = (await res.json()) as WordData[];
    // Track previous counts for grow/shrink detection
    data.forEach(w => prevCounts.current.set(w.word, w.count));
    setWords(data);
  }

  useEffect(() => {
    fetchWords();
    const interval = live ? setInterval(fetchWords, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  const maxCount = Math.max(...words.map(w => w.count), 1);

  // Exponential size curve — popular words dominate visually
  const positioned = useMemo(() => {
    const top = words.slice(0, 60);
    return top.map((item, i) => {
      const pos = seededPosition(item.word, i, top.length);
      // Exponential scaling: size = 1 + (count/max)^0.6 * 3.5
      // Using pow 0.6 makes mid-tier words larger than linear mapping
      const ratio = item.count / maxCount;
      const exponentialRatio = Math.pow(ratio, 0.6);
      const size = 1.0 + exponentialRatio * 3.5; // 1.0rem to 4.5rem
      const opacity = 0.55 + exponentialRatio * 0.45;
      const color = COLORS[i % COLORS.length];

      return { ...item, ...pos, size, opacity, color, isTop: i === 0 && ratio > 0 };
    });
  }, [words, maxCount]);

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <motion.p
          className="text-slate-400"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          等待词云生成...
        </motion.p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[360px] flex items-center justify-center overflow-hidden">
      <div className="relative w-full max-w-2xl" style={{ paddingBottom: '80%' }}>
        <AnimatePresence>
          {positioned.map((item, i) => (
            <motion.span
              key={item.word}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: item.opacity,
                scale: 1,
                x: `${item.x}px`,
                y: `${item.y}px`,
                rotate: `${item.rotation}deg`,
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                type: 'spring',
                stiffness: 180 - i * 2,
                damping: 16,
                delay: Math.min(i * 0.03, 1.5),
              }}
              className="absolute top-1/2 left-1/2 font-bold cursor-default select-none whitespace-nowrap"
              style={{
                fontSize: `${item.size}rem`,
                color: item.color,
                transform: 'translate(-50%, -50%)',
                textShadow: item.isTop
                  ? `0 0 20px ${item.color}, 0 2px 12px rgba(0,0,0,0.4)`
                  : '0 2px 8px rgba(0,0,0,0.3)',
              }}
              title={`${item.word} (${item.count})`}
            >
              {item.isTop && (
                <motion.span
                  className="absolute inset-0 rounded-full blur-xl"
                  style={{
                    background: item.color,
                    transform: 'translate(-50%, -50%) scale(1.5)',
                    opacity: 0.15,
                  }}
                  animate={{ opacity: [0.1, 0.2, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                />
              )}
              {item.word}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
