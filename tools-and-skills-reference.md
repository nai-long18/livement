# Claude Code — MCP 工具与技能参考

> 生成日期: 2026-05-12

---

## MCP 工具 (共 46 个)

### 1. Browser (浏览器自动化) — 23 个工具

基于 Playwright 的浏览器控制工具。

| 工具 | 功能 |
|------|------|
| `browser_navigate` | 导航到指定 URL |
| `browser_navigate_back` | 返回上一页 |
| `browser_snapshot` | 捕获页面可访问性快照 (比截图更好) |
| `browser_take_screenshot` | 页面截图 (支持全页/元素) |
| `browser_click` | 点击元素 (支持双击/右键/修饰键) |
| `browser_type` | 在可编辑元素中输入文本 |
| `browser_fill_form` | 批量填写表单字段 |
| `browser_select_option` | 选择下拉框选项 |
| `browser_hover` | 悬停在元素上 |
| `browser_drag` | 拖拽元素 |
| `browser_drop` | 将文件/MIME 数据拖放到元素上 |
| `browser_file_upload` | 上传文件 |
| `browser_press_key` | 按键操作 |
| `browser_wait_for` | 等待文本出现/消失或指定时间 |
| `browser_handle_dialog` | 处理浏览器对话框 (alert/confirm/prompt) |
| `browser_evaluate` | 在页面或元素上执行 JavaScript |
| `browser_run_code_unsafe` | 运行 Playwright 代码片段 (RCE 等效) |
| `browser_console_messages` | 获取控制台消息 |
| `browser_network_requests` | 列出网络请求 |
| `browser_network_request` | 获取单个网络请求详情 (头/体) |
| `browser_tabs` | 标签页管理 (列出/创建/关闭/切换) |
| `browser_resize` | 调整浏览器窗口大小 |
| `browser_close` | 关闭页面 |

### 2. Local Files (本地文件系统) — 14 个工具

文件与目录管理工具，仅在允许目录范围内操作。

| 工具 | 功能 |
|------|------|
| `list_allowed_directories` | 列出允许访问的目录 |
| `list_directory` | 列出目录内容 (文件/目录标记) |
| `list_directory_with_sizes` | 列出目录内容含文件大小 |
| `directory_tree` | 递归获取目录树 (JSON 结构) |
| `get_file_info` | 获取文件/目录元数据 (大小/时间/权限) |
| `read_text_file` | 读取文本文件 (支持 head/tail) |
| `read_media_file` | 读取图片/音频文件 (base64) |
| `read_multiple_files` | 批量读取多个文件 |
| `write_file` | 创建或覆盖文件 |
| `edit_file` | 基于行的文件编辑 (git-diff 风格) |
| `create_directory` | 创建目录 (支持嵌套) |
| `move_file` | 移动或重命名文件/目录 |
| `search_files` | 按 glob 模式搜索文件 |
| `read_file` | (已弃用) 读取文件 |

### 3. Memory (知识图谱记忆) — 9 个工具

持久化知识图谱记忆系统。

| 工具 | 功能 |
|------|------|
| `create_entities` | 创建多个实体 |
| `add_observations` | 向已有实体添加观察记录 |
| `create_relations` | 创建实体间关系 |
| `open_nodes` | 按名称打开特定节点 |
| `read_graph` | 读取整个知识图谱 |
| `search_nodes` | 搜索节点 (匹配名称/类型/观察内容) |
| `delete_entities` | 删除实体及其关联关系 |
| `delete_observations` | 删除实体的特定观察记录 |
| `delete_relations` | 删除关系 |

---

## 技能 (共 23 个)

### Superpowers 技能包 — 14 个

| # | 技能 | 触发场景 |
|---|------|---------|
| 1 | `superpowers:brainstorming` | 创造性工作前 — 探索需求、意图与设计 |
| 2 | `superpowers:writing-plans` | 多步骤任务实施前 — 编写实现计划 |
| 3 | `superpowers:executing-plans` | 在独立会话中执行实现计划，含审查检查点 |
| 4 | `superpowers:subagent-driven-development` | 当前会话中执行含独立任务的实现计划 |
| 5 | `superpowers:dispatching-parallel-agents` | 2+ 个独立任务，可并行分派代理 |
| 6 | `superpowers:test-driven-development` | 实现功能/修复 bug 前 — 先写测试 |
| 7 | `superpowers:systematic-debugging` | 遇到 bug/测试失败/意外行为时 |
| 8 | `superpowers:verification-before-completion` | 声称完成/修复/通过前 — 运行验证命令 |
| 9 | `superpowers:requesting-code-review` | 完成任务/实现功能/合并前 |
| 10 | `superpowers:receiving-code-review` | 收到代码审查反馈后，实施前 |
| 11 | `superpowers:finishing-a-development-branch` | 实现完成、测试通过后 — 合并/PR/清理 |
| 12 | `superpowers:using-git-worktrees` | 需要隔离工作空间时 |
| 13 | `superpowers:writing-skills` | 创建/编辑/验证自定义技能 |
| 14 | `superpowers:using-superpowers` | 启动任何对话时 — 建立技能使用引导 |

### 内置技能 — 9 个

| 技能 | 触发场景 |
|------|---------|
| `update-config` | 配置 settings.json、hooks、权限、环境变量 |
| `keybindings-help` | 自定义键盘快捷键 / keybindings.json |
| `simplify` | 审查代码改进重用性、质量和效率 |
| `fewer-permission-prompts` | 减少权限提示 — 扫描并添加允许列表 |
| `loop` | 定时循环执行 prompt 或斜杠命令 |
| `claude-api` | 构建/调试 Claude API / Anthropic SDK 应用 |
| `init` | 初始化新的 CLAUDE.md 文件 |
| `review` | 审查 Pull Request |
| `security-review` | 对当前分支待更改进行安全审查 |

---

## 内置工具 (非 MCP)

| 类别 | 工具 |
|------|------|
| **文件读写** | Read, Write, Edit, Glob, Grep |
| **执行** | Bash, TaskCreate, TaskUpdate, TaskGet, TaskList, TaskOutput, TaskStop |
| **代理** | Agent (Explore / Plan / general-purpose / claude-code-guide) |
| **计划** | EnterPlanMode, ExitPlanMode |
| **工作树** | EnterWorktree, ExitWorktree |
| **定时** | CronCreate, CronDelete, CronList, ScheduleWakeup |
| **网络** | WebSearch, WebFetch |
| **用户交互** | AskUserQuestion |
| **技能** | Skill |
| **记忆** | (基于文件的持久化记忆系统) |
