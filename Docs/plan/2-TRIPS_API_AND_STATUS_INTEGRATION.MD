# TRIPS_API_AND_STATUS_INTEGRATION

## 1. 任务类型

`plan`

本次任务是把当前静态旅行工作台推进到最小可用业务闭环：后端可创建和查询旅行计划，前端表单可调用真实 API，状态栏可展示后端健康状态。

## 2. 执行步骤

1. 梳理当前未提交变更范围，避免覆盖既有文档、Dockerfile 和 README 调整。
2. 接入 Postgres 基础能力，在后端建立数据库连接与初始化入口。
3. 实现 `TripsModule` 最小 REST API，支持创建、列表和详情查询。
4. 前端旅行表单接入 `POST /api/trips`，展示创建结果和错误状态。
5. 前端状态栏接入 `GET /api/health`，展示后端与关键配置状态。
6. 更新 README、项目知识缓存文档和 daily log。
7. 运行 `npm run lint`、`npm run typecheck`、`npm run test`，按需运行 `npm run build`。

## 3. 关键影响点

- `backend`：新增数据库连接、旅行计划模块和 API 契约。
- `frontend`：表单提交由本地静态状态改为真实 API 调用；状态栏读取后端健康检查。
- `database`：首批落地 `trips` 数据表，后续研究来源和行程版本可继续扩展。
- `docs`：更新 README、guide/technical 文档和当天 daily log。

## 4. 风险与依赖

- 当前项目尚未引入 ORM。为控制首轮改动范围，本次优先使用 `pg` 直接连接 Postgres，并封装在后端数据库模块内，避免前端和业务层依赖底层实现。
- `POST /api/trips` 不依赖 `xiaohongshu-mcp`。小红书 MCP 从后续 `research` 阶段介入。
- 本地运行该 API 需要 `DATABASE_URL` 指向可用 Postgres；Docker Compose 已提供默认配置。
