# TRAVEL_AGENT_ARCHITECTURE

## 1. 系统目标与首版范围

本项目首版是个人本地版全栈 Agent 旅行助手，目标是把小红书真实旅行内容、地图路线信息、网页实时信息和大模型规划能力整合为一个可编辑行程工作台。

首版技术栈：
- 前端：React + TypeScript
- 后端：Nest.js + TypeScript
- 数据库：Postgres
- 本地编排：Docker Compose
- 小红书数据源：`xpzouying/xiaohongshu-mcp`
- 地图服务：高德地图 API
- 网页搜索：Tavily Search
- 大模型：多模型 LLM Provider 抽象，首版支持 OpenAI-compatible API

首版核心能力：
- 用户创建旅行计划，输入目的地、日期或天数、兴趣偏好、预算档位、同行人类型和人数。
- Agent 使用小红书 MCP 搜索旅行灵感、读取笔记详情和用户主页信息。
- Agent 使用高德地图补全地点、坐标、地址和路线通勤信息。
- Agent 使用 Tavily Search 补充开放时间、门票价格、预约要求、季节性提醒等网页信息。
- Agent 生成包含来源证据、预算明细、交通路线和推荐理由的可编辑行程。
- 所有小红书账号能力严格只读，不允许发布、评论、点赞、收藏或删除 cookies。

非首版范围：
- 不做公开 SaaS、多用户权限、团队协作或云端部署。
- 不做小红书内容发布、自动运营、评论互动或账号增长功能。
- 不做支付、订单、酒店/机票实时预订。
- 不保存任何明文 API Key、账号密码、cookies 到仓库。

## 2. 服务拓扑与职责边界

Docker Compose 首版服务：
- `web`：React 前端工作台，负责表单、运行进度、证据卡、行程编辑和状态展示。
- `api`：Nest.js 后端，负责 Agent 编排、MCP 调用、外部 API 调用、持久化和安全边界。
- `postgres`：保存旅行计划、研究来源、地点来源、网页来源、行程版本和 Agent 运行记录。
- `xiaohongshu-mcp`：官方 Docker 镜像 `xpzouying/xiaohongshu-mcp`，提供小红书 MCP 工具。

推荐 Compose 网络内地址：
- 前端访问后端：`http://api:3000`
- 后端访问 Postgres：`postgres:5432`
- 后端访问 MCP：`http://xiaohongshu-mcp:18060/mcp`

`xiaohongshu-mcp` 挂载约定：
- `./docker/xhs/data:/app/data`：持久化 cookies、浏览器数据和运行缓存。
- `./docker/xhs/images:/app/images`：保留官方发布图片目录约定，但首版不使用发布能力。

职责边界：
- React 只调用本项目后端 API，不直接调用 MCP、高德、Tavily 或 LLM。
- Nest.js 是唯一外部服务访问层，统一处理重试、错误、日志、密钥读取和安全限制。
- Postgres 保存业务数据和可复现的 Agent 运行摘要，不保存明文密钥。
- xiaohongshu-mcp 只作为本地只读数据工具，登录二维码和登录状态通过后端转发给前端。

## 3. Agent 规划流程

用户输入：
- 目的地：必填，例如 `杭州`、`成都`。
- 出行日期或天数：必填，支持明确日期范围或天数。
- 兴趣偏好：必填，例如 `亲子`、`美食`、`徒步`、`拍照`、`博物馆`。
- 预算档位：必填，例如 `经济`、`舒适`、`高预算`。
- 同行人：必填，例如 `单人`、`情侣`、`朋友`、`家庭`，并包含人数。

执行阶段：
1. 创建 `trip` 和 `agent_run`，记录用户输入和初始状态。
2. 检查小红书 MCP 登录状态；未登录时返回二维码入口，暂停研究流程。
3. 生成小红书搜索关键词，例如 `目的地 + 偏好 + 行程`、`目的地 + 美食`、`目的地 + 避坑`。
4. 调用只读 MCP 工具 `search_feeds` 获取候选笔记列表。
5. 对高价值候选调用 `get_feed_detail`，抽取标题、作者、正文摘要、图片、互动数据、评论摘要和 xsec token。
6. 将小红书来源写入 `research_sources`。
7. 从小红书内容和用户偏好中抽取候选地点、餐饮、区域和体验。
8. 调用高德地图 API 补全 POI、坐标、地址、类型和候选路线。
9. 调用 Tavily Search 查询开放时间、门票、预约、注意事项、季节性信息。
10. 调用 LLM 生成结构化行程 JSON，要求每个行程项关联小红书、地图或网页来源。
11. 保存 `itinerary_versions`，更新 `agent_run` 状态并返回前端展示。

