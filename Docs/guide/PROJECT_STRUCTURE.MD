# PROJECT_STRUCTURE

## 1. 当前项目状态

当前仓库已建立最小前后端分离骨架，并完成旅行计划创建、小红书 MCP 状态检查和 research run 预检的首个业务闭环：
- 根目录使用 npm workspaces 管理 `backend` 和 `frontend`。
- `backend` 是 Nest.js + Fastify 服务，当前包含 `config`、`health`、`database`、`trips`、`safety`、`mcp`、`providers` 和 `research` 模块。
- `frontend` 是 Vite React 中文工作台，当前包含旅行表单、Agent 进度、来源证据和行程编辑区域；旅行表单已接入 `POST /api/trips`，Agent 面板已接入 `POST /api/trips/:id/research`，状态栏已接入 `/api/health` 与 `/api/xhs/status`。
- `docker-compose.yml` 描述本地 `web`、`api`、`postgres` 三个默认服务，并通过 `xhs` profile 按需启动 `xiaohongshu-mcp`。

## 2. 根目录文件

- `package.json`：workspace 入口和统一脚本。
- `tsconfig.base.json`：前后端共享 TypeScript 基础配置。
- `.env.example`：本地运行所需环境变量占位。
- `.env.local.example`：本机后端直连 Docker Postgres/MCP 时的覆盖配置模板。
- `docker-compose.yml`：本地容器编排。
- `README.md`：运行方式、架构和质量检查说明。

## 3. 后端结构

`backend/src/main.ts`
- 启动时先加载仓库根目录或后端目录下的 `.env`，再加载 `.env.local` 并允许覆盖。
- `.env.local` 用于本机后端开发场景，将 Docker 内部服务名覆盖为 `localhost`。
- 创建 Nest 应用。
- 设置 `/api` 全局前缀。
- 按 `WEB_ORIGIN` 启用 CORS，支持本地 Vite 前端直连后端。
- 使用 Fastify adapter。
- 根据 `AppConfigService` 配置监听端口。

`backend/src/modules/config/`
- `AppConfigService` 读取环境变量。
- `publicStatus` 仅返回配置是否存在，不返回密钥明文。
- `databaseUrl` 从 `DATABASE_URL` 读取，供数据库模块使用。
- `xhsMcpUrl` 和 `xhsReadonlyTools` 供 MCP 与安全模块使用。

`backend/src/modules/health/`
- `GET /api/health` 返回服务状态和配置状态。
- 使用显式 `@Inject(...)`，确保 `tsx` dev 模式和 `tsc` build 模式都能稳定注入依赖。

`backend/src/modules/database/`
- 使用 `pg` 连接 Postgres。
- 应用启动时确保 `trips`、`agent_runs` 和 `research_sources` 表存在。
- 对业务模块只暴露参数化 `query()` 方法。

`backend/src/modules/trips/`
- `POST /api/trips` 创建本地 draft 旅行计划。
- `GET /api/trips` 按创建时间倒序列出旅行计划。
- `GET /api/trips/:id` 查询单个旅行计划。
- 该模块不依赖 `xiaohongshu-mcp`；小红书能力从后续 research 阶段接入。

`backend/src/modules/safety/`
- `SafetyService` 维护小红书 MCP 只读白名单和写操作黑名单。
- 即使环境变量误配置，发布、评论、点赞、收藏和删除 cookies 工具仍会被拒绝。

`backend/src/modules/mcp/`
- `McpHttpClient` 使用 JSON-RPC over Streamable HTTP 访问 `XHS_MCP_URL`。
- `McpService` 提供小红书 MCP 连接状态、工具发现、登录状态和二维码获取。
- `McpController` 暴露 `GET /api/xhs/status`、`GET /api/xhs/login-qrcode` 与 `GET /api/xhs/login-qrcode/image`。
- MCP 未配置、未启动或调用失败时返回归一化状态，不影响创建旅行计划。

`backend/src/modules/providers/`
- `ProvidersModule` 导出 `AmapProviderService`、`TavilyProviderService` 和 `LlmProviderService`。
- `AmapProviderService` 支持高德地点搜索、地理编码和步行/驾车路线距离估算。
- `TavilyProviderService` 支持 Tavily 搜索，并归一化标题、URL、摘要、score 和 answer。
- `LlmProviderService` 支持 OpenAI-compatible chat completion 和 JSON completion；JSON completion 会要求模型只返回 JSON，并解析失败时抛出 provider 错误。
- provider services 接收可注入 `fetchFn`，测试中使用 mock，不依赖真实外部服务。

`backend/src/modules/research/`
- `POST /api/trips/:id/research` 为指定 trip 创建 Agent research run。
- 首版执行 provider 配置检查和小红书 MCP 登录状态检查，不消耗真实外部搜索或 LLM 调用额度。
- `GET /api/trips/:id/research-runs/latest` 返回最新 run、阶段、检查结果、错误摘要和来源数量。
- provider 缺失时 run 进入 `blocked_config`；MCP 未登录或不可用时进入 `waiting_login`；预检通过时进入 `completed`。

## 4. 前端结构

`frontend/src/app/`
- `App.tsx` 是工作台首屏布局。
- `App.tsx` 调用 `GET /api/health` 展示 API 和 Postgres 状态，调用 `GET /api/xhs/status` 展示小红书 MCP 连接和登录状态。
- `styles.css` 定义全局布局、面板和响应式样式。

`frontend/src/features/`
- `trip-form/`：创建旅行计划表单，提交后调用后端创建 draft trip。
- `agent-run/`：基于当前 trip 启动 research run，展示配置和 MCP 预检状态，并在 running 时轮询最新 run。
- `sources/`：来源证据区占位。
- `itinerary-editor/`：行程编辑区占位。
- 当前前端用户可见文案默认使用中文；API 字段名和后端契约仍保持英文标识。

`frontend/src/api/client.ts`
- 封装基础 API 地址。
- 提供 `getHealth()`、`getXhsStatus()`、`createTrip()`、`startResearch()` 和 `getLatestResearchRun()`。

## 5. 后续开发入口

建议下一步优先补充：
1. 小红书登录二维码入口与 `waiting_login` 状态下的恢复流程。
2. 在 research run 中接入 Tavily 搜索和小红书只读搜索，落库 `research_sources`。
3. 使用高德 provider 解析候选地点并形成地点证据。
4. 使用 LLM JSON completion 汇总来源，生成首版可编辑行程。
