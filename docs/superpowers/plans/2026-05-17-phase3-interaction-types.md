# Phase 3: New Interaction Types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `rating` (star + NPS) and `leaderboard` (ranked multi-select poll) interaction types.

**Architecture:** Both new types reuse the `vote` table and existing API infrastructure. Rating stores numeric scores as vote option_text; leaderboard stores selected options with multi-vote support. New result components handle type-specific rendering. The existing poll/qa/wordcloud pattern is followed exactly.

**Tech Stack:** TypeScript, Next.js 16, better-sqlite3, framer-motion, TailwindCSS v4, vitest

---

### Task 1: Extend InteractionType and add multi-vote support

**Files:**
- Modify: `src/lib/interaction.ts:1-16` (type union), `:76-101` (submitVote), new function
- Modify: `src/lib/__tests__/interaction.test.ts:1-37` (schema CHECK), `:73-79` (existing vote test)

- [ ] **Step 1: Update the test file — add new types to CHECK constraint and write failing tests**

In `src/lib/__tests__/interaction.test.ts`, update the `interaction` table CHECK constraint in the `vi.mock` block at line 17:

```typescript
type TEXT NOT NULL CHECK(type IN ('poll', 'qa', 'wordcloud', 'rating', 'leaderboard')),
```

Add new test cases after the existing `getWordCloudData` test (before the closing `});`):

```typescript
  it('createInteraction accepts rating type', () => {
    const i = createInteraction(ROOM, 'rating', '评分', {
      ratingType: 'star', min: 1, max: 5,
    });
    expect(i.type).toBe('rating');
    const config = JSON.parse(i.config);
    expect(config.ratingType).toBe('star');
    expect(config.max).toBe(5);
  });

  it('createInteraction accepts leaderboard type', () => {
    const i = createInteraction(ROOM, 'leaderboard', '排行榜', {
      options: ['A', 'B', 'C'], maxSelect: 3,
    });
    expect(i.type).toBe('leaderboard');
    const config = JSON.parse(i.config);
    expect(config.options).toEqual(['A', 'B', 'C']);
    expect(config.maxSelect).toBe(3);
  });

  it('submitMultiVote inserts multiple votes for leaderboard', () => {
    const i = createInteraction(ROOM, 'leaderboard', 'LB', {
      options: ['X', 'Y', 'Z'], maxSelect: 2,
    });
    updateInteractionStatus(i.id, 'live');

    const { submitMultiVote } = require('../interaction');
    submitMultiVote(i.id, ['X', 'Z'], 'voter1');

    const results = getVoteResults(i.id);
    expect(results.total).toBe(2);
    expect(results.options.find((o: { option_text: string }) => o.option_text === 'X')!.count).toBe(1);
    expect(results.options.find((o: { option_text: string }) => o.option_text === 'Z')!.count).toBe(1);
  });

  it('submitMultiVote replaces previous votes on re-submit', () => {
    const i = createInteraction(ROOM, 'leaderboard', 'LB2', {
      options: ['A', 'B', 'C'], maxSelect: 2,
    });
    updateInteractionStatus(i.id, 'live');

    const { submitMultiVote } = require('../interaction');
    submitMultiVote(i.id, ['A', 'B'], 'voter2');
    submitMultiVote(i.id, ['B', 'C'], 'voter2'); // re-submit

    const results = getVoteResults(i.id);
    expect(results.total).toBe(2); // still 2, not 4
    expect(results.options.find((o: { option_text: string }) => o.option_text === 'B')!.count).toBe(1);
    expect(results.options.find((o: { option_text: string }) => o.option_text === 'C')!.count).toBe(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/interaction.test.ts 2>&1`
Expected: FAIL — CHECK constraint fails for 'rating' (the schema rejects unknown types), or TypeError for `submitMultiVote`.

- [ ] **Step 3: Extend InteractionType and add submitMultiVote**

In `src/lib/interaction.ts`, change line 5:

```typescript
export type InteractionType = 'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard';
```