降级策略：
- MCP 未登录：不生成行程，提示扫码登录。
- 小红书无搜索结果：允许用高德和 Tavily 生成弱证据行程，但 UI 标注“小红书来源不足”。
- 高德无地点结果：保留小红书推荐，但交通字段标注“待确认”。
- Tavily 无结果：保留地图和小红书信息，开放时间/门票字段标注“待确认”。
- LLM 输出无法解析：后端要求模型重试一次；仍失败则保存失败状态和错误摘要。

## 4. Nest.js 模块划分

`McpModule`
- 连接 `XHS_MCP_URL` 指向的 Streamable HTTP MCP 服务。
- 封装工具发现和工具调用。
- 只暴露只读工具：
  - `check_login_status`
  - `get_login_qrcode`
  - `list_feeds`
  - `search_feeds`
  - `get_feed_detail`
  - `user_profile`
- 禁止 destructive 工具：
  - `delete_cookies`
  - `publish_content`
  - `publish_with_video`
  - `post_comment_to_feed`
  - `reply_comment_in_feed`
  - `like_feed`
  - `favorite_feed`

`LlmModule`
- 提供统一 `LlmProvider` 接口。
- 首版实现 OpenAI-compatible provider，通过环境变量配置 base URL、API Key 和 model。
- 支持结构化输出，行程生成必须返回可校验 JSON。

`MapModule`
- 封装高德地图 API。
- 能力包括地点检索、地理编码、逆地理编码和路线规划。
- 对外返回统一 `PlaceSource` 和 `TransitEstimate`，避免业务层依赖高德原始字段。

`SearchModule`
- 封装 Tavily Search。
- 用于补充开放时间、门票、预约、注意事项、官方页面和近期网页信息。
- 对外返回统一 `WebSource`，包含 URL、标题、摘要、检索 query 和抓取时间。

`TripPlannerModule`
- 编排完整 Agent 流程。
- 管理 trip 创建、研究、来源保存、行程生成、版本保存和状态更新。
- 负责把小红书来源、地图来源、网页来源组织成 LLM 上下文。

`SafetyModule`
- 维护 MCP 工具白名单和写操作黑名单。
- 在后端 API、Agent tool router、MCP client 三层都校验工具权限。
- 记录被拒绝的工具调用摘要，便于审计。

## 5. Postgres 核心数据模型

`trips`
- `id`
- `destination`
- `start_date`
- `end_date`
- `days`
- `interests`
- `budget_level`
- `traveler_type`
- `traveler_count`
- `status`
- `created_at`
- `updated_at`

`research_sources`
- `id`
- `trip_id`
- `feed_id`
- `xsec_token`
- `title`
- `author_name`
- `author_id`
- `summary`
- `image_urls`
- `engagement`
- `raw_payload`
- `created_at`

`place_sources`
- `id`
- `trip_id`
- `amap_poi_id`
- `name`
- `address`
- `location`
- `poi_type`
- `raw_payload`
- `created_at`

`web_sources`
- `id`
- `trip_id`
- `url`
- `title`
- `summary`
- `query`
- `raw_payload`
- `created_at`

`itinerary_versions`
- `id`
- `trip_id`
- `version`
- `itinerary_json`
- `budget_estimate_json`
- `transit_estimate_json`
- `source_ids`
- `created_at`

`agent_runs`
- `id`
- `trip_id`
- `status`
- `steps`
- `tool_call_summary`
- `error_message`
- `started_at`
- `finished_at`

## 6. REST API 草案

健康与配置：
- `GET /api/health`：检查后端、数据库和关键配置状态。
- `GET /api/xhs/status`：返回小红书 MCP 连接状态和登录状态。
- `GET /api/xhs/login-qrcode`：返回 MCP 登录二维码数据。

旅行计划：
- `POST /api/trips`：创建旅行计划。
- `GET /api/trips`：列出本地旅行计划。
- `GET /api/trips/:id`：获取旅行计划、来源、最新行程和运行状态。
- `PATCH /api/trips/:id`：更新基础输入信息。

Agent 流程：
- `POST /api/trips/:id/research`：启动或重跑研究阶段。
- `POST /api/trips/:id/generate-itinerary`：基于已保存来源生成行程版本。
- `GET /api/trips/:id/runs/:runId`：查询 Agent run 状态和步骤。

行程编辑：
- `PATCH /api/trips/:id/itinerary`：保存用户编辑后的行程版本。

## 7. 前端工作台设计

首屏就是旅行工作台，不做 landing page。

主要区域：
- 顶部状态栏：后端状态、数据库状态、MCP 连接状态、小红书登录状态。
- 创建计划面板：目的地、日期或天数、兴趣偏好、预算档位、同行人。
- Agent 进度区：展示当前阶段、工具调用摘要和失败提示。
- 来源证据区：小红书笔记卡、地图地点卡、网页来源卡。
- 行程编辑区：按天展示路线、地点、餐饮、交通、预算和来源引用。
- 风险提示：小红书只读、外部价格和开放时间需出行前复核。

