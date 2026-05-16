# Phase 1: Search + Enhanced Interactivity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global search, Q&A answer/pin controls, and poll reveal animation across all views.

**Architecture:** Client-side search with debounced state flows from `CreatorDashboard` down to `InteractionQueue`, `QaFeed`, and `WordCloud` via props. Q&A enhancements use a new `updateQuestionStatus()` backend function + extended PATCH API with SSE broadcast. Poll reveal uses local state gated by interaction config, with AnimatePresence stagger for bar chart.

**Tech Stack:** Next.js 16 App Router, TypeScript, framer-motion, SQLite (better-sqlite3), SSE

---

### File Structure

| File | Role |
|------|------|
| `src/lib/db.ts` | Schema: add `answered`, `pinned` columns to `question` |
| `src/lib/interaction.ts` | New `updateQuestionStatus()`, `updateInteractionConfig()`, sorted `getQuestions()` |
| `src/app/api/room/[code]/question/route.ts` | PATCH extended for answered/pinned |
| `src/app/api/room/[code]/interaction/route.ts` | PATCH extended for config update (reveal flag) |
| `src/components/creator-dashboard.tsx` | Search bar UI + state hub, pass props to children |
| `src/components/interaction-queue.tsx` | Accept `searchQuery` prop, filter by title |
| `src/components/qa-feed.tsx` | `isCreator` + `searchQuery` props; answered/pin buttons; sort order |
| `src/components/poll-results.tsx` | `isCreator` prop; reveal button + stagger bar animation |
| `src/components/word-cloud.tsx` | `highlightWord` prop; dim non-matching words |
| `src/components/audience-view.tsx` | Search for Q&A; pass reveal-aware state to PollResults |
| `src/components/presentation-view.tsx` | Pass `isCreator={false}` to QaFeed/PollResults |

---

### Task 1: Database Schema Migration

**Files:**
- Modify: `src/lib/db.ts:47-52`

- [ ] **Step 1: Add migration logic in initializeDatabase**

In `initializeDatabase()`, after `CREATE INDEX` statements, add safe migrations:

```typescript
  // Migrations — safe to run repeatedly
  try { db.exec('ALTER TABLE question ADD COLUMN answered INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE question ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0'); } catch {}
```

- [ ] **Step 2: Verify migration runs**

Run: `npx tsx -e "import { initializeDatabase } from '@/lib/db'; initializeDatabase(); console.log('OK')"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add answered and pinned columns to question table"
```

---

### Task 2: Backend — updateQuestionStatus + updateInteractionConfig

**Files:**
- Modify: `src/lib/interaction.ts`

- [ ] **Step 1: Add `updateQuestionStatus` function**

After `upvoteQuestion` function (line 137), add:

