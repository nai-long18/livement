// src/components/add-interaction-dialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type InteractionType = 'poll' | 'qa' | 'wordcloud';

export function AddInteractionDialog({
  roomCode,
  onAdded,
}: {
  roomCode: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InteractionType>('poll');
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState('');
  const [autoClose, setAutoClose] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const config: Record<string, unknown> = type === 'poll' ? { options: options.filter(Boolean), multiple } : {};
    if (timerSeconds) {
      config.timerSeconds = parseInt(timerSeconds);
      config.autoClose = autoClose;
    }

    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, config }),
    });

    setSubmitting(false);
    setOpen(false);
    setTitle('');
    setOptions(['', '']);
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" className="w-full" />}
      >
        ＋ 添加互动
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加互动环节</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {(['poll', 'qa', 'wordcloud'] as InteractionType[]).map(t => (
              <Button
                key={t}
                type="button"
                variant={type === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType(t)}
              >
                {t === 'poll' ? '投票' : t === 'qa' ? '问答' : '词云'}
              </Button>
            ))}
          </div>

          <Input
            placeholder="互动标题"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />

          {type === 'poll' && (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <Input
                  key={i}
                  placeholder={`选项 ${i + 1}`}
                  value={opt}
                  onChange={e => {
                    const next = [...options];
                    next[i] = e.target.value;
                    if (i === options.length - 1 && e.target.value) {
                      next.push('');
                    }
                    setOptions(next);
                  }}
                />
              ))}
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiple}
                  onChange={e => setMultiple(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                允许多选
              </label>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500">倒计时（可选）</p>
            <div className="flex gap-1.5 flex-wrap">
              {[30, 60, 90, 120].map(s => (
                <Button
                  key={s}
                  type="button"
                  variant={timerSeconds === String(s) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimerSeconds(String(s))}
                >
                  {s}s
                </Button>
              ))}
              <Input
                placeholder="自定义"
                value={timerSeconds}
                onChange={e => setTimerSeconds(e.target.value)}
                className="w-20 h-8 text-sm"
                type="number"
              />
            </div>
            {timerSeconds && (
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoClose}
                  onChange={e => setAutoClose(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                时间到自动关闭
              </label>
            )}
          </div>

          <Button type="submit" disabled={submitting || !title.trim()} className="w-full">
            {submitting ? '创建中...' : '创建'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
