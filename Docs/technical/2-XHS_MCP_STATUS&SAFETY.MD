# XHS_MCP_STATUS&SAFETY

## 1. 设计目标

本次实现小红书 MCP 的最小状态闭环：
- 后端能检查 `XHS_MCP_URL` 是否可连接。
- 后端能发现 MCP 工具，并标记每个工具是否允许。
- 后端能通过只读工具检查登录状态和获取登录二维码。
- 前端状态栏展示小红书 MCP 的连接和登录状态。
- MCP 未配置、未启动或调用失败时不影响旅行计划创建。

## 2. 后端模块

`SafetyModule`
- 文件位置：`backend/src/modules/safety/`
- `SafetyService` 读取 `XHS_READONLY_TOOLS`。
- 默认只读白名单：`check_login_status`、`get_login_qrcode`、`list_feeds`、`search_feeds`、`get_feed_detail`、`user_profile`。
- 固定黑名单：`delete_cookies`、`publish_content`、`publish_with_video`、`post_comment_to_feed`、`reply_comment_in_feed`、`like_feed`、`favorite_feed`。
- 黑名单优先级高于环境变量白名单。

`McpModule`
- 文件位置：`backend/src/modules/mcp/`
- `McpHttpClient` 使用 JSON-RPC over Streamable HTTP 调用 MCP endpoint。
- 支持 `initialize`、`tools/list` 和 `tools/call`。
- 支持 JSON 响应和 `text/event-stream` 响应中的首个 `data:` JSON payload。
- `McpService` 负责把未配置、连接失败、工具调用失败归一化为状态响应。

## 3. API 契约

`GET /api/xhs/status`

响应字段：
- `configured`: boolean，是否配置 `XHS_MCP_URL`。
- `connectionStatus`: `not_configured | connected | unavailable`。
- `loginStatus`: `logged_in | logged_out | unknown`。
- `tools`: MCP 返回工具列表，并附带 `allowed`。
- `readonlyTools`: 当前只读白名单。
- `blockedTools`: 固定写操作黑名单。
- `errorMessage`: 失败摘要，不包含密钥。

`GET /api/xhs/login-qrcode`

响应字段：
- `configured`: boolean。
- `connectionStatus`: `not_configured | connected | unavailable`。
- `loginStatus`: `logged_in | logged_out | unknown`。
- `qrcode`: MCP 返回的二维码数据，保持 `unknown` 以兼容文本、URL 或结构化 payload。
- `qrcodeText`: MCP 返回的扫码提示文本。
- `imageMimeType`: 二维码图片 MIME 类型。
- `imageData`: 二维码图片 base64 数据。
- `imageDataUrl`: 可直接放入浏览器或 `<img src>` 的 data URL。
- `errorMessage`: 失败摘要。

`GET /api/xhs/login-qrcode/image`

- 直接返回二维码 PNG 图片，供浏览器打开或 `curl -o` 保存后扫码。
- 图片不可用时返回 `503` 和错误摘要。

## 4. 前端接入

`frontend/src/api/client.ts`
- 新增 `XhsStatusResponse`。
- 新增 `getXhsStatus()`。

`frontend/src/app/App.tsx`
- 初始化时并行请求 `GET /api/health` 和 `GET /api/xhs/status`。
- 小红书状态展示规则：
  - 未配置：`未配置`
  - 连接失败：`不可用`
  - 已连接且已登录：`已登录`
  - 已连接但未登录：`未登录`
  - 已连接但登录态未知：`已连接`

`frontend/src/features/agent-run/AgentRunPanel.tsx`
- research run 进入 `waiting_login` 时展示登录恢复区域。
- 支持获取/刷新二维码，并在用户扫码后重新检查 `GET /api/xhs/status`。
- 检查到已登录后重新启动该 trip 的 research preflight；恢复流程仍只调用只读 MCP 能力。

## 5. 验证

已通过：
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
