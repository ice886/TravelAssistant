# BACKEND&FRONTEND_ARCHITECTURE

## 1. 架构定位

TravelAssistant 采用标准前后端分离架构：
- `frontend/`：React + TypeScript 旅行工作台。
- `backend/`：Nest.js + TypeScript API 与 Agent 编排层，HTTP adapter 使用 Fastify。
- `postgres`：本地持久化。
- `xiaohongshu-mcp`：本地小红书 MCP 只读数据源。

浏览器只访问本项目后端，不直接访问 MCP、高德、Tavily 或 LLM。

## 2. 服务拓扑

```mermaid
flowchart LR
  User["User Browser"] --> Web["frontend / React"]
  Web --> Api["backend / Nest.js"]
  Api --> Db["Postgres"]
  Api --> Xhs["xiaohongshu-mcp"]
  Api --> Amap["Amap API"]
  Api --> Tavily["Tavily Search"]
  Api --> Llm["OpenAI-compatible LLM"]
```

本地 Compose 服务：
- `web`：Nginx 托管前端构建产物，并代理 `/api` 到后端。
- `api`：Nest.js + Fastify 服务，监听容器内 `3000`。
- `postgres`：Postgres 16。
- `xiaohongshu-mcp`：`xpzouying/xiaohongshu-mcp:latest`，通过 Compose profile `xhs` 按需启动。

## 3. 目录边界

```text
backend/
  src/
    modules/
      config/
      database/
      health/
      mcp/
      providers/
      safety/
      trips/

frontend/
  src/
    app/
    features/
      agent-run/
      itinerary-editor/
      sources/
      trip-form/
    api/
```

后续后端模块应继续放在 `backend/src/modules/` 下，例如：
- `planner/`

Provider 抽象统一放在 `backend/src/modules/providers/`：
- `AmapProviderService`：封装高德地点搜索、地理编码和路线距离估算。
- `TavilyProviderService`：封装 Tavily 网页搜索。
- `LlmProviderService`：封装 OpenAI-compatible chat completion 和 JSON completion。
- 后续 Agent、research 和 planner 模块只能依赖 provider services 的内部 DTO，不直接耦合第三方原始响应。

## 4. 安全边界

- API Key 只通过环境变量进入 `backend`。
- `frontend` 不保存、不读取、不透传明文密钥。
- 高德、Tavily 和 LLM 只允许由后端 provider services 调用；浏览器不直连第三方 API。
- Provider 调用失败统一归一化为内部错误，不向前端暴露密钥或完整请求头。
- 小红书 MCP 首版只允许只读工具。
- 后端 `SafetyModule` 对小红书 MCP 工具做白名单判断，默认允许 `check_login_status`、`get_login_qrcode`、`list_feeds`、`search_feeds`、`get_feed_detail`、`user_profile`。
- 后端明确禁止 `delete_cookies`、发布、评论、点赞和收藏类小红书 MCP 工具，即使被误加入环境变量白名单也不可调用。
- 健康检查只暴露配置项是否存在，不暴露配置值。
- 后端首版使用 Fastify adapter，避免引入当前不需要的 Express/Multer 文件上传链。
- `.env`、MCP cookies、运行缓存和图片目录不提交到仓库。

## 5. 运行边界

本地开发：
- 后端：`npm run dev:backend`
- 前端：`npm run dev:frontend`

容器运行：
- `docker compose up --build`

对外端口：
- 前端：`${WEB_PORT:-5173}`
- 后端：`${API_PORT:-3000}`
- Postgres：`5432`
- MCP：`18060`

本地后端直连 Docker MCP 时，`XHS_MCP_URL` 应使用宿主机可访问地址，例如 `http://localhost:18060/mcp`；Compose 内部服务间访问继续使用 `http://xiaohongshu-mcp:18060/mcp`。

Apple Silicon 说明：
- `xiaohongshu-mcp` 当前按 `linux/amd64` 运行。
- 默认 `docker compose up` 不启动 MCP；需要完整小红书能力时使用 `docker compose --profile xhs up --build`。
