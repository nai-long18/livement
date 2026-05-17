# LiveMent 技术架构与功能文档

> 轻量级实时互动投票 & 问答平台。创建者快速发起互动空间（房间），观众通过链接/码加入，参与投票、开放式问答、词云生成、评分量表、排行榜投票，所有结果通过 SSE 实时动态展示。

---

## 一、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16 |
| 语言 | TypeScript | 5 |
| 样式 | TailwindCSS | v4 |
| UI 组件库 | shadcn/ui (@base-ui/react) | v4 |
| 动画 | framer-motion | 最新 |
| 实时通信 | Server-Sent Events (SSE) | — |
| 数据库 | SQLite (better-sqlite3, WAL 模式) | — |
| 测试 | vitest | 4.x |
| 部署 | Node.js + PM2 + Nginx | — |

---

## 二、项目架构

### 2.1 路由设计

| 路径 | 角色 | 功能 |
|------|------|------|
| `/` | 所有 | 着陆页 — 创建房间、通过房码加入 |
| `/room/[code]` | 创建者 | 仪表板 — 管理互动、查看结果 |
| `/room/[code]/present` | 创建者 | 全屏演示视图 — 适合投影 |
| `/join/[code]` | 观众 | 提交投票、评分、问题、词汇 |

### 2.2 API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/room` | POST, GET | 创建/获取房间 |
| `/api/room/[code]/interaction` | POST, GET, PATCH, DELETE | CRUD 互动环节 |
| `/api/room/[code]/vote` | POST, GET | 提交投票/评分 + 获取结果 |
| `/api/room/[code]/question` | POST, GET, PATCH | 提交/赞/列出问题 |
| `/api/room/[code]/stream` | GET (SSE) | 实时事件流 |
| `/api/room/[code]/export` | GET | CSV 数据导出 |

### 2.3 SSE 事件类型

`ping`、`interaction.update`、`vote.update`、`question.new`、`question.upvote`、`wordcloud.update`、`participants.update`、`room.close`

每个事件携带全量状态（非增量），便于重连恢复。

### 2.4 数据模型

```
room ──1:N──> interaction ──1:N──> vote
                              ──1:N──> question
```

- 所有主键使用 nanoid TEXT
- 匿名身份通过 `lm_sid` cookie 实现 — 无用户表
- SQLite WAL 模式，同步 API（better-sqlite3）

### 2.5 项目文件结构

```
src/
├── app/
│   ├── api/room/
│   │   ├── route.ts                    # 房间 CRUD
│   │   └── [code]/
│   │       ├── interaction/route.ts    # 互动 CRUD
│   │       ├── vote/route.ts           # 投票/评分提交 & 结果
│   │       ├── question/route.ts       # 问答 CRUD
│   │       ├── stream/route.ts         # SSE 流端点
│   │       └── export/route.ts         # CSV 导出
│   ├── page.tsx                        # 着陆页
│   ├── room/[code]/page.tsx            # 创建者仪表板
│   ├── room/[code]/present/page.tsx    # 全屏演示
│   └── join/[code]/page.tsx            # 观众参与
├── components/
│   ├── landing.tsx                     # 着陆页组件
│   ├── creator-dashboard.tsx           # 创建者仪表板
│   ├── presentation-view.tsx           # 演示视图
│   ├── audience-view.tsx               # 观众视图
│   ├── interaction-queue.tsx           # 互动队列侧栏
│   ├── add-interaction-dialog.tsx      # 添加互动对话框
│   ├── poll-results.tsx                # 投票结果（柱状图）
│   ├── rating-results.tsx              # 评分结果（星级/NPS）
│   ├── leaderboard-results.tsx         # 排行榜结果
│   ├── qa-feed.tsx                     # 问答馈送
│   ├── word-cloud.tsx                  # 词云
│   ├── countdown-timer.tsx             # 倒计时组件
│   ├── room-header.tsx                 # 房间头部
│   ├── toast.tsx                       # Toast 通知
│   └── ui/                             # shadcn/ui 基础组件
├── hooks/
│   ├── use-sse.ts                      # SSE 客户端 Hook
│   └── use-session.ts                  # 匿名会话 Hook
└── lib/
    ├── db.ts                           # SQLite 实例 + 模式初始化
    ├── room.ts                         # 房间 CRUD
    ├── interaction.ts                  # 互动、投票、问题、词云逻辑
    ├── sse.ts                          # SSE 流构建器 + 内存发布/订阅
    ├── session.ts                      # 服务端匿名会话 cookie
    └── utils.ts                        # 工具函数
```

---

## 三、功能模块

### 3.1 核心平台 (MVP)

**功能：** 创建/加入房间、五种互动类型管理、实时结果展示

**互动类型演进：**

```
V1: poll | qa | wordcloud
V2 (Phase 3): + rating | leaderboard
```

