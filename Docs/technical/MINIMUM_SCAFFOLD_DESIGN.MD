# MINIMUM_SCAFFOLD_DESIGN

## 1. 设计目标

本次脚手架设计只解决最小工程边界：
- 能明确区分 `backend` 与 `frontend`。
- 能通过统一脚本进行安装、构建、测试和检查。
- 能通过 Docker Compose 表达完整本地拓扑。
- 能为后续 Agent 规划流程保留模块入口。

## 2. Workspace 设计

根目录 `package.json` 使用 npm workspaces：
- `backend`
- `frontend`

统一脚本：
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## 3. 后端设计

后端首轮使用 Nest.js + Fastify，只实现两个模块：
- `config`：集中读取环境变量，并输出安全的公开配置状态。
- `health`：提供 `GET /api/health`。

健康检查响应不返回密钥值，只返回 `configured` 或 `missing`，避免 API Key 出现在日志、浏览器或 Agent run 记录中。

依赖注入使用显式 `@Inject(...)`，避免 `tsx` dev server 缺少 decorator metadata 时出现构造器依赖为 `undefined`。

## 4. 前端设计

前端首屏即工作台，包含：
- 顶部服务状态栏。
- 创建计划面板。
- Agent 运行进度面板。
- 来源证据区。
- 行程编辑区。

这些组件目前是静态骨架，后续通过 `frontend/src/api/client.ts` 接入后端。

## 5. Docker 设计

`web` 使用 Nginx 托管前端构建产物，并代理：
- 浏览器 `/api/*`
- Compose 内部 `http://api:3000/api/*`

`api` 只通过环境变量接收数据库、MCP 和外部服务配置。

`api` Docker 镜像使用 `npm ci`，确保容器构建和 `package-lock.json` 对齐。

`postgres` 使用 Docker volume `postgres-data`。

`xiaohongshu-mcp` 使用 Compose profile `xhs` 按需启动，并挂载：
- `./docker/xhs/data:/app/data`
- `./docker/xhs/images:/app/images`

## 6. 验收点

- `npm install` 能安装 workspace 依赖。
- `npm run lint` 能检查前后端。
- `npm run typecheck` 能检查前后端 TypeScript。
- `npm run test` 能运行前后端最小测试。
- `npm run build` 能构建后端和前端。
- `docker compose config` 能解析本地服务拓扑。
- `npm audit --audit-level=moderate` 无漏洞。