交互原则：
- 未登录小红书时展示二维码入口，不允许启动小红书研究。
- 数据源部分失败时仍展示可用结果，并明确标注缺失项。
- 行程中的每个推荐点必须能追溯到至少一个来源或标注为模型建议。

## 8. 环境变量

基础：
- `NODE_ENV`
- `API_PORT`
- `WEB_PORT`
- `DATABASE_URL`

小红书 MCP：
- `XHS_MCP_URL`
- `XHS_READONLY_TOOLS`

LLM：
- `LLM_PROVIDER`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

高德地图：
- `AMAP_API_KEY`

Tavily：
- `TAVILY_API_KEY`

安全约定：
- `.env` 不提交。
- `.env.example` 只放变量名和占位说明。
- API Key 不写入日志、prompt、数据库或 Agent run 明细。
- MCP cookies 由 `xiaohongshu-mcp` 容器持久化在本地挂载目录，仓库需要忽略该目录。

## 9. 测试与验收清单

单元测试：
- MCP 白名单允许只读工具，拒绝所有写操作工具。
- LLM provider 配置缺失时报清晰错误。
- 高德和 Tavily client 对失败响应、空结果、限流响应做可控错误处理。
- 行程 JSON schema 校验能拦截无效模型输出。

集成测试：
- 使用 mock MCP server 模拟登录状态、搜索列表和笔记详情。
- 使用 mock 高德和 Tavily 响应验证来源能写入数据库。
- 使用测试 Postgres 验证 trip、source、itinerary、agent_run 的完整生命周期。

前端测试：
- 创建旅行计划表单必填校验。
- MCP 未登录时展示二维码状态。
- Agent 运行中、成功、失败、部分数据源失败状态展示。
- 行程编辑保存后生成新版本。

手动验收：
- `docker compose config` 能通过。
- `docker compose up` 后能访问前端和 API health。
- 小红书 MCP 能显示登录状态或二维码。
- 使用 mock 或真实只读 MCP 数据能生成一份多日行程。
- 生成结果包含小红书来源、高德地点/路线、Tavily 网页补充和预算明细。
- 尝试调用小红书写操作时被后端拒绝。

## 10. 后续执行顺序

正式编码前按项目协议先创建 `Docs/plan/` 下的实现计划文档。

建议实现顺序：
1. 初始化 monorepo、TypeScript、lint、test、Docker Compose。
2. 建立 Nest.js API、Postgres 连接和基础 health check。
3. 实现 MCP client 和只读安全白名单。
4. 实现高德、Tavily、LLM provider 抽象。
5. 实现 trip、source、itinerary、agent_run 数据模型。
6. 实现 TripPlanner 编排流程。
7. 实现 React 工作台。
8. 补齐测试、README、`.env.example` 和文档。

## 11. BACKEND_FRONTEND_SCAFFOLD 实施计划

本节记录本 session 已确认的首轮落地计划。用户确认方向为标准 `backend/` 与 `frontend/` 分层架构。

任务类型：`plan`

目标：
- 建立 TravelAssistant 的最小全栈项目骨架。
- 明确前端、后端、数据库、小红书 MCP 和外部 API 的职责边界。
- 为后续 Agent 编排、来源证据、行程编辑和只读安全策略预留模块入口。

实施步骤：
1. 创建根目录 npm workspace，包含 `backend` 和 `frontend` 两个 package。
2. 创建 `backend/` Nest.js 最小应用，包含配置读取、健康检查和后续模块边界。
3. 创建 `frontend/` React + TypeScript 工作台壳，包含旅行表单、Agent 进度、来源证据和行程编辑区域。
4. 增加 Docker Compose、后端 Dockerfile、前端 Dockerfile 和 `.env.example`。
5. 同步更新 README、`Docs/architecture/`、`Docs/guide/` 和 `Docs/dailylog/`。
6. 运行基础校验，确认 TypeScript 项目结构和脚本可被工具链识别。

关键影响点：
- `backend`：后端服务边界、配置入口、健康检查 API。
- `frontend`：旅行工作台首屏和 API 访问入口。
- `docker`：本地服务拓扑与 xiaohongshu-mcp 挂载约定。
- `docs`：架构缓存、项目现状缓存、运行说明和 daily log。

风险与依赖：
- 首轮不连接真实小红书 MCP、高德、Tavily 或 LLM，仅保留配置和模块边界。
- 后续接入真实外部服务时需要补充 API client、错误处理、schema 校验和集成测试。
