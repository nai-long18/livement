# Phase 1: Search + Enhanced Interactivity

## Overview

Add global search and enhance existing interaction types (Q&A and Poll) with richer feedback and controls.

## Feature 1: Global Search

### Search Bar
- **Location:** Creator Dashboard top bar (below RoomHeader, above content area). Audience View gets a simpler version inside Q&A and WordCloud sections.
- **Behavior:** Client-side text filtering — no API calls. 200ms debounce.

### Scopes

| Scope | Where | What It Does |
|-------|-------|--------------|
| Interaction Queue | `interaction-queue.tsx` | Filters interaction list by title substring |
| Q&A Feed | `qa-feed.tsx` | Filters questions by content substring, shows match count |
| Word Cloud | `word-cloud.tsx` | Highlights matching words (full opacity), dims non-matching (opacity 0.15) |

### Props
- `interaction-queue.tsx` gets new prop: `searchQuery?: string`
- `qa-feed.tsx` gets new prop: `searchQuery?: string`  
- `word-cloud.tsx` gets new prop: `highlightWord?: string`

### Dashboard Search
- Single search input in `creator-dashboard.tsx` drives all three sub-components.
- State: `const [searchQuery, setSearchQuery] = useState('')`

## Feature 2: Q&A Enhancements

### Data Model
Add two columns to `question` table:
```sql
ALTER TABLE question ADD COLUMN answered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE question ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
```

### API
Extend `PATCH /api/room/[code]/question` to accept:
```json
{ "id": "...", "answered": true, "pinned": false }
```
Returns updated question. Broadcasts SSE `question.update` event.

### QaFeed UI (Creator View)

- **Answered toggle:** Checkmark button on each question card. Toggles green checkmark + subtle green background.
- **Pin toggle:** Pin button (📌). Pinned questions float to top with a light accent border. Only one question pinned at a time (pinning another unpins the previous).
- **Sort order:** Pinned (top) → unanswered (by votes) → answered (by time, oldest first).
- **Answered questions:** Muted styling — reduced opacity, gray checkmark, pushed to bottom.

### QaFeed UI (Audience View)
- See answered status (green check) but cannot toggle.
- See pinned question at top.
- Search box to filter questions.

### SSE Event
```json
{ "type": "question.update", "data": { "id": "...", "answered": true, "pinned": true } }
```
Audience QaFeed re-fetches on this event.

## Feature 3: Poll Results Reveal Animation

### Behavior
- Poll results are hidden behind a "揭示结果" (Reveal Results) overlay until the creator clicks the button.
- Audience sees the same overlay — results only appear after creator reveals.
- Once revealed, results stay visible (SSE broadcast optional for V1 — audiences poll locally).

### Creator Flow
1. Creator clicks "揭示结果" button in PollResults.
2. Overlay fades out (framer-motion exit).
3. Bars stagger in from left with spring animation (100ms stagger).
4. Each bar's number counts up from 0 to final value (500ms ease-out).
5. Winning option gets a subtle glow pulse.

### Technical
- PollResults gets new prop: `revealed?: boolean` (default false for audience until creator reveals).
- Creator's `revealed` state is local (`useState(false)`).
- Audience sees `revealed` via a broadcast mechanism: the interaction's `config` JSON gains a `revealed: true` flag. When the creator clicks reveal, PATCH the interaction config. Audience SSE receives `interaction.update` with updated config, triggering reveal.
- Actually simpler: PollResults always fetches results. Just the animation is gated behind `revealed`. For audience, `revealed` defaults to checking `interaction.config.revealed`.

### Implementation
- New state in PollResults: `const [revealed, setRevealed] = useState(isCreator || config.revealed)`
- Creator gets a "揭示结果" button. Click → `setRevealed(true)` + optional PATCH to save to config.
- AnimatePresence + motion.div stagger for bars.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/db.ts` | ALTER TABLE migration for answered/pinned |
| `src/lib/interaction.ts` | `updateQuestion()` extended for answered/pinned, `getQuestions()` sort order |
| `src/app/api/room/[code]/question/route.ts` | PATCH handler for answered/pinned fields |
| `src/components/creator-dashboard.tsx` | Search bar + state, pass to children |
| `src/components/interaction-queue.tsx` | Search filter prop |
| `src/components/qa-feed.tsx` | Search, answered toggle, pin toggle, sort |
| `src/components/poll-results.tsx` | Reveal button, stagger bar animation, number counter |
| `src/components/audience-view.tsx` | Search for Q&A section, reveal-aware poll display |

## Out of Scope (Phase 2+)
- Real-time participant count
- Celebration animations on submit
- Countdown timer
- Rating scale / leaderboard poll types
- Data export
