# LiveMent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time polling, Q&A, and word cloud platform with Next.js App Router, SQLite, and SSE.

**Architecture:** Two-role system (Creator / Audience) with SSE-based real-time updates. Creator manages a room with interactions; audience joins via code and participates. All state flows through SSE from server to clients; submissions via fetch POST. SQLite for zero-ops persistence.

**Tech Stack:** Next.js 15 (App Router), TypeScript, TailwindCSS v4, shadcn/ui, better-sqlite3, framer-motion, nanoid

---

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

- [ ] **Step 1: Create Next.js project**

Run:
```bash
cd "C:/Users/ljh/OneDrive/Desktop/Claude_test"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Expected: Next.js 15 project scaffolded with TypeScript, Tailwind, App Router.

- [ ] **Step 2: Install core dependencies**

Run:
```bash
npm install better-sqlite3 nanoid framer-motion
npm install -D @types/better-sqlite3
```

- [ ] **Step 3: Initialize shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
npx shadcn@latest add button input card badge separator scroll-area
```

This creates `components.json` and installs base shadcn components.

- [ ] **Step 4: Verify scaffold works**

Run:
```bash
npm run dev
```

Open `http://localhost:3000` — should show the default Next.js page. Kill dev server after confirming.

- [ ] **Step 5: Init git and commit**

Run:
```bash
git init
git add -A
git commit -m "chore: scaffold Next.js + Tailwind + shadcn/ui project"
```

---

### Task 2: Database Setup & Schema

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write the database module**

```typescript
// src/lib/db.ts
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'livement.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS room (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status     TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed'))
    );

    CREATE TABLE IF NOT EXISTS interaction (
      id         TEXT PRIMARY KEY,
      room_id    TEXT NOT NULL REFERENCES room(id) ON DELETE CASCADE,
      type       TEXT NOT NULL CHECK(type IN ('poll', 'qa', 'wordcloud')),
      title      TEXT NOT NULL DEFAULT '',
      config     TEXT NOT NULL DEFAULT '{}',
      status     TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'live', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vote (
      id              TEXT PRIMARY KEY,
      interaction_id  TEXT NOT NULL REFERENCES interaction(id) ON DELETE CASCADE,
      option_text     TEXT NOT NULL,
      voter_id        TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS question (
      id              TEXT PRIMARY KEY,
      interaction_id  TEXT NOT NULL REFERENCES interaction(id) ON DELETE CASCADE,
      content         TEXT NOT NULL,
      asker_name      TEXT DEFAULT '',
      asker_id        TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      upvotes         INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_interaction_room ON interaction(room_id);
    CREATE INDEX IF NOT EXISTS idx_vote_interaction ON vote(interaction_id);
    CREATE INDEX IF NOT EXISTS idx_vote_voter ON vote(interaction_id, voter_id);
    CREATE INDEX IF NOT EXISTS idx_question_interaction ON question(interaction_id);
  `);
}

export default db;
```

- [ ] **Step 2: Add data/ to .gitignore**

Append to `.gitignore`:
```
data/
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts .gitignore
git commit -m "feat: add SQLite database setup with schema"
```

---

### Task 3: Core Business Logic (Rooms & Interactions)

**Files:**
- Create: `src/lib/room.ts`, `src/lib/interaction.ts`

- [ ] **Step 1: Write room module**

```typescript
// src/lib/room.ts
import db, { initializeDatabase } from './db';
import { nanoid } from 'nanoid';

// Ensure schema exists on first import
initializeDatabase();

export interface Room {
  id: string;
  title: string;
  created_at: string;
  status: 'active' | 'closed';
}

export function createRoom(title: string = ''): Room {
  const id = nanoid(4); // 4-char code for easy sharing
  const stmt = db.prepare(
    'INSERT INTO room (id, title) VALUES (?, ?)'
  );
  stmt.run(id, title);
  return getRoom(id)!;
}

export function getRoom(id: string): Room | undefined {
  return db.prepare('SELECT * FROM room WHERE id = ?').get(id) as Room | undefined;
}

export function closeRoom(id: string): void {
  db.prepare("UPDATE room SET status = 'closed' WHERE id = ?").run(id);
}

export function getActiveInteraction(roomId: string) {
  return db.prepare(
    "SELECT * FROM interaction WHERE room_id = ? AND status = 'live' LIMIT 1"
  ).get(roomId);
}
```

- [ ] **Step 2: Write interaction module**

```typescript
// src/lib/interaction.ts
import db from './db';
import { nanoid } from 'nanoid';

export type InteractionType = 'poll' | 'qa' | 'wordcloud';
export type InteractionStatus = 'pending' | 'live' | 'closed';