**技术要点：**
- **SSE 实时通信：** 基于 `src/lib/sse.ts` 的内存发布/订阅模式，`createSSEStream` 构建符合 SSE 规范的 ReadableStream，自定义 `subscribeToRoom` / `publishToRoom` 实现房间级隔离
- **客户端 Hook：** `useSSE` 封装 EventSource 连接、指数退避重连（`src/hooks/use-sse.ts`）
- **匿名会话：** `lm_sid` cookie + `useSessionId` Hook 实现无需注册的持久身份

---

### 3.2 Phase 1：搜索 & 交互性增强

**功能：**
- **全局搜索栏** — 创建者仪表板顶部搜索，联动过滤互动队列、问答列表、词云高亮
- **问答增强** — 标记"已回答"✓、置顶📌问题，排序逻辑改为 `pinned DESC → answered ASC → upvotes DESC`
- **投票结果揭示动画** — 交错柱状条入场 + 数字缓动计数（cubic ease-out）

**技术要点：**
- **搜索过滤：** 各组件接收 `searchQuery` prop，客户端 `toLowerCase().includes()` 实时过滤，词云组件匹配词汇调高 opacity
- **数据库迁移：** safe migration 模式 — `try/catch ALTER TABLE` 添加 `answered` / `pinned` 列
- **动画：** framer-motion `staggerChildren` + 自定义 `CountUp` 组件（requestAnimationFrame + easeOutCubic）

**相关文件：**
- `src/components/creator-dashboard.tsx` — 搜索栏中心
- `src/components/interaction-queue.tsx` — 互动过滤
- `src/components/qa-feed.tsx` — Q&A 搜索 + 状态管理
- `src/components/word-cloud.tsx` — 词云搜索高亮
- `src/components/poll-results.tsx` — 揭示动画
- `src/lib/interaction.ts` — `updateQuestionStatus` 事务
- `src/lib/db.ts` — 数据库迁移

---

### 3.3 Phase 2：实用工具

**功能：**
- **实时参与人数** — 角色感知的在线计数（👤 N 管理 · 👥 N 观众）
- **CSV 数据导出** — 投票/问答/词云数据一键导出（BOM UTF-8，Excel 兼容）
- **倒计时器** — 互动可配置倒计时，时间到自动关闭/揭示结果

**技术要点：**
- **角色感知 SSE：** `subscribeToRoom` 改为接收 `role: 'creator' | 'audience'`，内部 `Map<string, Set<{ listener, role }>>`，订阅/取消订阅时广播 `participants.update`
- **CSV 导出：** `/api/room/[code]/export?type=poll|qa|wordcloud&interactionId=xxx`，`﻿` BOM 前缀确保 Excel 正确识别 UTF-8
- **倒计时同步：** 服务端存储 `timerStartedAt` ISO 时间戳，所有客户端计算 `timerSeconds + timerStartedAt - Date.now()` 确保跨页面同步

**相关文件：**
- `src/lib/sse.ts` — 角色感知订阅 + `getRoomParticipantCount`
- `src/hooks/use-sse.ts` — 角色参数
- `src/app/api/room/[code]/export/route.ts` — CSV 导出 API（新）
- `src/components/countdown-timer.tsx` — 倒计时 UI（新）
- `src/components/add-interaction-dialog.tsx` — 计时器配置

---

### 3.4 着陆页重设计

**功能：**
- 时段问候语（早上好/中午好/晚上好）
- 极光氛围背景（三组大尺寸模糊光球动画）
- 蓝宝石质感主按钮（多层堆叠阴影 + 玻璃切边 + hover 表面光泽）
- 毛玻璃输入框 + 动态加入按钮
- 3-2-1 倒计时入场动画
- 剪贴板智能检测房间码
- 最近访问房间（localStorage，最多 5 个）

**技术要点：**
- **AuroraBackground：** 三个 `motion.div` 超大模糊圆形（`blur(80px)`）+ 中心舞台光 + 顶部边缘光，`animate` 缓慢漂移
- **宝石按钮：** `boxShadow` 四层堆叠 — `0 1px 2px`（接触阴影）+ `0 4px 8px -2px`（环境阴影）+ `0 16px 48px -12px rgba(30,64,175,0.25)`（辉光）+ `inset 0 1px 0 rgba(255,255,255,0.22)`（顶部内高光）
- **玻璃切边：** 按钮顶部绝对定位 `height: 1px` div，`linear-gradient(180deg, rgba(255,255,255,0.28), transparent)`
- **毛玻璃：** `bg-white/[0.04] backdrop-blur-sm border border-white/[0.08]`
- **SSR 兼容：** `getGreeting()` 在 `useEffect` 中调用，避免水合不匹配

**相关文件：**
- `src/components/landing.tsx` — 全部着陆页逻辑 + AuroraBackground

---

### 3.5 Phase 3：新互动类型

#### 3.5.1 评分量表 (Rating Scale)

**两种模式：**

| 模式 | 范围 | 特点 |
|------|------|------|
| 星级评分 | 1-5 ★ | 点击选星，hover 高亮，平均分 + 分布条形图 |
| NPS 推荐值 | 0-10 | 标准 NPS 公式，三区分类（贬损/被动/推荐），彩色编码 |

