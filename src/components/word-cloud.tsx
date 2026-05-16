// src/components/word-cloud.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WordData {
  word: string;
  count: number;
}

const COLORS = [
  'text-blue-500', 'text-cyan-500', 'text-teal-500',
  'text-indigo-500', 'text-violet-500', 'text-purple-500',
  'text-pink-500', 'text-rose-500',
];

const FONT_SIZES = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'];

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

  return (
    <div className="flex flex-wrap justify-center items-center gap-3 p-8 min-h-[300px]">
      {words.map((item, i) => {
        const sizeIndex = Math.min(
          Math.floor((item.count / maxCount) * (FONT_SIZES.length - 1)),
          FONT_SIZES.length - 1
        );
        const color = COLORS[i % COLORS.length];

        return (
          <motion.span
            key={item.word}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: i * 0.03,
            }}
            className={`${FONT_SIZES[sizeIndex]} ${color} font-bold cursor-default select-none`}
            title={`${item.word} (${item.count})`}
          >
            {item.word}
          </motion.span>
        );
      })}
      {words.length === 0 && (
        <p className="text-slate-400">等待词云生成...</p>
      )}
    </div>
  );
}
