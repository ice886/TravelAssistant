# XHS_MCP_STATUS&SAFETY

## 1. 任务类型

`plan`

本次任务是接入小红书 MCP 的最小状态闭环，并先落地只读工具安全边界，为后续旅行研究阶段 `POST /api/trips/:id/research` 做准备。

## 2. 执行步骤

1. 梳理当前后端模块结构与环境变量配置，确认 `XHS_MCP_URL`、健康检查和模块注册方式。
2. 新增 `SafetyModule`，落地 MCP 工具只读白名单与写操作黑名单。
3. 新增 `McpModule`，封装小红书 MCP 连接、工具发现、工具调用和错误归一化。
4. 实现小红书状态 API：`GET /api/xhs/status` 与 `GET /api/xhs/login-qrcode`。
5. 将前端状态栏扩展为展示 MCP 连接状态和小红书登录状态。
6. 更新 `.env.example`、README、项目知识缓存文档和 daily log。
7. 运行 `npm run lint`、`npm run typecheck`、`npm run test` 和 `npm run build`。

## 3. 关键影响点

- `backend`：新增 `mcp`、`safety` 模块和小红书状态 API。
- `frontend`：状态栏从配置是否存在推进到 MCP 实际连接和登录状态。
- `security`：明确小红书 MCP 只读工具边界，禁止发布、点赞、收藏、评论、删除 cookies 等写操作。
- `docs`：同步架构、现状和技术设计文档，避免后续 session 误用过时边界。

## 4. 风险与依赖

- 本地默认 `docker compose up` 不启动 `xiaohongshu-mcp`，接口需要兼容未配置、未启动和连接失败状态。
- MCP 工具名称和返回格式以实际服务为准；首版实现需对未知返回做宽松归一化。
- 登录二维码返回格式可能包含文本、图片 URL 或结构化数据，前端展示需要保留可扩展字段。
