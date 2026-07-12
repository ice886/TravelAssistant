

# TravelAssistant

TravelAssistant 是一个本地运行的全栈旅行规划工作台，整合小红书旅行内容、小红书 MCP、高德地图、Tavily 网页搜索和大模型能力，帮助用户从旅行需求生成可研究、可编辑、可追踪的旅行计划。

## 项目功能

当前版本已支持：

- 创建和保存旅行计划：目的地、天数或日期、兴趣偏好、预算档位、同行人类型和人数。
- 小红书只读研究：搜索旅行笔记，读取受限的标题、作者、摘要、笔记 ID 和来源链接，不持久化临时 token。
- 小红书登录恢复：显示登录二维码，扫码后重新检查登录状态。
- 小红书安全边界：仅允许登录检查、搜索、读取笔记和用户主页，禁止发布、评论、点赞、收藏和删除 Cookie。
- ReAct 研究任务：LLM 在最多 8 轮内从白名单工具中选择小红书、网页、POI、天气或路线查询，并记录安全的工具执行摘要。
- 自动降级：小红书未配置、未登录、超时或运行中失败时自动移除对应工具，继续使用 Tavily 与高德，不阻塞研究。
- 研究缓存：按规范化旅行需求缓存来源 7 天；命中时不调用 LLM 或外部 provider，并为本次 run 生成新的来源 ID。
- 单活保护：同一个 trip 同时只运行一个 Research run；重复启动会返回当前 run，超龄的进程内 run 会先标记失败。
- 高德地图研究：搜索 POI、获取实时天气与预报，并估算步行、驾车或公共交通路线。
- Tavily 网页研究：补充开放时间、门票、交通和旅行注意事项等信息。
- 来源证据面板：按 provider 展示小红书、地图和网页来源。
- 可编辑行程：基于最新研究来源生成逐日行程、交通与预算草稿，并保存不可变编辑版本。

Planner 的逐活动路线注入、实时价格、地图可视化和历史版本回滚界面将在后续阶段继续完善。

完成来源研究后，可在“行程编辑”面板点击“生成行程”。生成依赖已配置的 `LLM_API_KEY` 与 `LLM_MODEL`；编辑后点击“保存新版本”不会覆盖旧版本。

## 技术架构

- `frontend/`：React + TypeScript 前端工作台，只调用本项目后端 API。
- `backend/`：Nest.js + Fastify + TypeScript 后端，负责 Agent 编排、外部服务访问、数据持久化和安全边界。
- `postgres`：保存旅行计划、Agent run、研究来源、研究缓存和行程版本。
- `xiaohongshu-mcp`：本地小红书 MCP 服务，仅作为只读内容数据源。
- 外部 provider：高德地图、Tavily 和 OpenAI-compatible LLM API。

浏览器前端不会直接访问小红书 MCP、高德、Tavily 或 LLM；所有密钥和外部请求由后端统一管理。

## 首次部署

### 1. 准备环境

建议环境：

- Docker Desktop 或 Docker Engine + Compose
- Node.js 20 或更高版本
- npm 10 或更高版本

### 2. 配置环境变量

在项目根目录执行：

```bash
cp .env.example .env
```

至少检查以下配置：

```ini
POSTGRES_DB=travel_assistant
POSTGRES_USER=travel_assistant
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://travel_assistant:change-me@postgres:5432/travel_assistant
XHS_MCP_URL=http://xiaohongshu-mcp:18060/mcp
XHS_MCP_TIMEOUT_MS=15000
```

如需启用高德、Tavily 和 LLM 研究，请继续填写：

```ini
AMAP_API_KEY=你的高德密钥
TAVILY_API_KEY=你的Tavily密钥
LLM_API_KEY=你的模型密钥
LLM_MODEL=你的模型名称
RESEARCH_MAX_ROUNDS=8
RESEARCH_CACHE_TTL_SECONDS=604800
RESEARCH_STALE_AFTER_SECONDS=3600
```

不要把 `.env`、`.env.local` 或任何 API Key 提交到 Git。

### 3. 启动基础设施和应用

首次部署推荐直接启动完整 Compose 服务：

```bash
docker compose --profile xhs up --build -d
```

服务地址：

- 前端：http://localhost:5173
- 后端健康检查：http://localhost:3000/api/health
- 小红书 MCP：http://localhost:18060/mcp

查看服务状态：

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f xiaohongshu-mcp
```

### 4. 可选：完成小红书登录

小红书是可选来源。未登录时研究会自动使用 Tavily 与高德继续；如果需要加入小红书来源：

1. 在 Agent 面板点击“显示二维码”。
2. 使用小红书 App 扫码登录。
3. 点击“我已扫码，重新检查”。
4. 登录成功后重新启动研究。

官方 MCP 的 Cookie 会保存到 `docker/xhs/data/cookies.json`，浏览器缓存和配置也会保存在 `docker/xhs/data/`。该目录已被 Git 忽略，不会提交 Cookie。

### 5. 验证部署

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/xhs/status
```

健康检查应返回 API 正常、数据库已配置；小红书状态接口应返回 MCP 已连接。登录完成后，`loginStatus` 应为 `logged_in`。

## 本地开发

启动 Postgres 和小红书 MCP：

```bash
docker compose --profile xhs up -d postgres xiaohongshu-mcp
```

安装依赖并启动前后端：

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

本机运行后端时，可复制本地配置覆盖 Docker 服务名：

```bash
cp .env.local.example .env.local
```

`.env.local` 会在 `.env` 之后加载，因此可以将数据库和 MCP 地址改为：

```ini
DATABASE_URL=postgresql://travel_assistant:password@localhost:5432/travel_assistant
XHS_MCP_URL=http://localhost:18060/mcp
```

如果出现 `EADDRINUSE: address already in use 0.0.0.0:3000`，说明已有后端进程占用了端口，可先检查并停止旧进程：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill <进程号>
```

## API 接口

- `GET /api/health`：返回后端状态和安全的配置存在性标记。
- `GET /api/xhs/status`：检查小红书 MCP 连接、登录状态和只读安全工具列表。
- `GET /api/xhs/login-qrcode`：获取小红书登录二维码。
- `GET /api/xhs/login-qrcode/image`：直接返回二维码图片。
- `POST /api/trips`：创建旅行计划。
- `GET /api/trips`：按创建时间倒序列出旅行计划。
- `GET /api/trips/:id`：获取单个旅行计划。
- `POST /api/trips/:id/research`：创建研究任务并立即返回 `running` run；任务继续在 API 进程内执行。
- `GET /api/trips/:id/research-runs/latest`：获取最新研究任务状态、轮次、工具摘要、缓存命中和降级信息。
- `GET /api/trips/:id/research-sources`：获取最新研究任务采集的来源。

## 质量检查

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 安全说明

- 不要提交 `.env`、API Key、账号密码或 Cookie。
- 小红书 MCP 在当前版本严格保持只读。
- 前端不直接访问任何第三方服务。
- 来源只保存受限的标题、摘要、URL 和 metadata，不保存完整第三方原始响应。
- 模型决策经过运行时校验，只能调用服务端注册的只读工具；第三方内容被视为不可信数据，不会扩大工具权限。
- 小红书请求有超时和单次重试；失败后本轮移除工具，并保留安全的降级摘要。
