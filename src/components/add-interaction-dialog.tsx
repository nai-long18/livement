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

type InteractionType = 'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard';

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
  // Rating-specific
  const [ratingType, setRatingType] = useState<'star' | 'nps'>('star');
  const [lowLabel, setLowLabel] = useState('');
  const [highLabel, setHighLabel] = useState('');
  // Leaderboard-specific
  const [maxSelect, setMaxSelect] = useState(3);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let config: Record<string, unknown> = {};
    if (type === 'poll') {
      config = { options: options.filter(Boolean), multiple };
    } else if (type === 'rating') {
      config = {
        ratingType,
        min: ratingType === 'star' ? 1 : 0,
        max: ratingType === 'star' ? 5 : 10,
      };
      if (ratingType === 'nps') {
        config.lowLabel = lowLabel;
        config.highLabel = highLabel;
      }
    } else if (type === 'leaderboard') {
      config = { options: options.filter(Boolean), maxSelect };
    }

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
          <div className="flex gap-2 flex-wrap">
            {([
              ['poll', '投票'],
              ['qa', '问答'],
              ['wordcloud', '词云'],
              ['rating', '评分'],
              ['leaderboard', '排行榜'],
            ] as [InteractionType, string][]).map(([t, label]) => (
              <Button
                key={t}
                type="button"
                variant={type === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => setType(t)}
              >
                {label}
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

          {type === 'rating' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={ratingType === 'star' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRatingType('star')}
                >
                  星级评分
                </Button>
                <Button
                  type="button"
                  variant={ratingType === 'nps' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRatingType('nps')}
                >
                  NPS 推荐值
                </Button>
              </div>
              {/* Preview */}
              <div className="text-center py-2 text-slate-500">
                {ratingType === 'star' ? (
                  <span className="text-lg tracking-widest text-amber-400">{'★'.repeat(5)}</span>
                ) : (
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-xs text-red-400">0</span>
                    <span className="text-xs text-slate-500">1-6 贬损</span>
                    <span className="text-xs text-yellow-500">7-8 被动</span>
                    <span className="text-xs text-green-400">9-10 推荐</span>
                    <span className="text-xs text-green-400">10</span>
                  </div>
                )}
              </div>
              {ratingType === 'nps' && (
                <div className="flex gap-2">
                  <Input
                    placeholder="左端文案 (默认: 完全不可能)"
                    value={lowLabel}
                    onChange={e => setLowLabel(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    placeholder="右端文案 (默认: 一定会)"
                    value={highLabel}
                    onChange={e => setHighLabel(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {type === 'leaderboard' && (
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">最多可选</span>
                <Input
                  type="number"
                  value={maxSelect}
                  onChange={e => setMaxSelect(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-8 text-sm"
                  min={1}
                />
                <span className="text-xs text-slate-500">个</span>
              </div>
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