Add the `submitMultiVote` function after `getVoteResults` (after line 121):

```typescript
export function submitMultiVote(
  interactionId: string,
  optionTexts: string[],
  voterId: string
): void {
  const run = db.transaction(() => {
    // Delete all previous votes from this voter for this interaction
    db.prepare('DELETE FROM vote WHERE interaction_id = ? AND voter_id = ?')
      .run(interactionId, voterId);
    // Insert new rows
    const stmt = db.prepare(
      'INSERT INTO vote (id, interaction_id, option_text, voter_id) VALUES (?, ?, ?, ?)'
    );
    for (const opt of optionTexts) {
      stmt.run(nanoid(), interactionId, opt, voterId);
    }
  });
  run();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/interaction.test.ts 2>&1`
Expected: All tests PASS (including the new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/interaction.ts src/lib/__tests__/interaction.test.ts
git commit -m "feat: extend InteractionType with rating and leaderboard, add submitMultiVote"
```

---

### Task 2: Update interaction API route type validation

**Files:**
- Modify: `src/app/api/room/[code]/interaction/route.ts:26`

- [ ] **Step 1: Update type validation**

In `src/app/api/room/[code]/interaction/route.ts`, change line 27:

```typescript
if (!type || !['poll', 'qa', 'wordcloud', 'rating', 'leaderboard'].includes(type)) {
```

- [ ] **Step 2: Run dev server to verify**

Run: `npx next dev --port 3001 2>&1 &`
Start the dev server and verify no build errors by checking that the server starts successfully.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/room/[code]/interaction/route.ts
git commit -m "feat: allow rating and leaderboard types in interaction API"
```

---

### Task 3: Add rating results with NPS calculation

**Files:**
- Modify: `src/lib/interaction.ts` (add `getRatingResults` after `getVoteResults`)
- Modify: `src/app/api/room/[code]/vote/route.ts:53-75` (GET handler)
- Modify: `src/app/api/room/[code]/vote/route.ts:12-51` (POST handler for rating & leaderboard)

- [ ] **Step 1: Write the failing test for getRatingResults**

In `src/lib/__tests__/interaction.test.ts`, add after the `submitMultiVote` tests:

```typescript
  it('getRatingResults returns average, distribution, and total', () => {
    const i = createInteraction(ROOM, 'rating', '星级评分', {
      ratingType: 'star', min: 1, max: 5,
    });
    updateInteractionStatus(i.id, 'live');

    submitVote(i.id, '5', 'u1');
    submitVote(i.id, '4', 'u2');
    submitVote(i.id, '4', 'u3');
    submitVote(i.id, '3', 'u4');

    const { getRatingResults } = require('../interaction');
    const r = getRatingResults(i.id);
    expect(r.type).toBe('rating');
    expect(r.total).toBe(4);
    expect(r.average).toBeCloseTo(4.0, 1);
    expect(r.distribution).toEqual({ '1': 0, '2': 0, '3': 1, '4': 2, '5': 1 });
  });

  it('getRatingResults calculates NPS score correctly', () => {
    const i = createInteraction(ROOM, 'rating', 'NPS', {
      ratingType: 'nps', min: 0, max: 10,
    });
    updateInteractionStatus(i.id, 'live');

    // 3 promoters (9-10), 4 passives (7-8), 3 detractors (0-6) = 10 total
    submitVote(i.id, '10', 'u1');
    submitVote(i.id, '9', 'u2');
    submitVote(i.id, '9', 'u3');
    submitVote(i.id, '8', 'u4');
    submitVote(i.id, '7', 'u5');
    submitVote(i.id, '7', 'u6');
    submitVote(i.id, '7', 'u7');
    submitVote(i.id, '5', 'u8');
    submitVote(i.id, '3', 'u9');
    submitVote(i.id, '0', 'u10');

    const { getRatingResults } = require('../interaction');
    const r = getRatingResults(i.id);
    expect(r.total).toBe(10);
    expect(r.npsScore).toBe(0); // (3 - 3) / 10 * 100 = 0
    expect(r.distribution['10']).toBe(1);
    expect(r.distribution['0']).toBe(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/interaction.test.ts 2>&1`
Expected: FAIL — `getRatingResults` is not a function.

- [ ] **Step 3: Implement getRatingResults in interaction.ts**

Add after the `getVoteResults` function (after line 121):

```typescript
export interface RatingResult {
  type: 'rating';
  average: number;
  distribution: Record<string, number>;
  total: number;
  npsScore: number | null;
}

export function getRatingResults(interactionId: string): RatingResult {
  const interaction = getInteraction(interactionId);
  if (!interaction) return { type: 'rating', average: 0, distribution: {}, total: 0, npsScore: null };

  const config = JSON.parse(interaction.config);
  const min = config.min ?? 1;
  const max = config.max ?? 5;

  // Initialize distribution with all zeros
  const distribution: Record<string, number> = {};
  for (let v = min; v <= max; v++) {
    distribution[String(v)] = 0;
  }

  const rows = db.prepare(
    'SELECT option_text, COUNT(*) as count FROM vote WHERE interaction_id = ? GROUP BY option_text'
  ).all(interactionId) as { option_text: string; count: number }[];

  let sum = 0;
  let total = 0;
  for (const row of rows) {
    distribution[row.option_text] = row.count;
    sum += Number(row.option_text) * row.count;
    total += row.count;
  }

  const average = total > 0 ? sum / total : 0;

  let npsScore: number | null = null;
  if (config.ratingType === 'nps' && total > 0) {
    const promoters = rows
      .filter(r => Number(r.option_text) >= 9)
      .reduce((s, r) => s + r.count, 0);
    const detractors = rows
      .filter(r => Number(r.option_text) <= 6)
      .reduce((s, r) => s + r.count, 0);
    npsScore = Math.round(((promoters - detractors) / total) * 100);
  }

  return { type: 'rating', average: Math.round(average * 10) / 10, distribution, total, npsScore };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/interaction.test.ts 2>&1`
Expected: All tests PASS.

- [ ] **Step 5: Update vote route POST handler for rating and leaderboard**

In `src/app/api/room/[code]/vote/route.ts`, update imports (line 9):

```typescript
import {
  getInteraction,
  submitVote,
  getVoteResults,
  submitWord,
  getWordCloudData,
  submitMultiVote,
  getRatingResults,
} from '@/lib/interaction';
```

Replace the POST handler's type-dispatch (lines 36-50):

```typescript
  if (interaction.type === 'wordcloud') {
    submitWord(interactionId, optionText, voterId);
    const data = getWordCloudData(interactionId);
    publishToRoom(code, { type: 'wordcloud.update', data });
    return NextResponse.json({ success: true, data });
  }

  if (interaction.type === 'rating') {
    submitVote(interactionId, optionText, voterId);
    const results = getRatingResults(interactionId);
    publishToRoom(code, { type: 'vote.update', data: results });
    return NextResponse.json({ success: true, ...results });
  }

  if (interaction.type === 'leaderboard') {
    const { optionTexts } = body as { optionTexts: string[] };
    if (!optionTexts || optionTexts.length === 0) {
      return NextResponse.json({ error: 'optionTexts required' }, { status: 400 });
    }
    submitMultiVote(interactionId, optionTexts, voterId);
    const voteResults = getVoteResults(interactionId);
    publishToRoom(code, { type: 'vote.update', data: voteResults });
    return NextResponse.json({ success: true, ...voteResults });
  }

  // Poll
  const result = submitVote(interactionId, optionText, voterId);
  if (!result.success) return NextResponse.json(result, { status: 409 });

  const voteResults = getVoteResults(interactionId);
  publishToRoom(code, { type: 'vote.update', data: voteResults });

  return NextResponse.json({ success: true, ...voteResults });
```

- [ ] **Step 6: Update vote route GET handler for rating**

Replace the GET handler (lines 53-75):

```typescript
  if (interaction.type === 'wordcloud') {
    const data = getWordCloudData(interactionId);
    return NextResponse.json(data);
  }

  if (interaction.type === 'rating') {
    const results = getRatingResults(interactionId);
    return NextResponse.json(results);
  }

  const results = getVoteResults(interactionId);
  return NextResponse.json(results);
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/interaction.ts src/lib/__tests__/interaction.test.ts src/app/api/room/[code]/vote/route.ts
git commit -m "feat: add rating results with NPS calculation, leaderboard multi-vote endpoint"
```

---

### Task 4: Update export route for rating and leaderboard

**Files:**
- Modify: `src/app/api/room/[code]/export/route.ts:32` (type param), `:41-70` (switch cases)

- [ ] **Step 1: Add rating and leaderboard export cases**

In `src/app/api/room/[code]/export/route.ts`, update the type annotation on line 32:

```typescript
  const type = searchParams.get('type') as 'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard';
```

Add after the `poll` case (before `case 'qa':`):

```typescript
    case 'rating': {
      const { getRatingResults } = await import('@/lib/interaction');
      const results = getRatingResults(interactionId);
      const rows = Object.entries(results.distribution)
        .sort(([a], [b]) => Number(b) - Number(a));
      csv = formatCsv(['评分', '人数', '占比'], rows.map(([score, count]) => {
        const pct = results.total > 0 ? Math.round((count / results.total) * 100) + '%' : '0%';
        return [score, String(count), pct];
      }));
      // Append summary row for NPS
      if (results.npsScore !== null) {
        csv += '\nNPS 分数,' + results.npsScore;
      }
      csv += '\n平均分,' + results.average;
      break;
    }
    case 'leaderboard': {
      const results = getVoteResults(interactionId);
      csv = formatCsv(['排名', '选项', '票数', '百分比'],
        results.options
          .sort((a, b) => b.count - a.count)
          .map((o, i) => {
            const pct = results.total > 0 ? Math.round((o.count / results.total) * 100) + '%' : '0%';
            return [String(i + 1), o.option_text, String(o.count), pct];
          }));
      break;
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/room/[code]/export/route.ts
git commit -m "feat: add CSV export support for rating and leaderboard types"
```

---

### Task 5: Add interaction dialog — rating and leaderboard config UI

**Files:**
- Modify: `src/components/add-interaction-dialog.tsx`

- [ ] **Step 1: Add new type state and UI for rating + leaderboard**

Replace the entire file with the updated version. Key changes:
- `type` state starts as `'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard'`
- Add type buttons for "评分" and "排行榜"
- Add rating sub-type config (star/NPS toggle, NPS labels)
- Add leaderboard config (options + maxSelect)
- Pass correct config on submit

```tsx
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
```

- [ ] **Step 2: Build to verify no type errors**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/add-interaction-dialog.tsx
git commit -m "feat: add rating and leaderboard config UI to add-interaction-dialog"
```

---

### Task 6: Create rating-results component

**Files:**
- Create: `src/components/rating-results.tsx`

- [ ] **Step 1: Create the rating-results component**

```tsx
// src/components/rating-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface RatingResult {
  type: 'rating';
  average: number;
  distribution: Record<string, number>;
  total: number;
  npsScore: number | null;
}

function CountUp({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const duration = 500;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const linearProgress = Math.min(elapsed / duration, 1);
      const progress = 1 - Math.pow(1 - linearProgress, 3);
      setCount(Math.round(progress * target));
      if (linearProgress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <>{count}</>;
}

export function RatingResults({
  roomCode,
  interactionId,
  live,
  isCreator = false,
  initialRevealed = false,
}: {
  roomCode: string;
  interactionId: string;
  live: boolean;
  isCreator?: boolean;
  initialRevealed?: boolean;
}) {
  const [results, setResults] = useState<RatingResult>({ type: 'rating', average: 0, distribution: {}, total: 0, npsScore: null });
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(!isCreator || initialRevealed);

  async function fetchResults() {
    const res = await fetch(`/api/room/${roomCode}/vote?interactionId=${interactionId}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchResults();
    const interval = live ? setInterval(fetchResults, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  async function handleReveal() {
    setRevealed(true);
    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: interactionId, config: { revealed: true } }),
    });
  }

  if (loading) return <p className="text-slate-400">加载中...</p>;

  const distribution = results.distribution;
  const entries = Object.entries(distribution)
    .sort(([a], [b]) => Number(b) - Number(a));
  const maxCount = Math.max(...Object.values(distribution), 1);
  const isNps = results.npsScore !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">共 {results.total} 票</p>
        {isCreator && !revealed && results.total > 0 && (
          <Button onClick={handleReveal} size="sm">
            揭示结果
          </Button>
        )}
      </div>

      {!revealed && results.total > 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">等待揭示结果...</p>
        </div>
      )}

      {revealed && results.total > 0 && (
        <>
          {/* Score display */}
          {isNps ? (
            <div className="text-center py-4">
              <motion.p
                className={`text-5xl font-bold ${
                  results.npsScore! >= 50 ? 'text-green-400' :
                  results.npsScore! >= 0 ? 'text-yellow-400' :
                  'text-red-400'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CountUp target={results.npsScore!} />
              </motion.p>
              <p className="text-sm text-slate-500 mt-1">NPS 分数 (-100 ~ +100)</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3">
              <motion.span
                className="text-5xl font-bold text-white"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                {results.average}
              </motion.span>
              <span className="text-2xl text-amber-400">{'★'.repeat(Math.round(results.average))}</span>
            </div>
          )}

          {/* NPS zone breakdown */}
          {isNps && (
            <div className="flex gap-2 text-center text-sm">
              {[
                { label: '贬损者 0-6', count: entries.filter(([k]) => Number(k) <= 6).reduce((s, [, c]) => s + c, 0), color: 'bg-red-500/20 text-red-400' },
                { label: '被动者 7-8', count: entries.filter(([k]) => Number(k) >= 7 && Number(k) <= 8).reduce((s, [, c]) => s + c, 0), color: 'bg-yellow-500/20 text-yellow-400' },
                { label: '推荐者 9-10', count: entries.filter(([k]) => Number(k) >= 9).reduce((s, [, c]) => s + c, 0), color: 'bg-green-500/20 text-green-400' },
              ].map(zone => (
                <div key={zone.label} className={`flex-1 rounded-lg p-2 ${zone.color}`}>
                  <p className="text-lg font-bold">{zone.count}</p>
                  <p className="text-xs opacity-80">{zone.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Distribution bars */}
          <div className="space-y-1.5">
            {entries.map(([value, count], i) => {
              const pct = (count / maxCount) * 100;
              const totalPct = results.total > 0 ? Math.round((count / results.total) * 100) : 0;
              const isMax = count === maxCount;
              return (
                <motion.div
                  key={value}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-2"
                >
                  <span className={`w-6 text-right text-sm font-mono ${isMax ? 'text-white font-semibold' : 'text-slate-400'}`}>
                    {isNps ? value : `${value}★`}
                  </span>
                  <div className="flex-1 h-7 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        isMax
                          ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
                          : 'bg-blue-500/50'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.08 + 0.3, type: 'spring', stiffness: 80 }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs text-slate-500">
                    <CountUp target={count} /> ({totalPct}%)
                  </span>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {revealed && results.total === 0 && (
        <p className="text-slate-400 text-center py-8">等待评分中...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify component compiles**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/rating-results.tsx
git commit -m "feat: add rating-results component with star and NPS display"
```

---

### Task 7: Create leaderboard-results component

**Files:**
- Create: `src/components/leaderboard-results.tsx`

- [ ] **Step 1: Create the leaderboard-results component**

```tsx
// src/components/leaderboard-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface VoteOption {
  option_text: string;
  count: number;
}

function CountUp({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const duration = 500;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const linearProgress = Math.min(elapsed / duration, 1);
      const progress = 1 - Math.pow(1 - linearProgress, 3);
      setCount(Math.round(progress * target));
      if (linearProgress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <>{count}</>;
}

const medals = ['🥇', '🥈', '🥉'];

export function LeaderboardResults({
  roomCode,
  interactionId,
  live,
  isCreator = false,
  initialRevealed = false,
}: {
  roomCode: string;
  interactionId: string;
  live: boolean;
  isCreator?: boolean;
  initialRevealed?: boolean;
}) {
  const [results, setResults] = useState<{ total: number; options: VoteOption[] }>({
    total: 0,
    options: [],
  });
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(!isCreator || initialRevealed);

  async function fetchResults() {
    const res = await fetch(`/api/room/${roomCode}/vote?interactionId=${interactionId}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchResults();
    const interval = live ? setInterval(fetchResults, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  async function handleReveal() {
    setRevealed(true);
    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: interactionId, config: { revealed: true } }),
    });
  }

  if (loading) return <p className="text-slate-400">加载中...</p>;

  const sorted = [...results.options].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sorted.map(o => o.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">共 {results.total} 票</p>
        {isCreator && !revealed && results.total > 0 && (
          <Button onClick={handleReveal} size="sm">
            揭示结果
          </Button>
        )}
      </div>

      {!revealed && results.total > 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">等待揭示结果...</p>
        </div>
      )}

      {revealed && sorted.length > 0 && (
        <div className="space-y-1.5">
          {sorted.map((option, i) => {
            const pct = (option.count / maxCount) * 100;
            const totalPct = results.total > 0 ? Math.round((option.count / results.total) * 100) : 0;
            return (
              <motion.div
                key={option.option_text}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 120 }}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  i === 0
                    ? 'bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20'
                    : 'border border-transparent'
                }`}
              >
                {/* Rank badge */}
                <span className="w-8 text-center text-lg font-bold">
                  {i < 3 ? medals[i] : (
                    <span className="text-slate-500 text-sm">#{i + 1}</span>
                  )}
                </span>
                {/* Option name */}
                <span className={`flex-1 font-medium ${i === 0 ? 'text-white' : 'text-slate-300'}`}>
                  {option.option_text}
                </span>
                {/* Bar + count */}
                <div className="flex items-center gap-2 w-32">
                  <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        i === 0
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                          : i === 1
                            ? 'bg-slate-400'
                            : i === 2
                              ? 'bg-amber-600/60'
                              : 'bg-slate-600'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.1 + 0.3, type: 'spring', stiffness: 80 }}
                    />
                  </div>
                  <span className="w-14 text-right text-sm text-slate-400">
                    <CountUp target={option.count} /> <span className="text-xs">({totalPct}%)</span>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {revealed && results.total === 0 && (
        <p className="text-slate-400 text-center py-8">等待投票中...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify component compiles**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/leaderboard-results.tsx
git commit -m "feat: add leaderboard-results component with ranked display"
```

---

### Task 8: Audience view — rating and leaderboard participation forms

**Files:**
- Modify: `src/components/audience-view.tsx`

- [ ] **Step 1: Add rating and leaderboard UI to audience-view**

In `src/components/audience-view.tsx`, add imports at top:

```typescript
import { RatingResults } from '@/components/rating-results';
import { LeaderboardResults } from '@/components/leaderboard-results';
```

Add state variables after `const [searchQuery, setSearchQuery] = useState('');` (line 50):

```typescript
  const [ratingValue, setRatingValue] = useState('');
  const [ratingType, setRatingType] = useState<'star' | 'nps'>('star');
  const [leaderboardOptions, setLeaderboardOptions] = useState<string[]>([]);
  const [maxLeaderboardSelect, setMaxLeaderboardSelect] = useState(3);
```

Add rating and leaderboard submission handlers before `if (pageState === 'loading')`:

```typescript
  async function submitRating() {
    if (!sessionId || !interaction) return;
    if (!ratingValue) return;

    await fetch(`/api/room/${roomCode}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactionId: interaction.id,
        optionText: ratingValue,
        voterId: sessionId,
      }),
    });
    setSubmitted(true);
  }

  async function submitLeaderboard() {
    if (!sessionId || !interaction) return;
    if (leaderboardOptions.length === 0) return;

    await fetch(`/api/room/${roomCode}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactionId: interaction.id,
        optionTexts: leaderboardOptions,
        voterId: sessionId,
      }),
    });
    setResultPreview({ total: leaderboardOptions.length });
    setSubmitted(true);
  }
```

Update the config parsing in `useEffect` on mount (around line 65) to also parse rating/leaderboard configs:

```typescript
            if (live.type === 'rating') {
              try {
                const cfg = JSON.parse(live.config);
                if (cfg.ratingType) setRatingType(cfg.ratingType);
              } catch {}
            }
            if (live.type === 'leaderboard') {
              try {
                const cfg = JSON.parse(live.config);
                if (cfg.maxSelect) setMaxLeaderboardSelect(cfg.maxSelect);
              } catch {}
            }
```

Add the following UI blocks inside the main Card, after the existing `interaction.type === 'wordcloud'` block (before the `submitted` block):

```tsx
            {interaction.type === 'rating' && !submitted && (
              <div className="space-y-4">
                {ratingType === 'star' ? (
                  <div className="flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRatingValue(String(n))}
                        className={`text-4xl transition-all ${
                          Number(ratingValue) >= n
                            ? 'text-amber-400 scale-110'
                            : 'text-slate-600 hover:text-amber-300/60'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5 px-1">
                      <span>{interaction && (() => { try { return JSON.parse(interaction.config).lowLabel || '完全不可能'; } catch { return '完全不可能'; } })()}</span>
                      <span>{interaction && (() => { try { return JSON.parse(interaction.config).highLabel || '一定会'; } catch { return '一定会'; } })()}</span>
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: 11 }, (_, n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRatingValue(String(n))}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            ratingValue === String(n)
                              ? 'bg-primary text-primary-foreground scale-105'
                              : n <= 6
                                ? 'bg-red-950/30 text-red-300/60 hover:bg-red-900/40'
                                : n <= 8
                                  ? 'bg-yellow-950/30 text-yellow-300/60 hover:bg-yellow-900/40'
                                  : 'bg-green-950/30 text-green-300/60 hover:bg-green-900/40'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-center text-sm text-slate-400">
                  {ratingValue ? `你的评分: ${ratingValue}` : '点击选择评分'}
                </p>
                <Button onClick={submitRating} disabled={!ratingValue} className="w-full">
                  提交评分
                </Button>
              </div>
            )}

            {interaction.type === 'leaderboard' && !submitted && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">最多选择 {maxLeaderboardSelect} 个</p>
                {pollOptions.map((option, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      leaderboardOptions.includes(option)
                        ? 'border-primary bg-primary/10'
                        : leaderboardOptions.length >= maxLeaderboardSelect
                          ? 'border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={option}
                      checked={leaderboardOptions.includes(option)}
                      disabled={leaderboardOptions.length >= maxLeaderboardSelect && !leaderboardOptions.includes(option)}
                      onChange={e => {
                        if (e.target.checked) {
                          setLeaderboardOptions(prev => [...prev, option]);
                        } else {
                          setLeaderboardOptions(prev => prev.filter(o => o !== option));
                        }
                      }}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span>{option}</span>
                  </label>
                ))}
                <Button
                  onClick={submitLeaderboard}
                  disabled={leaderboardOptions.length === 0}
                  className="w-full mt-3"
                >
                  提交投票
                </Button>
              </div>
            )}
```

Update the `submitted` block to reference the correct type for modifying:

In the modify button's onClick, reset rating/leaderboard state:

```typescript
                  onClick={() => {
                    setSubmitted(false);
                    setSelectedOption('');
                    setSelectedOptions([]);
                    setRatingValue('');
                    setLeaderboardOptions([]);
                  }}
```

Add rendering for submitted rating/leaderboard results (after the existing poll submitted results block):

```tsx
            {interaction.type === 'rating' && submitted && (() => {
              const config = JSON.parse(interaction.config);
              const revealed = config.revealed === true;
              return revealed ? (
                <RatingResults roomCode={roomCode} interactionId={interaction.id} live={false} initialRevealed={revealed} />
              ) : null;
            })()}

            {interaction.type === 'leaderboard' && submitted && (() => {
              const config = JSON.parse(interaction.config);
              const revealed = config.revealed === true;
              return revealed ? (
                <LeaderboardResults roomCode={roomCode} interactionId={interaction.id} live={false} initialRevealed={revealed} />
              ) : null;
            })()}
```

- [ ] **Step 2: Build to verify all types are correct**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/audience-view.tsx
git commit -m "feat: add rating and leaderboard participation forms to audience view"
```

---

### Task 9: Creator dashboard integration

**Files:**
- Modify: `src/components/creator-dashboard.tsx`

- [ ] **Step 1: Update InteractionData type and render new result components**

Add imports at top:

```typescript
import { RatingResults } from '@/components/rating-results';
import { LeaderboardResults } from '@/components/leaderboard-results';
```

Update the `InteractionData` interface (line 18-24):

```typescript
interface InteractionData {
  id: string;
  type: 'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard';
  title: string;
  status: 'pending' | 'live' | 'closed';
  config?: string;
}
```

Update `typeLabel` (line 35):

```typescript
  const typeLabel: Record<string, string> = { poll: '投票', qa: '问答', wordcloud: '词云', rating: '评分', leaderboard: '排行榜' };
```

After the existing `{activeInteraction.type === 'wordcloud' && ...}` block, add:

```tsx
                  {activeInteraction.type === 'rating' && (
                    <RatingResults roomCode={roomCode} interactionId={activeId!} live={activeInteraction.status === 'live'} isCreator initialRevealed={activeInteraction.config ? JSON.parse(activeInteraction.config).revealed === true : false} />
                  )}
                  {activeInteraction.type === 'leaderboard' && (
                    <LeaderboardResults roomCode={roomCode} interactionId={activeId!} live={activeInteraction.status === 'live'} isCreator initialRevealed={activeInteraction.config ? JSON.parse(activeInteraction.config).revealed === true : false} />
                  )}
```

- [ ] **Step 2: Build to verify**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/creator-dashboard.tsx
git commit -m "feat: integrate rating and leaderboard results into creator dashboard"
```

---

### Task 10: Presentation view integration

**Files:**
- Modify: `src/components/presentation-view.tsx`

- [ ] **Step 1: Update type union and render new result components**

Add imports:

```typescript
import { RatingResults } from '@/components/rating-results';
import { LeaderboardResults } from '@/components/leaderboard-results';
```

Update the `activeInteraction` type (line 16):

```typescript
    type: 'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard';
```

After the existing `{activeInteraction.type === 'wordcloud' && ...}` block, add:

```tsx
              {activeInteraction.type === 'rating' && (
                <RatingResults roomCode={roomCode} interactionId={activeInteraction.id} live isCreator initialRevealed={activeInteraction.config ? JSON.parse(activeInteraction.config).revealed === true : false} />
              )}
              {activeInteraction.type === 'leaderboard' && (
                <LeaderboardResults roomCode={roomCode} interactionId={activeInteraction.id} live isCreator initialRevealed={activeInteraction.config ? JSON.parse(activeInteraction.config).revealed === true : false} />
              )}
```

- [ ] **Step 2: Build to verify**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/presentation-view.tsx
git commit -m "feat: integrate rating and leaderboard results into presentation view"
```

---

## Final Verification

- [ ] Run full test suite: `npx vitest run 2>&1`
- [ ] Run full build: `npx next build 2>&1 | tail -20`
- [ ] Start dev server and verify: create a `rating` interaction, submit a rating, view results
