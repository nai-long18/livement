# LiveMent — Design Spec

**Date:** 2026-05-16  
**Status:** Draft  
**Stack:** Next.js (App Router) + TailwindCSS + shadcn/ui + SQLite + SSE

## Overview

LiveMent is a lightweight real-time polling, Q&A, and word cloud platform. A creator opens a room, audiences join via a short code, and interactions happen live with animated results displayed on a projector or large screen.

**Target users:** Independent trainers, community organizers, small team leads, students.  
**Core differentiator:** Beautiful full-screen presentation experience with zero-friction joining.

## Architecture

Two-side architecture: Creator and Audience. No user accounts in V1.

### Routes

| Path | Role | Purpose |
|------|------|---------|
| `/` | All | Landing — create room or join existing |
| `/room/[code]` | Creator | Creator dashboard — manage interactions, view results |
| `/room/[code]/present` | Creator | Full-screen presentation view for projectors |
| `/join/[code]` | Audience | Audience participation page |

### Real-time Strategy

- **SSE** for server-to-client broadcasts (results, room state changes)
- **fetch POST** for client submissions (votes, questions, word cloud entries)
- SSE endpoint: `/api/room/[code]/stream` with JSON event stream
- Each event carries full state (not incremental) for easy reconnection

### SSE Event Types

```
ping                  → keep-alive (every 15s)
interaction.update    → interaction started/stopped
vote.update           → poll results updated
question.new          → new Q&A submitted
question.upvote       → Q&A upvote count changed
wordcloud.update      → word cloud data updated
room.close            → room closed
```

## Data Model (SQLite)

```
Room
  id          TEXT (pk, nanoid)
  title       TEXT
  created_at  DATETIME
  status      TEXT ('active' | 'closed')

Interaction
  id          TEXT (pk, nanoid)
  room_id     TEXT (fk → Room)
  type        TEXT ('poll' | 'qa' | 'wordcloud')
  title       TEXT
  config      TEXT (json)
  status      TEXT ('pending' | 'live' | 'closed')
  created_at  DATETIME

Vote
  id              TEXT (pk)
  interaction_id  TEXT (fk → Interaction)
  option_text     TEXT
  voter_id        TEXT (anonymous session cookie)
  created_at      DATETIME

Question
  id              TEXT (pk)
  interaction_id  TEXT (fk → Interaction)
  content         TEXT
  asker_name      TEXT (optional)
  asker_id        TEXT (session cookie)
  created_at      DATETIME
  upvotes         INTEGER DEFAULT 0
```

- All PKs are nanoid TEXT for future distributed migration potential.
- `voter_id` / `asker_id` come from an anonymous session cookie set on first visit.
- No user table in V1. Creators manage rooms via a token stored in localStorage.

## Frontend Design

### Landing Page (`/`)

Two CTAs only: "Create New Room" and "Join with Code". Create redirects to creator dashboard with room code ready to share.

### Creator Dashboard (`/room/[code]`)

Two-panel layout on desktop:
- **Left panel:** Interaction queue — list of poll/QA/word cloud items with drag-to-reorder. Active one highlighted.
- **Right panel:** Preview of the selected interaction with live results. Start/Stop toggle.

Mobile: single column with bottom drawer for interaction queue.

### Presentation View (`/room/[code]/present`)

Full-screen, dark background, large text, high contrast. Animated result reveal controlled by the creator (start interaction → results animate in). Bottom bar shows participant count + subtle "Powered by LiveMent" watermark. QR code overlay for audience to join.

### Audience View (`/join/[code]`)

Minimal, instant-load. Shows the current live interaction. After submitting, shows a compact result preview. The full animated reveal is reserved for the presentation screen.

### Animation Strategy

- **framer-motion** for key-path animations (spring bars, stagger cards)
- **TailwindCSS transitions** for simple opacity/color changes
- No heavy animation library

| Scene | Technique |
|-------|-----------|
| Poll bar growth | framer-motion spring |
| Word cloud entry | CSS transform + transition |
| Q&A card stagger | framer-motion staggerChildren |
| Counter animation | requestAnimationFrame |
| Interaction switch | CSS opacity fade |

### Anonymous Identity

- Session cookie with random ID set on first page visit.
- Used for deduplication (one vote per interaction) and Q&A attribution.
- No personal data stored.

## V1 Scope (In)

- Room creation with 4-character nanoid code
- Poll: multiple choice, creator controls start/stop
- Q&A: audience submits questions, creator can display/approve
- Word cloud: audience submits words, real-time frequency visualization
- SSE real-time updates for all interaction types
- Responsive design (desktop creator + mobile audience)
- Anonymous session identity via cookie

## V1 Scope (Out)

- User accounts / authentication
- Room persistence beyond browser session for creators (later: creator token in URL as fallback)
- Data export
- Custom branding
- Embedded integrations (Notion, Slack, etc.)
- Team / organization features
