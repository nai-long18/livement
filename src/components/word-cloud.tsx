// src/components/word-cloud.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
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

interface PlacedWord {
  x: number;
  y: number;
  w: number;
  h: number;
}

function estimateSize(word: string, fontSizeRem: number) {
  // Conservative bounding-box estimate including line-height, font-bold,
  // and font metrics overhead. Overestimate to guarantee no visual overlap.
  const px = fontSizeRem * 16;
  const cjk = (word.match(/[一-鿿]/g) || []).length;
  const latin = word.length - cjk;
  const width = cjk * px * 1.15 + latin * px * 0.7 + 16;
  const height = px * 1.8;
  return { width, height };
}

function boxesOverlap(a: PlacedWord, b: PlacedWord, margin: number) {
  const ax1 = a.x - a.w / 2 - margin;
  const ax2 = a.x + a.w / 2 + margin;
  const ay1 = a.y - a.h / 2 - margin;
  const ay2 = a.y + a.h / 2 + margin;
  const bx1 = b.x - b.w / 2;
  const bx2 = b.x + b.w / 2;
  const by1 = b.y - b.h / 2;
  const by2 = b.y + b.h / 2;
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function findPlacement(
  word: string,
  fontSizeRem: number,
  placed: PlacedWord[],
  seed: number,
  containerW: number,
  containerH: number,
): { x: number; y: number } | null {
  const { width, height } = estimateSize(word, fontSizeRem);
  const maxR = Math.min(containerW, containerH) / 2 - Math.max(width, height) / 2;
  const margin = Math.max(12, fontSizeRem * 6);

  // Spiral outward from center, exhaustive search
  const startAngle = (seed * 47) % 360;
  const totalSteps = 2000;
  for (let step = 0; step < totalSteps; step++) {
    const r = (step / totalSteps) * maxR;
    const a = (startAngle + step * 137.508) * (Math.PI / 180);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.78;

    const candidate: PlacedWord = { x, y, w: width, h: height };

    // Clamp to container bounds
    if (x - width / 2 < -containerW / 2 || x + width / 2 > containerW / 2) continue;
    if (y - height / 2 < -containerH / 2 || y + height / 2 > containerH / 2) continue;

    const overlaps = placed.some(p => boxesOverlap(candidate, p, margin));
    if (!overlaps) return { x: Math.round(x), y: Math.round(y) };
  }

  return null; // fallback — shouldn't happen with reasonable word counts
}

const CONTAINER_W = 640;
const CONTAINER_H = 512;

export function WordCloud({
  roomCode,
  interactionId,
  live,
  highlightWord = '',
}: {
  roomCode: string;
  interactionId: string;
  live: boolean;
  highlightWord?: string;
}) {
  const [words, setWords] = useState<WordData[]>([]);

  async function fetchWords() {
    const res = await fetch(`/api/room/${roomCode}/vote?interactionId=${interactionId}`);
    if (!res.ok) return;
    const data = (await res.json()) as WordData[];
    setWords(data);
  }

  useEffect(() => {
    fetchWords();
    const interval = live ? setInterval(fetchWords, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  const maxCount = Math.max(...words.map(w => w.count), 1);

  const positioned = useMemo(() => {
    // Sort by count descending — largest words placed first (center)
    const sorted = [...words]
      .sort((a, b) => b.count - a.count)
      .slice(0, 60);

    const seed = sorted.reduce((s, w) => s + w.word.charCodeAt(0), 0);
    const placed: PlacedWord[] = [];

    return sorted.map((item, i) => {
      const ratio = item.count / maxCount;
      const exponentialRatio = Math.pow(ratio, 0.6);
      const size = 1.0 + exponentialRatio * 3.5;
      const opacity = 0.55 + exponentialRatio * 0.45;
      let finalOpacity = opacity;
      if (highlightWord.trim()) {
        const match = item.word.toLowerCase().includes(highlightWord.trim().toLowerCase());
        finalOpacity = match ? 1 : 0.12;
      }
      const color = COLORS[i % COLORS.length];

      const pos = findPlacement(item.word, size, placed, seed + i, CONTAINER_W, CONTAINER_H);

      let x: number, y: number, rotation: number;
      if (pos) {
        x = pos.x;
        y = pos.y;
        rotation = ((seed * 3 + i * 11) % 20) - 10;
      } else {
        // Fallback: put at edge with deterministic offset
        const fallbackAngle = (i * 137.5) * (Math.PI / 180);
        const fallbackR = 180 + (i % 5) * 20;
        x = Math.cos(fallbackAngle) * fallbackR;
        y = Math.sin(fallbackAngle) * fallbackR * 0.78;
        rotation = 0;
      }

      placed.push({ x, y, w: estimateSize(item.word, size).width, h: estimateSize(item.word, size).height });

      return { ...item, x, y, rotation, size, opacity: finalOpacity, color, isTop: i === 0 && ratio > 0 };
    });
  }, [words, maxCount, highlightWord]);

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
                stiffness: 160 - i * 2,
                damping: 16,
                delay: Math.min(i * 0.03, 1.2),
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
                <span
                  className="absolute inset-0 rounded-full blur-xl pointer-events-none"
                  style={{
                    background: item.color,
                    transform: 'translate(-50%, -50%) scale(1.8)',
                    opacity: 0.12,
                  }}
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
