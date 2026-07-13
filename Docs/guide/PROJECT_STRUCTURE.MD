# PROJECT STRUCTURE

## 1. 当前项目状态

TravelAssistant 已形成从旅行需求到研究证据、再到旅行计划展示的首个完整闭环：

- npm workspaces 管理 NestJS/Fastify 后端与 Vite/React 前端。
- PostgreSQL 保存 trip、Agent run、研究来源和不可变行程版本；Research 不使用结果缓存。
- Research 由受约束 ReAct Agent 编排小红书、Tavily、高德 POI、天气和路线工具。
- 小红书 MCP 是可选只读数据源；不可用时自动降级，不阻塞 Tavily/高德研究和后续行程生成。
- Planner 使用最新已完成研究来源，通过 OpenAI-compatible LLM 生成结构化行程，并支持编辑另存新版本。
- Compose 默认包含 `web`、`api`、`postgres`，`xhs` profile 按需启动 `xiaohongshu-mcp`。

## 2. 根目录

- `package.json`：workspace 入口；统一提供 lint、typecheck、test 和 build。
- `tsconfig.base.json`：共享 TypeScript 配置。
- `.env.example`：所有后端/provider/Research 配置占位。
- `.env.local.example`：本机后端直连 Docker Postgres/MCP 的 host override。
- `docker-compose.yml`：服务编排与环境变量透传。
- `README.md`：运行、API、功能和安全说明。

## 3. 后端模块

### `config/` 与 `health/`

- `AppConfigService` 读取数据库、MCP、LLM、高德、Tavily 和 Research 配置。
- LLM readiness 同时要求 `LLM_API_KEY` 与 `LLM_MODEL`。
- `GET /api/health` 只暴露 configured/missing，不返回密钥值。

### `database/`

- 使用 `pg` Pool 和参数化查询。
- 启动时以兼容式 DDL 确保 `trips`、`agent_runs`、`research_sources`、`itinerary_versions` 存在，并清理旧版本遗留的 `research_cache` 表。
- `agent_runs.progress` 使用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 升级旧数据库。

### `trips/`

- `POST /api/trips` 创建 draft。
- `GET /api/trips` 和 `GET /api/trips/:id` 查询。

### `safety/` 与 `mcp/`

- Safety 硬编码拒绝发布、评论、点赞、收藏和删除 cookies 等写工具。
- MCP client 使用 JSON-RPC over Streamable HTTP，并通过 `XHS_MCP_TIMEOUT_MS` 中止超时请求。
- 状态和二维码 API 保留，供用户选择登录；新 Research run 不再因未登录进入阻塞等待。

### `infrastructure/`

- `AppConfigService`、`DatabaseService` 和 Provider 客户端统一位于 `infrastructure/`，由 `InfrastructureModule` 聚合导出。
- `AmapProviderService`：POI、地理编码、实时天气与预报、步行/驾车/公交路线估算。
- `TavilyProviderService`：网页检索和结果归一化。
- `LlmProviderService`：单个 OpenAI-compatible chat/JSON completion 端点。
- provider 支持注入 `fetchFn`，测试不访问真实外部网络。

### `agents/` 与 `agent-core/`

- `BaseAgent` 定义 Agent 的 prompt、决策 Schema、决策校验、制品处理和强制继续钩子。
- `BaseTool` 统一工具名称、描述、JSON Schema 和异步执行契约。
- `ToolRegistry` 由 NestJS 模块统一提供，Research 在模块初始化时声明式注册五个工具。
- `AgentRunner` 统一处理 ReAct 轮次、finish 守卫、重复 action、工具失败降级、进度回调和轮次上限。
- `AgentOrchestrator` 为未来多 Agent 顺序流水线提供可选步骤和结果传递能力。
- `agents/research/` 集中 ResearchAgent、Research tools、Schema 和 validator。
- `agents/planner/` 提供 PlannerAgent 及 itinerary Schema/validator。

### `workflows/`、`persistence/` 与 `api/`

