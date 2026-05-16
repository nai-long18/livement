# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LiveMent — 轻量级实时互动投票 & 问答平台。创建者快速发起互动空间（房间），观众通过链接/码加入，参与投票、开放式问答、词云生成，所有结果通过 SSE 实时动态展示。

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** TailwindCSS v4
- **UI Components:** shadcn/ui v4 (@base-ui/react)
- **Real-time:** Server-Sent Events (SSE) with in-memory pub/sub
- **Database:** SQLite via `better-sqlite3` (WAL mode)
- **Animation:** framer-motion
- **Deployment target:** DigitalOcean Droplet (~$16/mo) for MVP

## Commands

```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Architecture

Two-role system: **Creator** (dashboard + presentation) and **Audience** (participation).

### Routes

| Path | Role | Purpose |
|------|------|---------|
| `/` | All | Landing page — create room + join by code |
| `/room/[code]` | Creator | Dashboard — manage interactions, view results |
| `/room/[code]/present` | Creator | Full-screen presentation for projectors |
| `/join/[code]` | Audience | Submit votes, questions, words |

### API Routes

| Path | Methods | Purpose |
|------|---------|---------|
| `/api/room` | POST, GET | Create/get rooms |
| `/api/room/[code]/interaction` | POST, GET, PATCH | CRUD interactions |
| `/api/room/[code]/vote` | POST, GET | Submit votes/words + get results |
| `/api/room/[code]/question` | POST, GET, PATCH | Submit/upvote/list questions |
| `/api/room/[code]/stream` | GET (SSE) | Real-time event stream |

### SSE Event Types

`ping`, `interaction.update`, `vote.update`, `question.new`, `question.upvote`, `wordcloud.update`, `room.close`

Each event carries full state (not incremental) for easy reconnection.

### Data Model (SQLite)

`room` → `interaction` (1:N) → `vote` / `question` (N:1). All PKs are nanoid TEXT.
Anonymous identity via `lm_sid` cookie — no user table in V1.

### Key Files

```
src/lib/db.ts          — SQLite instance + schema initialization
src/lib/room.ts        — Room CRUD
src/lib/interaction.ts — Interaction, vote, question, word cloud logic
src/lib/sse.ts         — SSE stream builder + in-memory pub/sub
src/lib/session.ts     — Server-side anonymous session cookie
src/hooks/use-sse.ts   — Client SSE EventSource hook
src/hooks/use-session.ts — Client session ID hook
```

## Future Evolution (per 可行性研究报告)

**V2 considerations documented in `LiveMent 研究可行性分析.md`:**

- **Hybrid rendering:** DOM for UI + Canvas/WebGL (PixiJS) for high-concurrency animations (word cloud with 1000+ entries)
- **Deployment scaling:** Cloudflare Durable Objects + WebSocket Hibernation API for ~$10/mo at scale with unlimited concurrent connections
- **Distribution:** Notion embed component, Slack slash command integration, WordPress shortcode
- **WebSocket upgrade path:** For bidirectional high-frequency interactions, replace SSE+POST with full-duplex WebSocket
