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
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const config = type === 'poll' ? { options: options.filter(Boolean), multiple: false } : {};

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
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          ＋ 添加互动
        </Button>
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
            </div>
          )}

          <Button type="submit" disabled={submitting || !title.trim()} className="w-full">
            {submitting ? '创建中...' : '创建'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
