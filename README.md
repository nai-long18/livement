# LiveMent

> 实时互动，三秒开始。

面向线下活动、课堂、会议场景的轻量级实时投票、问答与词云平台。创建者一键生成互动空间，观众通过 4 位码零摩擦加入，大屏实时动画展示结果。

## 为什么是 LiveMent

现有工具（Mentimeter、Slido、AhaSlides）要么价格昂贵，要么严格限制免费版参与人数——因为维持 WebSocket 长连接的服务器成本迫使它们按"并发连接数"收费。

LiveMent 从两个维度破局：

| 维度 | 竞品 | LiveMent |
|------|------|---------|
| **参与摩擦** | 注册、下载 App、扫码关注 | 打开链接 → 输入 4 位码 → 即刻参与 |
| **成本结构** | 容器维持长连接，成本高昂 | SSE + SQLite，单台 Droplet 即可支撑 |

核心场景不是"微信群投票"，而是**台上演讲、台下互动、大屏展示**——因此交互美学是核心竞争力，而非功能列表。

## 技术栈

| 层 | 选型 |
|---|------|
| 框架 | Next.js 16 (App Router) + TypeScript |
| 样式 | TailwindCSS v4 |
| 组件 | shadcn/ui v4 (@base-ui/react) |
| 实时通信 | Server-Sent Events (SSE)，客户端监听 + fetch POST 写入 |
| 数据库 | SQLite (better-sqlite3, WAL 模式)，零运维 |
| 动画 | framer-motion |
| 部署 | DigitalOcean Droplet ($6/mo) + Nginx + PM2 |

## 功能

- **投票** — 多选实时投票，弹簧动画柱状图，百分比实时更新
- **问答** — 观众匿名提交问题，点赞排序，卡片动画
- **词云** — 高频词动态生长，多色渐变，spring 动画入场
- **全屏演示** — 深色投影模式，生成加入二维码，"Powered by LiveMent" 水印
- **零摩擦加入** — 4 位房间码，匿名会话 Cookie，无需注册
- **实时同步** — SSE 推送所有状态变更，断线自动重连

## 架构

```
┌─ 创建者 ─────────────────────┐  ┌─ 观众 ────────────────┐
│ /                 首页       │  │ /join/[code]  参与页   │
│ /room/[code]      控制台     │  │   • 投票选项          │
│   • 添加互动 (Dialog)       │  │   • 提交问题          │
│   • 启动/关闭投票          │  │   • 输入词云词汇      │
│   • 实时结果预览           │  │                       │
│ /room/[code]/present 演示   │  └───────────────────────┘
│   • 全屏深色动画           │
│   • 二维码加入             │
└─────────────────────────────┘
           │  SSE (订阅) + fetch POST (提交)
           ▼
┌─────────────────────────────────┐
│  Next.js API Routes             │
│  /api/room         房间 CRUD    │
│  /api/.../interaction  互动 CRUD│
│  /api/.../vote      投票/词云   │
│  /api/.../question  问答/点赞   │
│  /api/.../stream    SSE 事件流  │
├─────────────────────────────────┤
│  SQLite (better-sqlite3, WAL)   │
│  room → interaction → vote      │
│                     → question  │
└─────────────────────────────────┘
```

实时通信采用"SSE 接收 + HTTP POST 提交"的混合模式：大屏和观众端通过 `/api/room/[code]/stream` 订阅事件流（ping / interaction.update / vote.update / question.new / wordcloud.update / room.close），用户操作通过标准 POST 请求提交。每个 SSE 事件携带完整状态（非增量），天然支持断线重连。

匿名身份通过 `lm_sid` Cookie 维护，用于去重投票和问答署名，不存储任何个人信息。

## 本地开发

```bash
git clone https://github.com/nai-long18/livement.git
cd livement
npm install
npm run dev        # http://localhost:3000
```

## 部署

目标服务器：Ubuntu 24.04, 1 vCPU / 1 GB RAM。

```bash
# 服务器上执行
git clone https://github.com/nai-long18/livement.git /opt/livement
cd /opt/livement
npm install
npm run build
pm2 start npm --name livement -- start
pm2 save

# Nginx 反向代理 (proxy_buffering off 支持 SSE)
sudo tee /etc/nginx/sites-available/livement > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_buffering off;
        proxy_read_timeout 24h;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/livement /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

详细脚本见 `deploy.sh`。

## 项目结构

```
src/
├── app/
│   ├── page.tsx                       # 首页
│   ├── layout.tsx                     # 根布局 + metadata
│   ├── room/[code]/
│   │   ├── page.tsx                   # 创建者控制台
│   │   ├── present/page.tsx           # 全屏演示
│   │   └── api/                       # SSE + CRUD 路由
│   └── join/[code]/page.tsx           # 观众参与
├── lib/
│   ├── db.ts                          # SQLite 实例 + schema
│   ├── room.ts                        # 房间业务逻辑
│   ├── interaction.ts                 # 投票/问答/词云逻辑
│   ├── sse.ts                         # SSE 流工具 + 内存 pub/sub
│   └── session.ts                     # 匿名会话 Cookie
├── hooks/
│   ├── use-sse.ts                     # SSE 客户端 hook
│   └── use-session.ts                 # 会话 ID hook
└── components/
    ├── landing.tsx                    # 首页组件
    ├── creator-dashboard.tsx          # 控制台主组件
    ├── interaction-queue.tsx          # 互动列表
    ├── add-interaction-dialog.tsx     # 添加互动弹窗
    ├── room-header.tsx                # 房间顶栏
    ├── poll-results.tsx               # 投票结果 + 弹簧动画
    ├── qa-feed.tsx                    # 问答卡片流
    ├── word-cloud.tsx                 # 彩色词云
    ├── presentation-view.tsx          # 全屏演示
    ├── audience-view.tsx              # 观众参与
    └── ui/                            # shadcn/ui 组件
```

## V1 范围

- [x] 房间创建 (4 位 nanoid)
- [x] 投票 (多选，启动/关闭)
- [x] 问答 (匿名提交 + 点赞)
- [x] 词云 (实时频率展示)
- [x] SSE 实时同步
- [x] 全屏演示视图
- [x] 响应式布局
- [x] 匿名会话
- [x] 生产环境部署

## V2 路线图

基于[可行性研究报告](./LiveMent%20研究可行性分析.md)的建议：

- **Canvas/WebGL 词云** — PixiJS 混合渲染，支持千级并发词条 60 FPS
- **Cloudflare Durable Objects** — WebSocket Hibernation API 极致成本压缩
- **Notion Embed** — iframe 一键嵌入，适配 Notion 小组件市场
- **Slack 集成** — 斜杠命令 `/livement poll`，频道内实时结果更新
- **创建者账号** — 房间管理、历史记录、数据导出

## 竞品对比

| | Mentimeter | Slido | AhaSlides | **LiveMent** |
|---|:---:|:---:|:---:|:---:|
| 免费人数上限 | 严格限制 | 100 人 | 50 人(5题后3人) | **无限制** |
| 入门价 | $14/月 | $12.50/月 | $7.95/月 | **免费** |
| 无需注册 | ❌ | ❌ | ❌ | **✅** |
| 中文界面 | ❌ | ❌ | ❌ | **✅** |
| 开源 | ❌ | ❌ | ❌ | **✅** |

## License

MIT
