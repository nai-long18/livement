# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LiveMent — 轻量级实时互动投票 & 问答平台。创建者快速发起互动空间（房间），观众通过链接/码加入，参与投票、开放式问答、词云生成，所有结果通过 WebSocket 实时动态展示。

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** TailwindCSS
- **UI Components:** shadcn/ui
- **Real-time:** WebSocket (via `ws` or Socket.IO) or Server-Sent Events
- **Database:** SQLite (via `better-sqlite3`) or PostgreSQL — keep it lightweight for single-Droplet deployment
- **Deployment:** DigitalOcean Droplet (~$16/mo)

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests (vitest/jest)
```

No tests or linting are configured yet — set these up early in the project scaffold phase.

## Architecture (planned)

Two-side architecture: **Creator** and **Audience**.

- **Creator flow:** Create room → configure interactions (poll / Q&A / word cloud) → start/stop each interaction → view live results
- **Audience flow:** Join room via link/code → see active interaction → submit response → see live aggregated results
- **Real-time layer:** WebSocket server (co-located with Next.js or as a separate process) broadcasts room state changes to all connected clients
- **Persistence:** Rooms and interaction data stored in SQLite/PostgreSQL; anonymous audience responses linked to room sessions
