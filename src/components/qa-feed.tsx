// src/components/qa-feed.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionData {
  id: string;
  content: string;
  asker_name: string;
  upvotes: number;
  created_at: string;
}

export function QaFeed({ roomCode, interactionId }: { roomCode: string; interactionId: string }) {
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

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-4 flex items-start gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 flex-col h-auto py-1 px-2"
                onClick={() => handleUpvote(q.id)}
              >
                <span className="text-lg leading-none">▲</span>
                <span className="text-xs">{q.upvotes}</span>
              </Button>
              <div>
                <p className="text-sm">{q.content}</p>
                {q.asker_name && (
                  <p className="text-xs text-slate-400 mt-1">— {q.asker_name}</p>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
      {questions.length === 0 && (
        <p className="text-slate-400 text-center py-8">还没有问题</p>
      )}
    </div>
  );
}
