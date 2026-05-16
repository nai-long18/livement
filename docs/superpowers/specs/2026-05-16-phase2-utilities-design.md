# Phase 2: Utilities — Participant Count, CSV Export, Countdown Timer

## Overview

Add three utility features to improve creator control and situational awareness.

## Feature 1: Real-time Participant Count (Role-Aware)

### SSE Infrastructure Change

- `subscribeToRoom(roomCode, listener)` → `subscribeToRoom(roomCode, role, listener)`
  - `role: 'creator' | 'audience'`
- Internal storage: `Map<string, Set<{ listener: Listener; role: string }>>`
- New function: `getRoomParticipantCount(roomCode): { creators: number; audience: number }`
- On subscribe/unsubscribe: broadcast `participants.update` SSE event to all listeners in the room

### New SSE Event
```json
{ "type": "participants.update", "data": { "creators": 2, "audience": 15 } }
```

### Client Hook Change

- `useSSE(roomCode, onEvent)` → `useSSE(roomCode, onEvent, role?)`
- Pass `role` to SSE stream API via query param: `/api/room/[code]/stream?role=creator`

### SSE Stream API Change

- Parse `role` from searchParams
- Call `subscribeToRoom(code, role, listener)`

### UI Display

- `creator-dashboard.tsx` bottom bar and `presentation-view.tsx` footer:
  - Replace static "参与人数: X" with live counts
  - Format: "👤 X 管理 · 👥 Y 观众"
- Listen for `participants.update` SSE event, update state

### Files
| File | Change |
|------|--------|
| `src/lib/sse.ts` | Role-aware subscribe, getRoomParticipantCount |
| `src/hooks/use-sse.ts` | Role parameter, pass to API |
| `src/app/api/room/[code]/stream/route.ts` | Parse role, pass to subscribe |
| `src/components/creator-dashboard.tsx` | Live participant count display |
| `src/components/presentation-view.tsx` | Live participant count display |

---

## Feature 2: CSV Data Export

### New API Route

`GET /api/room/[code]/export?type=poll|qa|wordcloud&interactionId=xxx`

- Reads data from existing functions (`getVoteResults`, `getQuestions`, `getWordCloudData`)
- Formats as CSV with BOM for Excel compatibility (`﻿`)
- Returns `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`

### CSV Formats

**Poll:**
```
选项,票数,百分比
实时投票,8,44%
词云,5,28%
问答互动,3,17%
演示模式,2,11%
```

**Q&A:**
```
问题,提问者,赞数,状态,时间
什么时候发布正式版？,赵六,0,已回答,2026-05-16 10:11
支持多少个并发用户？,李四,0,待回答,2026-05-16 10:11
```

**WordCloud:**
```
词汇,频次
创新,6
简洁,4
高效,3
```

### UI

- Creator Dashboard header bar: "导出" button with dropdown (投票结果 / 问答数据 / 词云数据)
- Click triggers download via `<a>` element or `window.open` to the export URL
- Disabled state when no interactions exist

### Files
| File | Change |
|------|--------|
| `src/app/api/room/[code]/export/route.ts` | New: export API |
| `src/components/creator-dashboard.tsx` | Export button + dropdown in header |

---

## Feature 3: Countdown Timer

### Interaction Config Extension

When creating/editing an interaction, optional timer settings stored in `config`:
```json
{
  "timerSeconds": 60,
  "autoClose": true
}
```

- `timerSeconds`: duration in seconds. 0 or undefined = no timer.
- `autoClose`: if true, timer reaching zero auto-closes the interaction (PATCH status=closed). For polls, also reveals results.

### Creator UI

**In `add-interaction-dialog.tsx`:**
- After the existing type-specific settings, add timer section:
  - "倒计时（秒）" number input (default empty = no timer)
  - "时间到自动关闭" checkbox (only shown when timer is set)
  - Quick-pick chips: 30s, 60s, 90s, 120s

**In `creator-dashboard.tsx` and `presentation-view.tsx`:**
- When active interaction has `config.timerSeconds > 0`, show countdown at the top of the content area
- Display: `MM:SS` format, animated (pulse when <10s, red when <=0)
- Countdown runs client-side: `setInterval` every second
- When timer hits zero:
  - If `autoClose`: call PATCH to close the interaction
  - If poll: call PATCH to reveal results (if not already revealed)
  - Show a visual "时间到！" toast

### Audience UI

- `audience-view.tsx`: Show countdown timer when active interaction has one
- Timer is read-only (sync from config)
- No auto-close control (creator only)

### Synchronization

- Timer start time stored in config: `{ timerSeconds, timerStartedAt: "ISO timestamp" }`
- Creator starts timer by PATCHing config with `timerStartedAt`
- SSE broadcasts `interaction.update` with updated config
- All clients compute remaining time from `timerStartedAt + timerSeconds - now`
- This ensures sync across page reloads and late joiners

### Files
| File | Change |
|------|--------|
| `src/components/add-interaction-dialog.tsx` | Timer settings UI |
| `src/components/creator-dashboard.tsx` | Countdown display + auto-close logic |
| `src/components/presentation-view.tsx` | Countdown display (read-only control) |
| `src/components/audience-view.tsx` | Countdown display (read-only) |

---

## Summary

| Feature | New Files | Modified Files | Complexity |
|---------|-----------|----------------|------------|
| Participant Count | 0 | 5 | Low |
| CSV Export | 1 | 1 | Low |
| Countdown Timer | 0 | 4 | Medium |

Total: 1 new file, ~10 modifications. All features are independent and can be built in sequence.