**NPS 计算公式：** `(promoters - detractors) / total × 100`
- 推荐者 (Promoters)：9-10 分
- 被动者 (Passives)：7-8 分
- 贬损者 (Detractors)：0-6 分

**数据模型：** 复用 `vote` 表，`option_text` 存储分值字符串（"4"、"8"）

**相关文件：**
- `src/components/rating-results.tsx` — 星级/NPS 结果展示（新）
- `src/lib/interaction.ts` — `RatingResult` 接口 + `getRatingResults()` 函数

#### 3.5.2 排行榜投票 (Leaderboard Poll)

**功能：**
- 多选投票（创建者设定 `maxSelect`）
- 排行榜展示（🥇🥈🥉 奖牌 + 排名数字）
- 第 1 名金色渐变高亮
- 重新提交时删除旧票再插入（事务保护）

**数据模型：** 复用 `vote` 表 + 新增 `submitMultiVote()` 函数

**相关文件：**
- `src/components/leaderboard-results.tsx` — 排行榜结果展示（新）
- `src/lib/interaction.ts` — `submitMultiVote()` 事务函数

---

## 四、交互类型配置格式

### 投票 (poll)
```json
{ "options": ["A", "B", "C"], "multiple": false }
```

### 问答 (qa)
```json
{}
```

### 词云 (wordcloud)
```json
{}
```

### 评分 — 星级 (rating: star)
```json
{ "ratingType": "star", "min": 1, "max": 5 }
```

### 评分 — NPS (rating: nps)
```json
{
  "ratingType": "nps", "min": 0, "max": 10,
  "lowLabel": "完全不可能", "highLabel": "一定会推荐"
}
```

### 排行榜 (leaderboard)
```json
{ "options": ["Rust", "Go", "Python"], "maxSelect": 3 }
```

所有类型均支持可选的倒计时设置：
```json
{ "timerSeconds": 60, "autoClose": true, "timerStartedAt": "2026-05-17T04:00:00.000Z" }
```

---

## 五、测试覆盖

| 测试文件 | 测试数 | 覆盖范围 |
|----------|--------|----------|
| `src/lib/__tests__/room.test.ts` | 6 | 房间 CRUD |
| `src/lib/__tests__/sse.test.ts` | 5 | SSE 流 + 发布订阅 |
| `src/lib/__tests__/interaction.test.ts` | 14 | 互动 + 投票 + 多选 + 评分 + NPS |

**总计：25 个测试**，覆盖所有核心业务逻辑。

---

## 六、部署配置

- **服务器：** DigitalOcean Droplet (~$16/mo)
- **进程管理：** PM2
- **反向代理：** Nginx，`proxy_buffering off`（SSE 必需）
- **端口：** 8080（80 端口被运营商封锁）
- **备用通道：** Cloudflare Tunnel

---

## 七、Git 提交历史

```
* 10d64f5 fix: make scrollbar thumb visible in dark mode
* a08d185 feat: add rating and leaderboard participation forms to audience view
* 5349ead feat: integrate rating and leaderboard results into presentation view
* 117d446 feat: integrate rating and leaderboard results into creator dashboard
* b9bbf1d feat: add leaderboard-results component with ranked display
* e46180d feat: add rating-results component with star and NPS display
* 523a93e feat: add rating and leaderboard config UI to add-interaction-dialog
* 469565d feat: add CSV export support for rating and leaderboard types
* a531c5f feat: add rating results with NPS calculation, leaderboard multi-vote endpoint
* 96dfc09 feat: allow rating and leaderboard types in interaction API
* 9928749 fix: update production DB schema CHECK constraint for new interaction types
* bf40714 feat: extend InteractionType with rating and leaderboard, add submitMultiVote
* 7cad178 fix: brighten greeting and subtitle to #9ca3af cool blue-gray
* dd3e36e fix: precision polish — jewel CTA, typography contrast, ghost divider, glass surfaces
* 9b41a64 feat: refined landing — aurora background, jewel CTA, glassmorphism
* 1a865be feat: brand CTA button, animated star particles background
* c732f3a feat: redesigned landing page — greeting, countdown, clipboard, recent rooms
* 52aaf68 feat: live participant count and CSV export button
* 69410a0 feat: role-aware SSE participant count and CSV export API
* a546547 feat: global search bar in creator dashboard
* 289c46d fix: sort poll options by count, ease-out CountUp, initialRevealed prop
* 4c74305 feat: Q&A feed with search, answered/pin toggles, creator controls
* a447408 feat: poll reveal animation with stagger bars and count-up
* e8c4615 feat: dynamic word cloud with animated transitions and glow effect
* 5f698e3 feat: toast, delete interaction, copy link, multi-choice poll, word cloud scatter, fullscreen
* ... (共 60+ 提交)
```

---

*文档生成日期：2026-05-17*
