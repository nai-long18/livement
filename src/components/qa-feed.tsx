// src/components/qa-feed.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface QuestionData {
  id: string;
  content: string;
  asker_name: string;
  upvotes: number;
  created_at: string;
  answered: number;
  pinned: number;
}

export function QaFeed({
  roomCode,
  interactionId,
  isCreator = false,
  searchQuery = '',
}: {
  roomCode: string;
  interactionId: string;
  isCreator?: boolean;
  searchQuery?: string;
}) {
  const [questions, setQuestions] = useState<QuestionData[]>([]);

  async function fetchQuestions() {
    const res = await fetch(`/api/room/${roomCode}/question?interactionId=${interactionId}`);
    if (!res.ok) return;
    const data = await res.json();
    setQuestions(data);
  }

  useEffect(() => {
    fetchQuestions();
    const interval = setInterval(fetchQuestions, 3000);
    return () => clearInterval(interval);
  }, [interactionId]);

  async function handleUpvote(questionId: string) {
    await fetch(`/api/room/${roomCode}/question`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId }),
    });
    fetchQuestions();
  }

  async function handleStatusUpdate(questionId: string, updates: { answered?: boolean; pinned?: boolean }) {
    await fetch(`/api/room/${roomCode}/question`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, ...updates }),
    });
    fetchQuestions();
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const q = searchQuery.toLowerCase();
    return questions.filter(item =>
      item.content.toLowerCase().includes(q) ||
      item.asker_name.toLowerCase().includes(q)
    );
  }, [questions, searchQuery]);

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {filtered.map((q) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className={cn(
              'p-4 flex items-start gap-3 transition-colors',
              q.answered ? 'opacity-60 bg-green-50/30 dark:bg-green-950/10' : '',
              q.pinned ? 'border-l-4 border-l-amber-400 bg-amber-50/20 dark:bg-amber-950/10' : '',
            )}>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 flex-col h-auto py-1 px-2"
                onClick={() => handleUpvote(q.id)}
              >
                <span className="text-lg leading-none">▲</span>
                <span className="text-xs">{q.upvotes}</span>
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className="text-sm flex-1">{q.content}</p>
                  {isCreator && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleStatusUpdate(q.id, { pinned: !q.pinned })}
                        className={cn(
                          'text-xs p-1 rounded transition-colors',
                          q.pinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500',
                        )}
                        title={q.pinned ? '取消置顶' : '置顶'}
                      >
                        📌
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(q.id, { answered: !q.answered })}
                        className={cn(
                          'text-xs p-1 rounded transition-colors',
                          q.answered ? 'text-green-500' : 'text-slate-400 hover:text-green-500',
                        )}
                        title={q.answered ? '取消标记' : '标记为已回答'}
                      >
                        ✓
                      </button>
                    </div>
                  )}
                </div>
                {(q.asker_name || q.answered) && (
                  <div className="flex items-center gap-2 mt-1">
                    {q.asker_name && (
                      <p className="text-xs text-slate-400">— {q.asker_name}</p>
                    )}
                    {q.answered && (
                      <span className="text-xs text-green-500 font-medium">已回答</span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
      {filtered.length === 0 && (
        <p className="text-slate-400 text-center py-8">
          {searchQuery ? '没有匹配的问题' : '还没有问题'}
        </p>
      )}
    </div>
  );
}