- `ResearchWorkflow` 和 `PlanWorkflow` 编排 Agent、预检、异步生命周期和结果持久化。
- `persistence/` 按表提供 `TripRepository`、`AgentRunRepository`、`ResearchSourceRepository` 和 `ItineraryRepository`。
- `api/` 集中所有 HTTP Controller；Controller 只负责路由、参数和转发。
- v2 计划中的 LLM primary/fallback 链尚未实现，当前仍使用兼容的 `LLM_*` 配置。

### Research workflow

- `ResearchWorkflow` 创建 run 后立即返回，并在 API 进程内继续执行；未预期错误尝试写入 failed 终态。
- `ResearchAgent` 继承通用 `BaseAgent`，负责 Research prompt、决策 Schema、来源清洗去重和无来源强制继续；`AgentRunner` 最多执行 8 轮安全 decision → tool → observation。
- `research-agent.validator.ts` 严格验证 action、工具白名单、参数和额外字段。
- `tools/` 下五个独立 `BaseTool` 实现分别封装 XHS、Tavily、高德 POI、天气和路线；`ResearchToolRegistrar` 负责注册。
- 每次新 Research run 都重新执行配置检查、ReAct Agent 和可用 Provider 调用，不复用历史研究结果。
- PostgreSQL 部分唯一索引与服务端 active-run 查询共同保证同一 trip 单活；再次启动时会终止超过阈值的遗留 running run。
- `progress` 只保存工具执行安全摘要，不保存模型 Thought、prompt、第三方 raw response 或 XHS 临时 token。

### Planner workflow

- `PlanWorkflow` 读取最新 completed 且有来源的 research run，构建 `PlannerAgent` context，并通过 `AgentRunner` 的 generate 模式完成单次 LLM 调用。
- LLM JSON completion 经严格行程 Schema 校验后由 `ItineraryRepository` 写入 `itinerary_versions`。
- 生成与编辑均创建递增不可变版本；未知来源 ID 在入库前过滤。

## 4. 前端结构

- `app/App.tsx`：工作台布局，持有当前 trip、current run、服务状态和 active stage；单页按“描述旅程 → 收集证据 → 编辑行程”只渲染当前阶段，阶段导航根据前置条件启用并自动推进。
- `app/styles.css`：集中维护暖色旅行工作台的语义设计 Token、阶段工作区、研究双栏/移动单列布局、交互状态、焦点与 reduced-motion 规则。
- `trip-form/`：创建旅行画像；切换新 trip 时清空 current run，并使用明确的提交、成功和失败反馈。
- `agent-run/`：启动研究、轮询 running run、展示配置检查、轮次、工具安全摘要和降级信息；等待与失败状态采用可恢复文案，旧 `waiting_login` 恢复 UI 保留兼容。
- `sources/`：跟随 run ID 加载来源；running 时轮询，终态停止；区分高德 POI、天气和路线，并展示未开始/正在寻找/来源错误状态。
- `itinerary-editor/TravelPlan.tsx`：读取/生成最新行程，以逐日紧凑活动卡片展示标题、必去标签、描述、时间和费用；前端不提供行程编辑控件。
- `api/client.ts`：集中维护后端 API 类型与 fetch 调用。
- mpn

## 5. 当前运行边界

- Research 是进程内异步执行，不依赖队列；API 重启后的 run 恢复尚未实现。
- `RESEARCH_MAX_ROUNDS` 默认且上限为 8。
- `RESEARCH_STALE_AFTER_SECONDS` 默认 3600，用于再次启动时处理进程重启遗留的 running run。
- 根 `.dockerignore` 排除 `.env`、Git、依赖、构建产物与 XHS Cookie 数据，避免进入 Docker build context。
- 浏览器只访问本项目后端，所有 provider 密钥留在后端环境变量。

## 6. 后续开发入口

按 v2 架构建议依次推进：

1. Planner 将研究阶段的天气与路线证据注入活动，并形成稳定坐标/路段契约。
2. 前端高德地图可视化及行程编辑联动。
3. 行程 PDF 导出。
4. LLM primary/fallback provider 链和全局统一错误过滤器。
5. 当任务规模需要时，将进程内 Research executor 升级为可恢复队列/worker。
