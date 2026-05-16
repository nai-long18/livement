// src/components/audience-view.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/use-sse';
import { useSessionId } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveInteraction {
  id: string;
  type: 'poll' | 'qa' | 'wordcloud';
  title: string;
  config: string; // JSON string, e.g. '{"options":["A","B"]}'
}

export function AudienceView({ roomCode }: { roomCode: string }) {
  const sessionId = useSessionId();
  const [interaction, setInteraction] = useState<ActiveInteraction | null>(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [askerName, setAskerName] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resultPreview, setResultPreview] = useState<unknown>(null);
  const [pollOptions, setPollOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/room/${roomCode}/interaction`)
      .then(r => r.json())
      .then(data => {
        const live = data.find((i: { status: string }) => i.status === 'live');
        if (live) {
          setInteraction(live);
          // Parse poll options from config
          try {
            const config = JSON.parse(live.config);
            if (config.options) setPollOptions(config.options);
          } catch { setPollOptions([]); }
        }
      });
  }, [roomCode]);

  useSSE(roomCode, (event) => {
    if (event.type === 'interaction.update') {
      const data = event.data as { id: string; type: string; title: string; config: string; status: string };
      if (data.status === 'live') {
        setInteraction(data as ActiveInteraction);
        setSubmitted(false);
        setResultPreview(null);
        try {
          const config = JSON.parse(data.config);
          if (config.options) setPollOptions(config.options);
          else setPollOptions([]);
        } catch { setPollOptions([]); }
      } else if (data.status === 'closed' && interaction?.id === data.id) {
        setInteraction(null);
        setSubmitted(false);
        setResultPreview(null);
      }
    }
  });

  async function submitVote() {
    if (!sessionId || !interaction || !selectedOption) return;
    const res = await fetch(`/api/room/${roomCode}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactionId: interaction.id,
        optionText: selectedOption,
        voterId: sessionId,
      }),
    });
    const data = await res.json();
    setResultPreview(data);
    setSubmitted(true);
  }

  async function submitQuestion() {
    if (!sessionId || !interaction || !questionText.trim()) return;
    await fetch(`/api/room/${roomCode}/question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactionId: interaction.id,
        content: questionText.trim(),
        askerId: sessionId,
        askerName: askerName.trim(),
      }),
    });
    setQuestionText('');
    setAskerName('');
    setSubmitted(true);
  }

  async function submitWord() {
    if (!sessionId || !interaction || !wordInput.trim()) return;
    const res = await fetch(`/api/room/${roomCode}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactionId: interaction.id,
        optionText: wordInput.trim(),
        voterId: sessionId,
      }),
    });
    const data = await res.json();
    setResultPreview(data);
    setWordInput('');
    setSubmitted(true);
  }

  if (!interaction) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-xl">等待互动开始...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={interaction.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-center">{interaction.title}</h2>

            {interaction.type === 'poll' && !submitted && (
              <div className="space-y-2">
                {pollOptions.map((option, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedOption === option
                        ? 'border-primary bg-primary/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="poll-option"
                      value={option}
                      checked={selectedOption === option}
                      onChange={e => setSelectedOption(e.target.value)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span>{option}</span>
                  </label>
                ))}
                <Button onClick={submitVote} disabled={!selectedOption} className="w-full mt-3">
                  提交投票
                </Button>
              </div>
            )}

            {interaction.type === 'qa' && !submitted && (
              <div className="space-y-3">
                <Input
                  placeholder="你的名字 (选填)"
                  value={askerName}
                  onChange={e => setAskerName(e.target.value)}
                />
                <Input
                  placeholder="输入你的问题..."
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                />
                <Button onClick={submitQuestion} disabled={!questionText.trim()} className="w-full">
                  提交问题
                </Button>
              </div>
            )}

            {interaction.type === 'wordcloud' && !submitted && (
              <div className="space-y-3">
                <Input
                  placeholder="输入一个词..."
                  value={wordInput}
                  onChange={e => setWordInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitWord()}
                />
                <Button onClick={submitWord} disabled={!wordInput.trim()} className="w-full">
                  提交
                </Button>
              </div>
            )}

            {submitted && (
              <div className="text-center py-4">
                <p className="text-green-500 text-lg mb-2">✓ 已提交</p>
                <p className="text-slate-400 text-sm">等待创建者展示结果</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setSubmitted(false)}
                >
                  {interaction.type === 'qa' ? '再提一个问题' : '修改回答'}
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
