# Phase 3: New Interaction Types — Rating Scale & Leaderboard Poll

## Overview

Add two new interaction types to the platform: `rating` (star + NPS) and `leaderboard` (ranked multi-select poll). Both reuse the existing `vote` table and API infrastructure, following the same architecture pattern as poll/qa/wordcloud.

---

## Module 1: Data Model & API

### New InteractionType Values

Extend `InteractionType` from `'poll' | 'qa' | 'wordcloud'` to add `'rating' | 'leaderboard'`.

### Rating Config

```json
{
  "ratingType": "star",
  "min": 1,
  "max": 5,
  "lowLabel": "",
  "highLabel": ""
}
```

- `ratingType`: `"star"` (1-5) or `"nps"` (0-10)
- `lowLabel` / `highLabel`: NPS endpoint labels, optional

### Leaderboard Config

```json
{
  "options": ["Option A", "Option B", "Option C"],
  "maxSelect": 3
}
```

### Data Storage

Both reuse the `vote` table (same as wordcloud):
- **rating**: `option_text` stores the numeric score as a string ("4", "8")
- **leaderboard**: `option_text` stores the selected option text, up to `maxSelect` rows per voter. Requires updating `submitVote` to support multi-vote per voter (currently overwrites on duplicate `voter_id`). Use delete-then-reinsert for all selected options in a single transaction.

### Vote Results Shape

**Rating response** (GET vote with interactionId):
```json
{
  "type": "rating",
  "average": 4.2,
  "distribution": { "1": 2, "2": 1, "3": 5, "4": 12, "5": 8 },
  "total": 28,
  "npsScore": null
}
```

NPS adds `npsScore`: computed as `(promoters - detractors) / total * 100`.

**Leaderboard response** — same as existing poll results (`{ total, options: [{ option_text, count }] }`), sorted by count descending.

### API Changes

| Route | Change |
|-------|--------|
| `POST /api/room/[code]/interaction` | Type validation: allow `rating`, `leaderboard` |
| `GET /api/room/[code]/vote` | Return rating distribution/NPS when type is `rating` |
| `POST /api/room/[code]/vote` | No change — already accepts `option_text` |
| `GET /api/room/[code]/export` | Add CSV formats for rating and leaderboard |

### SSE

No new event types. Reuse `vote.update` — fired on each submission.

### CSV Export Formats

**Rating:**
```
评分,人数,占比
5,8,29%
4,12,43%
3,5,18%
2,1,4%
1,2,7%
```

**Leaderboard:** Same format as poll:
```
选项,票数,百分比
选项A,15,42%
选项B,12,33%
选项C,9,25%
```

---

## Module 2: Audience Participation UI

### Rating — Star Mode

- 5 clickable stars with hover glow
- Clicking star N selects scores 1-N with fill animation
- Label text below stars: "4星 — 满意"
- After submit: "✓ 已提交" with option to modify

### Rating — NPS Mode

- 11 buttons (0-10) in a horizontal row
- Left endpoint label (default: "完全不可能"), right endpoint label (default: "一定会")
- Color gradient: 0-6 red zone, 7-8 yellow zone, 9-10 green zone
- Selected button: filled variant; rest: outline
- After submit: "✓ 已提交"

### Leaderboard

- Checkbox list, same visual style as existing poll
- "最多选择 N 个" hint at top
- At limit: remaining options disabled (grayed out)
- Submit button disabled until at least 1 selected

All share existing `submitted` / `resultPreview` state management in `audience-view.tsx`.

---

## Module 3: Results Display

### Rating Results (`rating-results.tsx`)

Props: `{ roomCode, interactionId, live, isCreator, initialRevealed }`

**Star mode:**
- Large average score (e.g., "4.2") with star icons
- Distribution bar chart: one row per rating value, descending order
- Bar fill: blue gradient, proportional to count
- Highest-frequency rating highlighted

**NPS mode:**
- Large NPS score (range -100 to +100), color-coded
- Three-zone breakdown:
  - Detractors (0-6): red background, count + percentage
  - Passives (7-8): yellow/amber background
  - Promoters (9-10): green background
- Formula: `(promoters - detractors) / total * 100`

Both modes: live polling every 2s when `live=true`, creator reveal gate, count-up animation for numbers.

### Leaderboard Results (`leaderboard-results.tsx`)

Props: `{ roomCode, interactionId, live, isCreator, initialRevealed }`

- Ranked list with medal badges: 🥇🥈🥉 for top 3, then numeric (4, 5, ...)
- Option name + vote count + percentage
- Gold gradient background for 1st place
- Proportional bar fill per row
- Staggered entry animation (same as existing poll)

---

## Module 4: Creator Dialog Configuration

In `add-interaction-dialog.tsx`, add two type buttons: "评分" and "排行榜".

### Rating Configuration Area

- Sub-type toggle: `星级评分` | `NPS 推荐值`
- Preview: star icons or 0-10 number bar
- NPS mode: optional left/right label inputs (defaults: "完全不可能" / "一定会")

### Leaderboard Configuration Area

- Option inputs (dynamic rows, same pattern as poll)
- "最多可选" number input (default 3, min 1, max = option count)

### Timer Section

Unchanged — both new types support the existing countdown timer.

---

## Files Summary

| File | Change |
|------|--------|
| `src/lib/interaction.ts` | Extend `InteractionType`, add rating results helper |
| `src/app/api/room/[code]/interaction/route.ts` | Type validation |
| `src/app/api/room/[code]/vote/route.ts` | Rating/NPS result formatting |
| `src/app/api/room/[code]/export/route.ts` | Rating/leaderboard CSV formats |
| `src/components/add-interaction-dialog.tsx` | New type tabs + config UI |
| `src/components/audience-view.tsx` | Rating/NPS form + leaderboard form |
| `src/components/creator-dashboard.tsx` | Render rating/leaderboard results |
| `src/components/presentation-view.tsx` | Render rating/leaderboard results |
| `src/components/rating-results.tsx` | **New** — star + NPS results |
| `src/components/leaderboard-results.tsx` | **New** — ranked leaderboard display |
| `src/lib/__tests__/interaction.test.ts` | Tests for rating results + NPS calculation |

Total: 2 new files, 9 modified files.
