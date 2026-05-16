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
  config: string;
}

type PageState = 'loading' | 'waiting' | 'active' | 'not-found';

function SkeletonCard() {
  return (
    <Card className="p-6 space-y-4 animate-pulse">
      <div className="h-7 bg-slate-800 rounded w-3/4 mx-auto" />
      <div className="space-y-2">
        <div className="h-14 bg-slate-800 rounded" />
        <div className="h-14 bg-slate-800 rounded" />
      </div>
      <div className="h-10 bg-slate-800 rounded" />
    </Card>
  );
}

export function AudienceView({ roomCode }: { roomCode: string }) {
  const sessionId = useSessionId();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [interaction, setInteraction] = useState<ActiveInteraction | null>(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isMultiple, setIsMultiple] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [askerName, setAskerName] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resultPreview, setResultPreview] = useState<unknown>(null);
  const [pollOptions, setPollOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/room/${roomCode}/interaction`)
      .then(r => {
        if (!r.ok) { setPageState('not-found'); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        const live = data.find((i: { status: string }) => i.status === 'live');
        if (live) {
          setInteraction(live);
          setPageState('active');
          try {
            const config = JSON.parse(live.config);
            if (config.options) setPollOptions(config.options);
            if (config.multiple) setIsMultiple(config.multiple);
          } catch { setPollOptions([]); }
        } else {
          setPageState('waiting');
        }
      })
      .catch(() => setPageState('not-found'));
  }, [roomCode]);

  const { isConnected } = useSSE(roomCode, (event) => {
    if (event.type === 'interaction.update') {
      const data = event.data as { id: string; type: string; title: string; config: string; status: string };
      if (data.status === 'live') {
        setInteraction(data as ActiveInteraction);
        setPageState('active');
        setSubmitted(false);
        setResultPreview(null);
        try {
          const config = JSON.parse(data.config);
          if (config.options) setPollOptions(config.options);
          if (config.multiple) setIsMultiple(config.multiple);
          else { setPollOptions([]); setIsMultiple(false); }
        } catch { setPollOptions([]); }
      } else if (data.status === 'closed' && interaction?.id === data.id) {
        setInteraction(null);
        setPageState('waiting');
        setSubmitted(false);
        setResultPreview(null);
      }
    }
  });

  async function submitVote() {
    if (!sessionId || !interaction) return;
    if (!isMultiple && !selectedOption) return;
    if (isMultiple && selectedOptions.length === 0) return;

    const optionsToSubmit = isMultiple ? selectedOptions : [selectedOption];

    for (const opt of optionsToSubmit) {
      await fetch(`/api/room/${roomCode}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactionId: interaction.id,
          optionText: opt,
          voterId: sessionId,
        }),
      });
    }
    setResultPreview({ total: optionsToSubmit.length });
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

  if (pageState === 'loading') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <SkeletonCard />
        </div>
      </main>
    );
  }

  if (pageState === 'not-found') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm">
          <p className="text-4xl mb-3">🔗</p>
          <h2 className="text-lg font-semibold text-white mb-2">房间不存在或已关闭</h2>
          <p className="text-slate-400 text-sm">请检查房间码是否正确，或联系创建者获取新的链接。</p>
        </Card>
      </main>
    );
  }

  if (pageState === 'waiting') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <p className="text-3xl mb-3">⏳</p>
          </motion.div>
          <h2 className="text-lg font-semibold text-white mb-1">等待互动开始</h2>
          <p className="text-slate-400 text-sm">创建者正在准备下一个互动环节。</p>
          {!isConnected && (
            <p className="text-amber-500 text-xs mt-3">与服务器连接中...</p>
          )}
        </Card>
      </main>
    );
  }

  if (!interaction) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* SSE Disconnect Banner */}
      {!isConnected && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/90 text-black text-center text-sm py-1.5 z-50">
          连接已断开，正在重连...
        </div>
      )}

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
                {isMultiple && (
                  <p className="text-xs text-slate-400 -mb-1">可多选</p>
                )}
                {pollOptions.map((option, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isMultiple
                        ? selectedOptions.includes(option)
                          ? 'border-primary bg-primary/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        : selectedOption === option
                          ? 'border-primary bg-primary/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type={isMultiple ? 'checkbox' : 'radio'}
                      name="poll-option"
                      value={option}
                      checked={isMultiple ? selectedOptions.includes(option) : selectedOption === option}
                      onChange={e => {
                        if (isMultiple) {
                          setSelectedOptions(prev =>
                            e.target.checked ? [...prev, option] : prev.filter(o => o !== option)
                          );
                        } else {
                          setSelectedOption(e.target.value);
                        }
                      }}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span>{option}</span>
                  </label>
                ))}
                <Button
                  onClick={submitVote}
                  disabled={isMultiple ? selectedOptions.length === 0 : !selectedOption}
                  className="w-full mt-3"
                >
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
                  onClick={() => {
                    setSubmitted(false);
                    setSelectedOption('');
                    setSelectedOptions([]);
                  }}
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
