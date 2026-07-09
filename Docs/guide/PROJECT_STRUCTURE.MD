# PROJECT_STRUCTURE

## 1. 当前项目状态

当前仓库已建立最小前后端分离骨架，并完成旅行计划创建的首个业务闭环：
- 根目录使用 npm workspaces 管理 `backend` 和 `frontend`。
- `backend` 是 Nest.js + Fastify 服务，当前包含 `config`、`health`、`database` 和 `trips` 模块。
- `frontend` 是 Vite React 中文工作台，当前包含旅行表单、Agent 进度、来源证据和行程编辑区域；旅行表单已接入 `POST /api/trips`。
- `docker-compose.yml` 描述本地 `web`、`api`、`postgres` 三个默认服务，并通过 `xhs` profile 按需启动 `xiaohongshu-mcp`。

## 2. 根目录文件

- `package.json`：workspace 入口和统一脚本。
- `tsconfig.base.json`：前后端共享 TypeScript 基础配置。
- `.env.example`：本地运行所需环境变量占位。
- `docker-compose.yml`：本地容器编排。
- `README.md`：运行方式、架构和质量检查说明。

## 3. 后端结构

`backend/src/main.ts`
- 创建 Nest 应用。
- 设置 `/api` 全局前缀。
- 按 `WEB_ORIGIN` 启用 CORS，支持本地 Vite 前端直连后端。
- 使用 Fastify adapter。
- 根据 `AppConfigService` 配置监听端口。

`backend/src/modules/config/`
- `AppConfigService` 读取环境变量。
- `publicStatus` 仅返回配置是否存在，不返回密钥明文。
- `databaseUrl` 从 `DATABASE_URL` 读取，供数据库模块使用。

`backend/src/modules/health/`
- `GET /api/health` 返回服务状态和配置状态。
- 使用显式 `@Inject(...)`，确保 `tsx` dev 模式和 `tsc` build 模式都能稳定注入依赖。

`backend/src/modules/database/`
- 使用 `pg` 连接 Postgres。
- 应用启动时确保 `trips` 表存在。
- 对业务模块只暴露参数化 `query()` 方法。

`backend/src/modules/trips/`
- `POST /api/trips` 创建本地 draft 旅行计划。
- `GET /api/trips` 按创建时间倒序列出旅行计划。
- `GET /api/trips/:id` 查询单个旅行计划。
- 该模块不依赖 `xiaohongshu-mcp`；小红书能力从后续 research 阶段接入。

## 4. 前端结构

`frontend/src/app/`
- `App.tsx` 是工作台首屏布局。
- `App.tsx` 调用 `GET /api/health` 展示 API、Postgres 和 XHS 配置状态。
- `styles.css` 定义全局布局、面板和响应式样式。

`frontend/src/features/`
- `trip-form/`：创建旅行计划表单，提交后调用后端创建 draft trip。
- `agent-run/`：Agent 阶段进度占位。
- `sources/`：来源证据区占位。
- `itinerary-editor/`：行程编辑区占位。
- 当前前端用户可见文案默认使用中文；API 字段名和后端契约仍保持英文标识。

`frontend/src/api/client.ts`
- 封装基础 API 地址。
- 提供 `getHealth()` 和 `createTrip()`。

## 5. 后续开发入口

建议下一步优先补充：
1. 后端 `mcp` 和 `safety` 模块，只读白名单先落地。
2. `POST /api/trips/:id/research` 的 Agent run 状态模型与执行入口。
3. 前端 Agent run 状态轮询或 SSE。
4. 小红书登录状态与二维码入口。