export interface Interaction {
  id: string;
  room_id: string;
  type: InteractionType;
  title: string;
  config: string; // JSON string
  status: InteractionStatus;
  created_at: string;
}

export interface PollConfig {
  options: string[];
  multiple: boolean;
}

export function createInteraction(
  roomId: string,
  type: InteractionType,
  title: string,
  config: object = {}
): Interaction {
  const id = nanoid();
  const stmt = db.prepare(
    'INSERT INTO interaction (id, room_id, type, title, config) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, roomId, type, title, JSON.stringify(config));
  return db.prepare('SELECT * FROM interaction WHERE id = ?').get(id) as Interaction;
}

export function getRoomInteractions(roomId: string): Interaction[] {
  return db.prepare(
    'SELECT * FROM interaction WHERE room_id = ? ORDER BY created_at ASC'
  ).all(roomId) as Interaction[];
}

export function updateInteractionStatus(
  id: string,
  status: InteractionStatus
): void {
  // Close all other live interactions in the same room first
  if (status === 'live') {
    const interaction = db.prepare('SELECT room_id FROM interaction WHERE id = ?').get(id) as { room_id: string } | undefined;
    if (interaction) {
      db.prepare(
        "UPDATE interaction SET status = 'closed' WHERE room_id = ? AND status = 'live'"
      ).run(interaction.room_id);
    }
  }
  db.prepare('UPDATE interaction SET status = ? WHERE id = ?').run(status, id);
}

export function getInteraction(id: string): Interaction | undefined {
  return db.prepare('SELECT * FROM interaction WHERE id = ?').get(id) as Interaction | undefined;
}

// --- Votes ---

export interface VoteResult {
  option_text: string;
  count: number;
}

export function submitVote(
  interactionId: string,
  optionText: string,
  voterId: string
): { success: boolean; message: string } {
  // Check for duplicate vote
  const existing = db.prepare(
    'SELECT id FROM vote WHERE interaction_id = ? AND voter_id = ?'
  ).get(interactionId, voterId);

  if (existing) {
    // Update existing vote
    db.prepare('UPDATE vote SET option_text = ? WHERE interaction_id = ? AND voter_id = ?')
      .run(optionText, interactionId, voterId);
    return { success: true, message: 'Vote updated' };
  }

  db.prepare('INSERT INTO vote (id, interaction_id, option_text, voter_id) VALUES (?, ?, ?, ?)')
    .run(nanoid(), interactionId, optionText, voterId);
  return { success: true, message: 'Vote submitted' };
}

export function getVoteResults(interactionId: string): { total: number; options: VoteResult[] } {
  const config = getInteraction(interactionId);
  if (!config) return { total: 0, options: [] };

  const pollConfig: PollConfig = JSON.parse(config.config);
  const results = db.prepare(
    'SELECT option_text, COUNT(*) as count FROM vote WHERE interaction_id = ? GROUP BY option_text'
  ).all(interactionId) as VoteResult[];

  // Merge with config options to include zero-vote options
  const options = pollConfig.options.map(opt => {
    const found = results.find(r => r.option_text === opt);
    return { option_text: opt, count: found ? found.count : 0 };
  });

  const total = options.reduce((sum, o) => sum + o.count, 0);

  return { total, options };
}

// --- Questions (Q&A) ---

export function submitQuestion(
  interactionId: string,
  content: string,
  askerId: string,
  askerName: string = ''
): void {
  db.prepare(
    'INSERT INTO question (id, interaction_id, content, asker_name, asker_id) VALUES (?, ?, ?, ?, ?)'
  ).run(nanoid(), interactionId, content, askerName, askerId);
}

export function getQuestions(interactionId: string) {
  return db.prepare(
    'SELECT * FROM question WHERE interaction_id = ? ORDER BY upvotes DESC, created_at DESC'
  ).all(interactionId);
}

export function upvoteQuestion(questionId: string): void {
  db.prepare('UPDATE question SET upvotes = upvotes + 1 WHERE id = ?').run(questionId);
}

// --- Word Cloud ---

export function submitWord(
  interactionId: string,
  word: string,
  voterId: string
): void {
  // Word cloud reuses the vote table — each word is an "option"
  db.prepare('INSERT INTO vote (id, interaction_id, option_text, voter_id) VALUES (?, ?, ?, ?)')
    .run(nanoid(), interactionId, word.trim().toLowerCase(), voterId);
}

export function getWordCloudData(interactionId: string) {
  return db.prepare(
    'SELECT option_text as word, COUNT(*) as count FROM vote WHERE interaction_id = ? GROUP BY option_text ORDER BY count DESC LIMIT 50'
  ).all(interactionId) as { word: string; count: number }[];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/room.ts src/lib/interaction.ts
git commit -m "feat: add room and interaction business logic"
```

---

### Task 4: SSE Infrastructure

**Files:**
- Create: `src/lib/sse.ts`

- [ ] **Step 1: Write SSE helper**

```typescript
// src/lib/sse.ts

export interface SSEMessage {
  type: string;
  data: unknown;
}

export function createSSEStream(
  onSubscribe: (
    send: (event: SSEMessage) => void,
    close: () => void
  ) => void
): ReadableStream {
  let encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const send = (event: SSEMessage) => {
        const line = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      const close = () => {
        controller.close();
      };

      // Send initial connection event
      controller.enqueue(encoder.encode(':ok\n\n'));

      onSubscribe(send, close);
    },
    cancel() {
      // Cleanup handled by onSubscribe's close callback
    },
  });
}