```typescript
export function updateQuestionStatus(
  id: string,
  updates: { answered?: boolean; pinned?: boolean }
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.answered !== undefined) {
    sets.push('answered = ?');
    params.push(updates.answered ? 1 : 0);
  }
  if (updates.pinned !== undefined) {
    // Unpin all other questions in the same interaction if pinning
    if (updates.pinned) {
      const q = db.prepare('SELECT interaction_id FROM question WHERE id = ?').get(id) as { interaction_id: string } | undefined;
      if (q) {
        db.prepare("UPDATE question SET pinned = 0 WHERE interaction_id = ? AND id != ?").run(q.interaction_id, id);
      }
    }
    sets.push('pinned = ?');
    params.push(updates.pinned ? 1 : 0);
  }

  if (sets.length === 0) return;
  db.prepare(`UPDATE question SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
}
```

- [ ] **Step 2: Add `updateInteractionConfig` function**

After `deleteInteraction` function (line 65), add:

```typescript
export function updateInteractionConfig(id: string, config: Record<string, unknown>): void {
  const existing = db.prepare('SELECT config FROM interaction WHERE id = ?').get(id) as { config: string } | undefined;
  if (!existing) return;
  const merged = { ...JSON.parse(existing.config), ...config };
  db.prepare('UPDATE interaction SET config = ? WHERE id = ?').run(JSON.stringify(merged), id);
}
```

- [ ] **Step 3: Update `getQuestions` sort order**

Replace the `getQuestions` function body (line 129-133):

```typescript
export function getQuestions(interactionId: string) {
  return db.prepare(
    'SELECT * FROM question WHERE interaction_id = ? ORDER BY pinned DESC, answered ASC, upvotes DESC, created_at DESC'
  ).all(interactionId);
}
```

- [ ] **Step 4: Update the QuestionData interface export**

At the top, add export for the question row type that includes the new fields. The existing return type is inferred — it's fine since SQLite returns all columns.

- [ ] **Step 5: Commit**

```bash
git add src/lib/interaction.ts
git commit -m "feat: updateQuestionStatus, updateInteractionConfig, sorted getQuestions"
```

---

### Task 3: Backend — PATCH Question API Extended

**Files:**
- Modify: `src/app/api/room/[code]/question/route.ts`

- [ ] **Step 1: Extend PATCH handler**

Replace the PATCH handler (line 43-65) with:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { questionId, answered, pinned } = body as {
    questionId?: string;
    answered?: boolean;
    pinned?: boolean;
  };

  // Upvote mode (existing)
  if (questionId && answered === undefined && pinned === undefined) {
    upvoteQuestion(questionId);
    publishToRoom(code, { type: 'question.upvote', data: { questionId } });
    return NextResponse.json({ success: true });
  }

  // Status update mode (new)
  if (questionId && (answered !== undefined || pinned !== undefined)) {
    const { updateQuestionStatus } = await import('@/lib/interaction');
    updateQuestionStatus(questionId, { answered, pinned });

    // Fetch updated question for broadcast
    const question = db.prepare('SELECT * FROM question WHERE id = ?').get(questionId);
    publishToRoom(code, { type: 'question.update', data: question });
    return NextResponse.json({ success: true, question });
  }

  return NextResponse.json({ error: 'questionId required' }, { status: 400 });
}
```

- [ ] **Step 2: Add db import at top**

Add `import db from '@/lib/db';` after the existing imports.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/room/[code]/question/route.ts
git commit -m "feat: extend PATCH question API for answered/pinned status"
```

---

### Task 4: Backend — PATCH Interaction Config for Reveal

**Files:**
- Modify: `src/app/api/room/[code]/interaction/route.ts`

- [ ] **Step 1: Extend PATCH to handle config updates**

Read the current route first, then modify:

The existing PATCH handler updates status only. Extend it to also handle `config` field:

```typescript
// In PATCH handler, after parsing body:
const { id, status, config } = body as {
  id?: string;
  status?: string;
  config?: Record<string, unknown>;
};

if (id && config) {
  const { updateInteractionConfig, getInteraction } = await import('@/lib/interaction');
  updateInteractionConfig(id, config);
  const updated = getInteraction(id);
  publishToRoom(code, { type: 'interaction.update', data: updated });
  return NextResponse.json({ success: true, interaction: updated });
}
```

Add this BEFORE the existing status-update block (so config updates don't conflict with status updates).

- [ ] **Step 2: Commit**

```bash
git add src/app/api/room/[code]/interaction/route.ts
git commit -m "feat: support PATCH interaction config for reveal flag"
```

---

### Task 5: PollResults — Reveal Animation

**Files:**
- Modify: `src/components/poll-results.tsx`

- [ ] **Step 1: Rewrite PollResults with reveal support**

```typescript
// src/components/poll-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface VoteResult {
  option_text: string;
  count: number;
}

export function PollResults({
  roomCode,
  interactionId,
  live,
  isCreator = false,
}: {
  roomCode: string;
  interactionId: string;
  live: boolean;
  isCreator?: boolean;
}) {
  const [results, setResults] = useState<{ total: number; options: VoteResult[] }>({
    total: 0,
    options: [],
  });
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

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
    // Persist to interaction config so audience sees it too
    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: interactionId, config: { revealed: true } }),
    });
  }

  if (loading) return <p className="text-slate-400">加载中...</p>;

  const maxCount = Math.max(...results.options.map(o => o.count), 1);

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

      <AnimatePresence>
        {!revealed && results.total > 0 && !isCreator && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-slate-400 text-lg">等待揭示结果...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealed && results.options.map((option, i) => {
          const pct = (option.count / maxCount) * 100;
          const totalPct = results.total > 0 ? Math.round((option.count / results.total) * 100) : 0;
          return (
            <motion.div
              key={option.option_text}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 18 }}
              className="space-y-1"
            >
              <div className="flex justify-between text-sm">
                <span className={i === 0 ? 'font-semibold' : ''}>{option.option_text}</span>
                <span className="text-slate-500">
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 + 0.3 }}
                  >
                    <CountUp target={option.count} /> 票 ({totalPct}%)
                  </motion.span>
                </span>
              </div>
              <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    i === 0
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.1 + 0.2, type: 'spring', stiffness: 80, damping: 18 }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!revealed && isCreator && results.total === 0 && (
        <p className="text-slate-400 text-center py-8">等待投票中...</p>
      )}
    </div>
  );
}

