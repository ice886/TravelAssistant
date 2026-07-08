# PROJECT_STRUCTURE

## 1. 当前项目状态

当前仓库已建立最小前后端分离骨架：
- 根目录使用 npm workspaces 管理 `backend` 和 `frontend`。
- `backend` 是 Nest.js + Fastify 服务，当前包含 `config` 和 `health` 模块。
- `frontend` 是 Vite React 工作台，当前包含旅行表单、Agent 进度、来源证据和行程编辑区域。
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
- 使用 Fastify adapter。
- 根据 `AppConfigService` 配置监听端口。

`backend/src/modules/config/`
- `AppConfigService` 读取环境变量。
- `publicStatus` 仅返回配置是否存在，不返回密钥明文。

`backend/src/modules/health/`
- `GET /api/health` 返回服务状态和配置状态。
- 使用显式 `@Inject(...)`，确保 `tsx` dev 模式和 `tsc` build 模式都能稳定注入依赖。

## 4. 前端结构

`frontend/src/app/`
- `App.tsx` 是工作台首屏布局。
- `styles.css` 定义全局布局、面板和响应式样式。

`frontend/src/features/`
- `trip-form/`：创建旅行计划表单。
- `agent-run/`：Agent 阶段进度占位。
- `sources/`：来源证据区占位。
- `itinerary-editor/`：行程编辑区占位。

`frontend/src/api/client.ts`
- 封装基础 API 地址。
- 预留 `getHealth()` 用于后续状态栏接入。

## 5. 后续开发入口

建议下一步优先补充：
1. 后端 `mcp` 和 `safety` 模块，只读白名单先落地。
2. 后端 `trips` 数据模型和 Postgres 连接。
3. 前端状态栏调用 `/api/health`。
4. Agent run 状态 API 与前端轮询或 SSE。
