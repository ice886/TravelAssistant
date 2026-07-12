# PROJECT STRUCTURE

## 1. 当前项目状态

TravelAssistant 已形成从旅行需求到研究证据、再到可编辑行程的首个完整闭环：

- npm workspaces 管理 NestJS/Fastify 后端与 Vite/React 前端。
- PostgreSQL 保存 trip、Agent run、研究来源、研究缓存和不可变行程版本。
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
- 启动时以兼容式 DDL 确保 `trips`、`agent_runs`、`research_sources`、`research_cache`、`itinerary_versions` 存在。
- `agent_runs.progress` 使用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 升级旧数据库。

### `trips/`

- `POST /api/trips` 创建 draft。
- `GET /api/trips` 和 `GET /api/trips/:id` 查询。

### `safety/` 与 `mcp/`

- Safety 硬编码拒绝发布、评论、点赞、收藏和删除 cookies 等写工具。
- MCP client 使用 JSON-RPC over Streamable HTTP，并通过 `XHS_MCP_TIMEOUT_MS` 中止超时请求。
- 状态和二维码 API 保留，供用户选择登录；新 Research run 不再因未登录进入阻塞等待。

### `providers/`

- `AmapProviderService`：POI、地理编码、实时天气与预报、步行/驾车/公交路线估算。
- `TavilyProviderService`：网页检索和结果归一化。
- `LlmProviderService`：单个 OpenAI-compatible chat/JSON completion 端点。
- provider 支持注入 `fetchFn`，测试不访问真实外部网络。
- v2 计划中的 LLM primary/fallback 链尚未实现，当前仍使用兼容的 `LLM_*` 配置。

### `research/`

- `ResearchService` 创建 run 后立即返回，并在 API 进程内继续执行；未预期错误尝试写入 failed 终态。
- `ResearchAgentService` 最多执行 8 轮安全 decision → tool → observation，去重来源和重复调用。
- `research-agent.validator.ts` 严格验证 action、工具白名单、参数和额外字段。
- `ResearchToolsService` 只映射五个注册工具：`xhs_search`、`web_search`、`poi_search`、`get_weather`、`get_route`。
- `ResearchCacheService` 使用规范化旅行需求 SHA-256 key，默认缓存 7 天。
- cache key 同时包含预算、旅客、模型和 provider 配置 profile；缓存 envelope 保留覆盖/降级信息，运行时 provider 失败结果不缓存。
- 缓存命中会为新 run 物化新的 `research_sources` UUID，保持来源 API 与 Planner 引用有效。
- PostgreSQL 部分唯一索引与服务端 active-run 查询共同保证同一 trip 单活；再次启动时会终止超过阈值的遗留 running run。
- `progress` 只保存工具执行安全摘要，不保存模型 Thought、prompt、第三方 raw response 或 XHS 临时 token。

### `planner/`

- 读取最新 completed 且有来源的 research run，避免新的空 running run 遮蔽已有证据。
- LLM JSON completion 经严格行程 Schema 校验后写入 `itinerary_versions`。
- 生成与编辑均创建递增不可变版本；未知来源 ID 在入库前过滤。

## 4. 前端结构

- `app/App.tsx`：工作台布局，持有当前 trip、当前 run 和服务状态。
- `trip-form/`：创建旅行计划；切换新 trip 时清空当前 run。
- `agent-run/`：启动研究、轮询 running run、展示配置检查、轮次、工具安全摘要、缓存命中和降级信息；旧 `waiting_login` 恢复 UI 保留兼容。
- `sources/`：跟随 run ID 加载来源；running 时轮询，终态停止；区分高德 POI、天气和路线。
- `itinerary-editor/`：读取/生成最新行程，编辑后保存新版本。
- `api/client.ts`：集中维护后端 API 类型与 fetch 调用。
- mpn

## 5. 当前运行边界

- Research 是进程内异步执行，不依赖队列；API 重启后的 run 恢复尚未实现。
- `RESEARCH_MAX_ROUNDS` 默认且上限为 8；`RESEARCH_CACHE_TTL_SECONDS` 默认 604800。
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