function CountUp({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const duration = 500;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <>{count}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/poll-results.tsx
git commit -m "feat: poll reveal animation with stagger bars and count-up"
```

---

### Task 6: QaFeed — Search, Answered/Pin, Sort

**Files:**
- Modify: `src/components/qa-feed.tsx`

- [ ] **Step 1: Rewrite QaFeed**

```typescript
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
              q.answered && 'opacity-60 bg-green-50/30 dark:bg-green-950/10',
              q.pinned && 'border-l-4 border-l-amber-400 bg-amber-50/20 dark:bg-amber-950/10',
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
                        className={cn('text-xs p-1 rounded transition-colors', q.pinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500')}
                        title={q.pinned ? '取消置顶' : '置顶'}
                      >
                        📌
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(q.id, { answered: !q.answered })}
                        className={cn('text-xs p-1 rounded transition-colors', q.answered ? 'text-green-500' : 'text-slate-400 hover:text-green-500')}
                        title={q.answered ? '取消标记' : '标记为已回答'}
                      >
                        ✓
                      </button>
                    </div>
                  )}
                </div>
                {(q.asker_name || q.answered) && (
                  <div className="flex items-center gap-2 mt-1">
                    {q.asker_name && <p className="text-xs text-slate-400">— {q.asker_name}</p>}
                    {q.answered && <span className="text-xs text-green-500 font-medium">已回答</span>}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/qa-feed.tsx
git commit -m "feat: Q&A feed with search, answered/pin toggles, creator controls"
```

---

### Task 7: InteractionQueue — Search Filter

**Files:**
- Modify: `src/components/interaction-queue.tsx`

- [ ] **Step 1: Add searchQuery prop and filter**

In `InteractionQueue` props, add `searchQuery?: string`. Filter interactions before mapping:

```typescript
export function InteractionQueue({
  interactions,
  activeId,
  onSelect,
  onToggleStatus,
  onDelete,
  searchQuery = '',
}: {
  interactions: InteractionData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleStatus: (id: string, current: string) => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
}) {
  const filtered = searchQuery.trim()
    ? interactions.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : interactions;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {filtered.map(item => (
          // ... existing item JSX unchanged
        ))}
        {filtered.length === 0 && searchQuery && (
          <p className="text-slate-400 text-xs text-center py-4">没有匹配的互动</p>
        )}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/interaction-queue.tsx
git commit -m "feat: search filter for interaction queue"
```

---

### Task 8: WordCloud — Highlight Search Match

**Files:**
- Modify: `src/components/word-cloud.tsx`

- [ ] **Step 1: Add highlightWord prop and dim non-matching**

Add `highlightWord?: string` to the WordCloud props. In the `positioned` useMemo, adjust opacity based on match:

```typescript
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
```

In the `positioned` useMemo, after computing `opacity`, add:

```typescript
let finalOpacity = opacity;
if (highlightWord.trim()) {
  const match = item.word.includes(highlightWord.trim().toLowerCase());
  finalOpacity = match ? 1 : 0.12;
}
```

Then use `finalOpacity` instead of `opacity` in the returned object and animate.

- [ ] **Step 2: Commit**

```bash
git add src/components/word-cloud.tsx
git commit -m "feat: word cloud highlight search query, dim non-matching"
```

---

### Task 9: CreatorDashboard — Search Bar Hub

**Files:**
- Modify: `src/components/creator-dashboard.tsx`

- [ ] **Step 1: Add search state and input, pass to children**

After the existing state declarations (line ~27), add:

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [searchVisible, setSearchVisible] = useState(false);
```

In the JSX, add a search bar in the main content area header (line ~106, where `loading` check ends). Add right before the loading check results:

Inside the main content `<div>` (line ~106), add a search bar at the top:

```typescript
{!loading && (
  <div className="flex items-center gap-2 mb-4">
    <div className="relative flex-1 max-w-md">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <Input
        placeholder="搜索互动、问题、词云..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="pl-9"
      />
    </div>
    {searchQuery && (
      <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
        清除
      </Button>
    )}
  </div>
)}
```

Pass `searchQuery` to child components:
- `InteractionQueue`: add `searchQuery={searchQuery}`
- `QaFeed`: add `isCreator={true} searchQuery={searchQuery}`
- `WordCloud`: add `highlightWord={searchQuery}`

- [ ] **Step 2: Update imports at top**

Add `import { Input } from '@/components/ui/input';` to the imports.

- [ ] **Step 3: Commit**

```bash
git add src/components/creator-dashboard.tsx
git commit -m "feat: global search bar in creator dashboard"
```

---

### Task 10: AudienceView — Search + Reveal-Aware Poll

**Files:**
- Modify: `src/components/audience-view.tsx`

- [ ] **Step 1: Add search state for Q&A section**

Add search input conditionally for Q&A interactions.

After line 46 (`const [pollOptions, setPollOptions] = useState<string[]>([]);`), add:

```typescript
const [searchQuery, setSearchQuery] = useState('');
```

In the Q&A section (line ~261-277), add a search input above the question form:

```typescript
{interaction.type === 'qa' && !submitted && (
  <div className="space-y-3">
    <div className="relative">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <Input
        placeholder="搜索问题..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="pl-8 text-sm"
      />
    </div>
    {/* existing askerName, questionText, submit button */}
  </div>
)}
```

In the submitted Q&A section (line ~293), show a search-filtered question list. After `submitted` check's UI, if `interaction.type === 'qa'`, fetch and display a filtered question list:

Actually, the audience-view doesn't currently show the Q&A feed after submit — it only shows "已提交" message. We need to add a Q&A feed display. Let me add a section that shows submitted questions (read-only for audience):

After the "submitted" section (line ~310), add:

```typescript
{interaction.type === 'qa' && submitted && (
  <QaFeed roomCode={roomCode} interactionId={interaction.id} searchQuery={searchQuery} />
)}
```

Add import at top: `import { QaFeed } from '@/components/qa-feed';`

- [ ] **Step 2: Pass reveal state for PollResults**

For poll type, add a reveal check. The audience poll-results need to be shown or gated based on interaction config. Update the line where poll results might show.

In the submitted section for poll, check config for reveal status:

```typescript
// Parse config to check revealed flag
const config = JSON.parse(interaction.config);
const revealed = config.revealed === true;
```

Then conditionally show poll results:
```typescript
{revealed && <PollResults roomCode={roomCode} interactionId={interaction.id} live={false} />}
```

- [ ] **Step 3: Add PollResults import**

```typescript
import { PollResults } from '@/components/poll-results';
```

- [ ] **Step 4: Commit**

```bash
git add src/components/audience-view.tsx
git commit -m "feat: audience search for Q&A, reveal-aware poll display"
```

---

### Task 11: PresentationView — Pass isCreator Flag

**Files:**
- Modify: `src/components/presentation-view.tsx`

- [ ] **Step 1: Pass isCreator to PollResults**

Find the PollResults usage (line ~73) and add the prop:

```typescript
{activeInteraction.type === 'poll' && (
  <PollResults roomCode={roomCode} interactionId={activeInteraction.id} live isCreator />
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/presentation-view.tsx
git commit -m "feat: pass isCreator flag to poll results in presentation view"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Build check**

Run: `npm run build`

- [ ] **Step 2: Run tests**

Run: `npx vitest run`

- [ ] **Step 3: Deploy to server**

```bash
git push origin main
ssh do "cd /opt/livement && git pull && npm run build && pm2 restart livement"
```

- [ ] **Step 4: Manual test checklist**

- Create room → add Q&A interaction → search questions by keyword
- Mark question as answered → verify green check + sort order
- Pin a question → verify it moves to top
- Create poll → vote → click "揭示结果" → verify stagger animation
- Word cloud search — verify matching words highlighted, others dimmed
- Audience view: verify reveal overlay and Q&A search

- [ ] **Step 5: Commit if all passes**

No code changes in this step — just verification.