// In-memory pub/sub for room events
type Listener = (event: SSEMessage) => void;
const roomListeners = new Map<string, Set<Listener>>();

export function subscribeToRoom(roomCode: string, listener: Listener): () => void {
  if (!roomListeners.has(roomCode)) {
    roomListeners.set(roomCode, new Set());
  }
  roomListeners.get(roomCode)!.add(listener);

  return () => {
    roomListeners.get(roomCode)?.delete(listener);
  };
}

export function publishToRoom(roomCode: string, event: SSEMessage): void {
  const listeners = roomListeners.get(roomCode);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Listener might have disconnected; cleanup happens on unsubscribe
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sse.ts
git commit -m "feat: add SSE infrastructure with in-memory pub/sub"
```

---

### Task 5: SSE Stream API Route

**Files:**
- Create: `src/app/api/room/[code]/stream/route.ts`

- [ ] **Step 1: Write SSE stream route handler**

```typescript
// src/app/api/room/[code]/stream/route.ts
import { NextRequest } from 'next/server';
import { createSSEStream, subscribeToRoom } from '@/lib/sse';
import { getRoom } from '@/lib/room';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const room = getRoom(code);
  if (!room) {
    return new Response('Room not found', { status: 404 });
  }

  const stream = createSSEStream((send, close) => {
    // Keep-alive ping every 15 seconds
    const pingInterval = setInterval(() => {
      send({ type: 'ping', data: { time: Date.now() } });
    }, 15000);

    const unsubscribe = subscribeToRoom(code, (event) => {
      send(event);
    });

    // Return cleanup is not directly supported — use AbortSignal
    return () => {
      clearInterval(pingInterval);
      unsubscribe();
      close();
    };
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/room/[code]/stream/route.ts
git commit -m "feat: add SSE stream API endpoint"
```

---

### Task 6: Room & Interaction API Routes

**Files:**
- Create: `src/app/api/room/route.ts`
- Create: `src/app/api/room/[code]/interaction/route.ts`

- [ ] **Step 1: Write room creation API**

```typescript
// src/app/api/room/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRoom, getRoom } from '@/lib/room';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const title = body.title || '';
  const room = createRoom(title);
  return NextResponse.json(room, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
  return NextResponse.json(room);
}
```

- [ ] **Step 2: Write interaction CRUD API**

```typescript
// src/app/api/room/[code]/interaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import {
  createInteraction,
  getRoomInteractions,
  updateInteractionStatus,
  InteractionType,
} from '@/lib/interaction';
import { publishToRoom } from '@/lib/sse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { type, title, config } = body as {
    type: InteractionType;
    title: string;
    config?: object;
  };

  if (!type || !['poll', 'qa', 'wordcloud'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const interaction = createInteraction(code, type, title || '', config || {});
  return NextResponse.json(interaction, { status: 201 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const interactions = getRoomInteractions(code);
  return NextResponse.json(interactions);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { id, status } = body as { id: string; status: 'pending' | 'live' | 'closed' };

  updateInteractionStatus(id, status);

  if (status === 'live') {
    const { getInteraction, getVoteResults, getQuestions, getWordCloudData } = await import('@/lib/interaction');
    const interaction = getInteraction(id);
    if (interaction) {
      publishToRoom(code, {
        type: 'interaction.update',
        data: interaction,
      });
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/room/route.ts src/app/api/room/[code]/interaction/route.ts
git commit -m "feat: add room and interaction API routes"
```

---

### Task 7: Vote & Submission API Routes

**Files:**
- Create: `src/app/api/room/[code]/vote/route.ts`
- Create: `src/app/api/room/[code]/question/route.ts`

- [ ] **Step 1: Write vote submission API (handles polls + word cloud)**

```typescript
// src/app/api/room/[code]/vote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import {
  getInteraction,
  submitVote,
  getVoteResults,
  submitWord,
  getWordCloudData,
} from '@/lib/interaction';
import { publishToRoom } from '@/lib/sse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { interactionId, optionText, voterId } = body as {
    interactionId: string;
    optionText: string;
    voterId: string;
  };

  const interaction = getInteraction(interactionId);
  if (!interaction || interaction.room_id !== code) {
    return NextResponse.json({ error: 'Invalid interaction' }, { status: 400 });
  }

  if (interaction.status !== 'live') {
    return NextResponse.json({ error: 'Interaction not active' }, { status: 400 });
  }

  if (interaction.type === 'wordcloud') {
    submitWord(interactionId, optionText, voterId);
    const data = getWordCloudData(interactionId);
    publishToRoom(code, { type: 'wordcloud.update', data });
    return NextResponse.json({ success: true, data });
  }

  // Poll
  const result = submitVote(interactionId, optionText, voterId);
  if (!result.success) return NextResponse.json(result, { status: 409 });

  const voteResults = getVoteResults(interactionId);
  publishToRoom(code, { type: 'vote.update', data: voteResults });

  return NextResponse.json({ success: true, ...voteResults });
}
```

- [ ] **Step 2: Write question submission & upvote API**

```typescript
// src/app/api/room/[code]/question/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import {
  getInteraction,
  submitQuestion,
  getQuestions,
  upvoteQuestion,
} from '@/lib/interaction';
import { publishToRoom } from '@/lib/sse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { interactionId, content, askerId, askerName } = body as {
    interactionId: string;
    content: string;
    askerId: string;
    askerName?: string;
  };

  const interaction = getInteraction(interactionId);
  if (!interaction || interaction.room_id !== code) {
    return NextResponse.json({ error: 'Invalid interaction' }, { status: 400 });
  }

  if (interaction.status !== 'live') {
    return NextResponse.json({ error: 'Interaction not active' }, { status: 400 });
  }

  submitQuestion(interactionId, content, askerId, askerName || '');
  const questions = getQuestions(interactionId);
  publishToRoom(code, { type: 'question.new', data: questions });

  return NextResponse.json({ success: true, questions }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { questionId } = body as { questionId: string };

  upvoteQuestion(questionId);

  // Re-fetch and broadcast questions for the room
  // We need the interaction ID — grab from the question
  const { getInteraction, getQuestions } = await import('@/lib/interaction');
  // Broadcast is scoped to room, so we just need to notify viewers
  // The creator dashboard can refetch

  publishToRoom(code, { type: 'question.upvote', data: { questionId } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/room/[code]/vote/route.ts src/app/api/room/[code]/question/route.ts
git commit -m "feat: add vote and question submission API routes"
```

---

### Task 8: Anonymous Session Cookie Middleware & Hook

**Files:**
- Create: `src/lib/session.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Write session utility**

```typescript
// src/lib/session.ts
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

const SESSION_COOKIE = 'lm_sid';

export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE);
  if (existing) return existing.value;

  const id = nanoid();
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return id;
}
```

- [ ] **Step 2: Write React hook for client-side session access**

```typescript
// src/hooks/use-session.ts
'use client';
import { useState, useEffect } from 'react';

export function useSessionId(): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    // Read session ID from cookie on client side
    const match = document.cookie.match(/(?:^|;\s*)lm_sid=([^;]*)/);
    if (match) {
      setId(match[1]);
    } else {
      // Generate a fallback for clients where httpOnly cookie fails
      const fallback = Math.random().toString(36).slice(2) + Date.now().toString(36);
      document.cookie = `lm_sid=${fallback};path=/;max-age=2592000;samesite=lax`;
      setId(fallback);
    }
  }, []);

  return id;
}
```

- [ ] **Step 3: Create hooks directory and commit**

```bash
mkdir -p src/hooks
git add src/lib/session.ts src/hooks/use-session.ts
git commit -m "feat: add anonymous session cookie and client hook"
```

---

### Task 9: Landing Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/landing.tsx`
- Create: `src/components/join-form.tsx`

- [ ] **Step 1: Refactor page.tsx to use landing component**

```typescript
// src/app/page.tsx
import { LandingPage } from '@/components/landing';

export default function Home() {
  return <LandingPage />;
}
```

- [ ] **Step 2: Build landing component**

```typescript
// src/components/landing.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    const res = await fetch('/api/room', { method: 'POST' });
    const room = await res.json();
    router.push(`/room/${room.id}`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (joinCode.trim()) {
      router.push(`/join/${joinCode.trim()}`);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md px-4 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">LiveMent</h1>
        <p className="text-slate-400 mb-8">实时互动，三秒开始</p>

        <Button
          size="lg"
          className="w-full mb-4 text-lg"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? '创建中...' : '＋ 创建新房间'}
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-sm">或</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <Input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="输入房间码"
            className="text-center text-lg tracking-widest uppercase"
            maxLength={6}
          />
          <Button type="submit" variant="secondary" disabled={!joinCode.trim()}>
            加入
          </Button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify landing page renders**

Run: `npm run dev`

Open `http://localhost:3000` — should see the LiveMent landing page with gradient background and two CTAs.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/landing.tsx
git commit -m "feat: add landing page with create and join CTAs"
```

---

### Task 10: Creator Dashboard Page

**Files:**
- Create: `src/app/room/[code]/page.tsx`
- Create: `src/components/creator-dashboard.tsx`
- Create: `src/components/interaction-queue.tsx`
- Create: `src/components/add-interaction-dialog.tsx`
- Create: `src/components/room-header.tsx`

- [ ] **Step 1: Write room page wrapper**

```typescript
// src/app/room/[code]/page.tsx
import { CreatorDashboard } from '@/components/creator-dashboard';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CreatorDashboard roomCode={code} />;
}
```

- [ ] **Step 2: Write room header component**

```typescript
// src/components/room-header.tsx
'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import Link from 'next/link';

export function RoomHeader({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">
          房间: <span className="font-mono tracking-widest">{roomCode}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/room/${roomCode}/present`} target="_blank">
            进入演示
          </Link>
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Write add interaction dialog**

```typescript
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
```

- [ ] **Step 4: Write interaction queue**

```typescript
// src/components/interaction-queue.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface InteractionData {
  id: string;
  type: 'poll' | 'qa' | 'wordcloud';
  title: string;
  status: 'pending' | 'live' | 'closed';
}

const typeLabel = { poll: '投票', qa: '问答', wordcloud: '词云' };

export function InteractionQueue({
  interactions,
  activeId,
  onSelect,
  onToggleStatus,
}: {
  interactions: InteractionData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleStatus: (id: string, current: string) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {interactions.map(item => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors',
              item.id === activeId
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
            )}
            onClick={() => onSelect(item.id)}
          >
            <Badge variant="outline" className="shrink-0">
              {typeLabel[item.type]}
            </Badge>
            <span className="flex-1 truncate text-sm">{item.title}</span>
            <Button
              size="sm"
              variant={item.status === 'live' ? 'destructive' : 'default'}
              className="shrink-0"
              onClick={e => {
                e.stopPropagation();
                onToggleStatus(item.id, item.status);
              }}
            >
              {item.status === 'live' ? '关闭' : '启动'}
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 5: Write creator dashboard (main component)**

```typescript
// src/components/creator-dashboard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { RoomHeader } from '@/components/room-header';
import { InteractionQueue } from '@/components/interaction-queue';
import { AddInteractionDialog } from '@/components/add-interaction-dialog';
import { PollResults } from '@/components/poll-results';
import { QaFeed } from '@/components/qa-feed';
import { WordCloud } from '@/components/word-cloud';
import { useSSE } from '@/hooks/use-sse';

interface InteractionData {
  id: string;
  type: 'poll' | 'qa' | 'wordcloud';
  title: string;
  status: 'pending' | 'live' | 'closed';
}

export function CreatorDashboard({ roomCode }: { roomCode: string }) {
  const [interactions, setInteractions] = useState<InteractionData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInteractions = useCallback(async () => {
    const res = await fetch(`/api/room/${roomCode}/interaction`);
    const data = await res.json();
    setInteractions(data);
    if (data.length > 0 && !activeId) {
      setActiveId(data[0].id);
    }
    setLoading(false);
  }, [roomCode, activeId]);

  useEffect(() => {
    fetchInteractions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for SSE events specific to this room
  useSSE(roomCode, (event) => {
    if (event.type === 'interaction.update' || event.type === 'vote.update' ||
        event.type === 'question.new' || event.type === 'wordcloud.update') {
      fetchInteractions();
    }
  });

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'live' ? 'closed' : 'live';
    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    fetchInteractions();
  }

  const activeInteraction = interactions.find(i => i.id === activeId);

  return (
    <div className="h-screen flex flex-col">
      <RoomHeader roomCode={roomCode} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Interaction Queue */}
        <div className="w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-2">
            <AddInteractionDialog roomCode={roomCode} onAdded={fetchInteractions} />
          </div>
          <div className="flex-1 overflow-hidden">
            <InteractionQueue
              interactions={interactions}
              activeId={activeId}
              onSelect={setActiveId}
              onToggleStatus={handleToggleStatus}
            />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 p-6 overflow-auto">
          {loading ? (
            <p className="text-slate-400">加载中...</p>
          ) : activeInteraction ? (
            <div>
              <h3 className="text-xl font-semibold mb-4">{activeInteraction.title}</h3>
              {activeInteraction.type === 'poll' && (
                <PollResults interactionId={activeId!} live={activeInteraction.status === 'live'} />
              )}
              {activeInteraction.type === 'qa' && (
                <QaFeed interactionId={activeId!} />
              )}
              {activeInteraction.type === 'wordcloud' && (
                <WordCloud interactionId={activeId!} live={activeInteraction.status === 'live'} />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              添加一个互动环节开始
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/room/ src/components/room-header.tsx src/components/creator-dashboard.tsx src/components/interaction-queue.tsx src/components/add-interaction-dialog.tsx
git commit -m "feat: add creator dashboard with interaction management"
```

---

### Task 11: SSE Client Hook

**Files:**
- Create: `src/hooks/use-sse.ts`

- [ ] **Step 1: Write the SSE client hook**

```typescript
// src/hooks/use-sse.ts
'use client';

import { useEffect, useRef } from 'react';

interface SSEMessage {
  type: string;
  data: unknown;
}

export function useSSE(
  roomCode: string,
  onEvent: (event: SSEMessage) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const eventSource = new EventSource(`/api/room/${roomCode}/stream`);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        onEventRef.current({ type: event.type || 'message', data });
      } catch {
        // Ignore parse errors (e.g., ping comments)
      }
    };

    eventSource.addEventListener('ping', handleMessage);
    eventSource.addEventListener('interaction.update', handleMessage);
    eventSource.addEventListener('vote.update', handleMessage);
    eventSource.addEventListener('question.new', handleMessage);
    eventSource.addEventListener('question.upvote', handleMessage);
    eventSource.addEventListener('wordcloud.update', handleMessage);
    eventSource.addEventListener('room.close', handleMessage);

    eventSource.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [roomCode]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-sse.ts
git commit -m "feat: add SSE client hook with auto-reconnect"
```

---

### Task 12: Poll Results Component (with Animation)

**Files:**
- Create: `src/components/poll-results.tsx`

- [ ] **Step 1: Write poll results with framer-motion bars**

```typescript
// src/components/poll-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface VoteResult {
  option_text: string;
  count: number;
}

export function PollResults({
  interactionId,
  live,
}: {
  interactionId: string;
  live: boolean;
}) {
  const [results, setResults] = useState<{ total: number; options: VoteResult[] }>({
    total: 0,
    options: [],
  });
  const [loading, setLoading] = useState(true);

  async function fetchResults() {
    const res = await fetch(`/api/room/${interactionId}/vote`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchResults();
    const interval = live ? setInterval(fetchResults, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  if (loading) return <p className="text-slate-400">加载中...</p>;

  const maxCount = Math.max(...results.options.map(o => o.count), 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">共 {results.total} 票</p>
      {results.options.map((option, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{option.option_text}</span>
            <span className="text-slate-500">
              {option.count} 票
              {results.total > 0 && ` (${Math.round((option.count / results.total) * 100)}%)`}
            </span>
          </div>
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(option.count / maxCount) * 100}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add vote results API endpoint**

```typescript
// src/app/api/room/[code]/vote/route.ts — add GET handler

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const { searchParams } = new URL(_request.url);
  const interactionId = searchParams.get('interactionId');
  if (!interactionId) return NextResponse.json({ error: 'interactionId required' }, { status: 400 });

  const results = getVoteResults(interactionId);
  return NextResponse.json(results);
}
```

Update the vote route to include this GET handler alongside the existing POST.

- [ ] **Step 3: Commit**

```bash
git add src/components/poll-results.tsx src/app/api/room/[code]/vote/route.ts
git commit -m "feat: add animated poll results component"
```

---

### Task 13: Q&A Feed Component

**Files:**
- Create: `src/components/qa-feed.tsx`

- [ ] **Step 1: Write Q&A feed**

```typescript
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

export function QaFeed({ interactionId }: { interactionId: string }) {
  const [questions, setQuestions] = useState<QuestionData[]>([]);

  async function fetchQuestions() {
    const res = await fetch(`/api/room/${interactionId}/questions`);
    const data = await res.json();
    setQuestions(data);
  }

  useEffect(() => {
    fetchQuestions();
    const interval = setInterval(fetchQuestions, 3000);
    return () => clearInterval(interval);
  }, [interactionId]);

  async function handleUpvote(questionId: string) {
    await fetch(`/api/room/${interactionId}/questions`, {
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
```

- [ ] **Step 2: Add questions GET endpoint** — update question route.ts to add GET handler fetching questions by interactionId query param.

- [ ] **Step 3: Commit**

```bash
git add src/components/qa-feed.tsx src/app/api/room/[code]/question/route.ts
git commit -m "feat: add Q&A feed component with upvote"
```

---

### Task 14: Word Cloud Component

**Files:**
- Create: `src/components/word-cloud.tsx`

- [ ] **Step 1: Write word cloud rendering**

```typescript
// src/components/word-cloud.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WordData {
  word: string;
  count: number;
}

const COLORS = [
  'text-blue-500', 'text-cyan-500', 'text-teal-500',
  'text-indigo-500', 'text-violet-500', 'text-purple-500',
  'text-pink-500', 'text-rose-500',
];

const FONT_SIZES = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'];

export function WordCloud({
  interactionId,
  live,
}: {
  interactionId: string;
  live: boolean;
}) {
  const [words, setWords] = useState<WordData[]>([]);

  async function fetchWords() {
    const res = await fetch(`/api/room/${interactionId}/words`);
    const data = await res.json();
    setWords(data);
  }

  useEffect(() => {
    fetchWords();
    const interval = live ? setInterval(fetchWords, 2000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [interactionId, live]);

  const maxCount = Math.max(...words.map(w => w.count), 1);

  return (
    <div className="flex flex-wrap justify-center items-center gap-3 p-8 min-h-[300px]">
      {words.map((item, i) => {
        const sizeIndex = Math.min(
          Math.floor((item.count / maxCount) * (FONT_SIZES.length - 1)),
          FONT_SIZES.length - 1
        );
        const color = COLORS[i % COLORS.length];

        return (
          <motion.span
            key={item.word}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: i * 0.03,
            }}
            className={`${FONT_SIZES[sizeIndex]} ${color} font-bold cursor-default select-none`}
            title={`${item.word} (${item.count})`}
          >
            {item.word}
          </motion.span>
        );
      })}
      {words.length === 0 && (
        <p className="text-slate-400">等待词云生成...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add words API endpoint** — add GET handler to vote route that returns word cloud data when accessed with `interactionId` param and the interaction is of type `wordcloud`.

- [ ] **Step 3: Commit**

```bash
git add src/components/word-cloud.tsx
git commit -m "feat: add animated word cloud component"
```

---

### Task 15: Presentation View

**Files:**
- Create: `src/app/room/[code]/present/page.tsx`
- Create: `src/components/presentation-view.tsx`

- [ ] **Step 1: Write presentation page wrapper**

```typescript
// src/app/room/[code]/present/page.tsx
import { PresentationView } from '@/components/presentation-view';

export default async function PresentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PresentationView roomCode={code} />;
}
```

- [ ] **Step 2: Write presentation view**

```typescript
// src/components/presentation-view.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/use-sse';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PollResults } from '@/components/poll-results';
import { QaFeed } from '@/components/qa-feed';
import { WordCloud } from '@/components/word-cloud';
import QRCode from 'qrcode';

export function PresentationView({ roomCode }: { roomCode: string }) {
  const [activeInteraction, setActiveInteraction] = useState<{
    id: string;
    type: 'poll' | 'qa' | 'wordcloud';
    title: string;
    status: string;
  } | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const joinUrl = `${window.location.origin}/join/${roomCode}`;
    QRCode.toDataURL(joinUrl, { width: 200, margin: 1 })
      .then(setQrDataUrl);
  }, [roomCode]);

  useSSE(roomCode, (event) => {
    if (event.type === 'interaction.update') {
      const data = event.data as { id: string; type: string; title: string; status: string };
      if (data.status === 'live') {
        setActiveInteraction(data as typeof activeInteraction);
      } else if (data.status === 'closed' && activeInteraction?.id === data.id) {
        setActiveInteraction(null);
      }
    }
  });

  // Fetch current active interaction on mount
  useEffect(() => {
    fetch(`/api/room/${roomCode}/interaction`)
      .then(r => r.json())
      .then(data => {
        const live = data.find((i: { status: string }) => i.status === 'live');
        if (live) setActiveInteraction(live);
      });
  }, [roomCode]);

  return (
    <main className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {activeInteraction ? (
            <motion.div
              key={activeInteraction.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="w-full max-w-4xl"
            >
              <h1 className="text-3xl md:text-5xl font-bold text-center mb-8">
                {activeInteraction.title}
              </h1>
              {activeInteraction.type === 'poll' && (
                <PollResults interactionId={activeInteraction.id} live />
              )}
              {activeInteraction.type === 'qa' && (
                <QaFeed interactionId={activeInteraction.id} />
              )}
              {activeInteraction.type === 'wordcloud' && (
                <WordCloud interactionId={activeInteraction.id} live />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-3xl md:text-5xl font-bold text-slate-600 mb-4">
                等待开始
              </p>
              <p className="text-slate-500 text-lg">
                加入码: <span className="font-mono tracking-widest text-cyan-400">{roomCode}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <footer className="h-14 border-t border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm">
            参与人数: {participantCount}
          </span>
          <button
            onClick={() => setShowQR(!showQR)}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            {showQR ? '隐藏二维码' : '显示二维码'}
          </button>
        </div>
        <span className="text-slate-700 text-xs">Powered by LiveMent</span>
      </footer>

      {/* QR Overlay */}
      {showQR && qrDataUrl && (
        <div className="absolute bottom-16 right-4 bg-white p-3 rounded-lg shadow-lg">
          <img src={qrDataUrl} alt="加入二维码" className="w-36 h-36" />
          <p className="text-slate-800 text-xs text-center mt-1 font-mono tracking-widest">
            {roomCode}
          </p>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Install qrcode dependency**

```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 4: Commit**

```bash
git add src/app/room/[code]/present/ src/components/presentation-view.tsx
git commit -m "feat: add full-screen presentation view with QR code"
```

---

### Task 16: Audience View

**Files:**
- Create: `src/app/join/[code]/page.tsx`
- Create: `src/components/audience-view.tsx`

- [ ] **Step 1: Write audience page wrapper**

```typescript
// src/app/join/[code]/page.tsx
import { AudienceView } from '@/components/audience-view';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <AudienceView roomCode={code} />;
}
```

- [ ] **Step 2: Write audience view component**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/join/ src/components/audience-view.tsx
git commit -m "feat: add audience participation view"
```

---

### Task 17: Dialog Component (shadcn/ui)

The `AddInteractionDialog` needs the shadcn Dialog component. We installed the base CLI components earlier but may need Dialog separately.

- [ ] **Step 1: Install dialog component**

```bash
npx shadcn@latest add dialog
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "chore: add shadcn dialog component"
```

---

### Task 18: API Route Fixes & Missing Endpoints

During component development, we referenced some API endpoints that need GET handlers:

- [ ] **Step 1: Add GET for vote results per interaction**

Update `src/app/api/room/[code]/vote/route.ts` to ensure the GET handler exists (added in Task 12, verify).

- [ ] **Step 2: Add GET for questions per interaction**

Update `src/app/api/room/[code]/question/route.ts`:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const interactionId = searchParams.get('interactionId');
  if (!interactionId) return NextResponse.json({ error: 'interactionId required' }, { status: 400 });

  const questions = getQuestions(interactionId);
  return NextResponse.json(questions);
}
```

- [ ] **Step 3: Add GET for word cloud data per interaction**

Update vote route GET to handle wordcloud interactions by checking interaction type and returning appropriate data.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "fix: add missing GET endpoints for questions and word cloud"
```

---

### Task 19: End-to-End Verification & Bug Fixes

- [ ] **Step 1: Start dev server and walk through all flows**

```bash
npm run dev
```

Manual test:
1. Open `http://localhost:3000` → landing page renders
2. Click "创建新房间" → redirects to `/room/XXXX`
3. Add a poll interaction → appears in queue
4. Start the poll → status changes to live
5. Open `http://localhost:3000/join/XXXX` in another tab → audience view shows poll options
6. Submit a vote as audience → vote recorded
7. Open `/room/XXXX/present` → presentation view shows results
8. Verify SSE events fire: creator controls interaction, audience sees updates

- [ ] **Step 2: Fix any issues found during manual testing**

Fix import errors, missing exports, type mismatches, etc.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: issues found during end-to-end verification"
```

---

### Task 20: Mobile Responsiveness Polish

- [ ] **Step 1: Update creator dashboard for mobile**

In `creator-dashboard.tsx`, add responsive layout: on mobile (< 768px), the interaction queue becomes a bottom drawer instead of a left sidebar.

```typescript
// Add to creator-dashboard.tsx
import { useState } from 'react';
// The mobile variant uses a bottom sheet for the interaction queue
// Desktop: side panel
// Mobile: full-width with bottom sheet toggle
```

Adapt the dashboard layout with Tailwind responsive classes: `lg:flex-row`, `max-lg:flex-col`, etc.

- [ ] **Step 2: Ensure audience and presentation views are responsive**

Presentation view: font sizes scale with viewport (`text-3xl md:text-5xl`).
Audience view: already in a max-w-md card — verify on mobile viewport.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "style: add mobile responsive layout"
```

---

### Task 21: Final Integration & Production Build Test

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Fix build errors if any**

Address any TypeScript errors, missing modules, or build-time issues.

- [ ] **Step 3: Start production server and smoke test**

```bash
npm run start
```

Repeat key flows: create room → add interaction → audience joins → vote → presentation.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: production build passing, all flows verified"
```
