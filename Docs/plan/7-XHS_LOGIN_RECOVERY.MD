# XHS_LOGIN_RECOVERY

## 1. 任务类型

`plan`

本次任务完善小红书 MCP 登录恢复流程：当 research run 因未登录进入 `waiting_login` 时，前端能够展示登录二维码、提示用户扫码，并在登录完成后重新检查状态，保持现有只读安全边界。

## 2. 执行步骤

1. 梳理现有 XHS MCP 登录二维码、登录状态 API、research run 状态模型和前端 Agent 面板契约。
2. 在前端 Agent 面板中增加二维码展示、刷新二维码、登录状态提示和重新检查操作。
3. 将 `waiting_login` 状态与登录恢复流程关联；登录成功后允许用户重新执行 research 预检。
4. 保持后端 API 和 MCP 安全白名单边界，必要时补充稳定的错误和二维码响应处理。
5. 增加后端与前端测试，覆盖 MCP 未启动、未登录、二维码获取失败、登录成功和重新检查等场景。
6. 更新 README、`Docs/guide/`、`Docs/technical/` 和当天 dailylog。
7. 运行 `npm run lint`、`npm run typecheck`、`npm run test` 和 `npm run build`。

## 3. 关键影响点

- `backend/mcp`：复用现有只读登录二维码和状态接口，不新增写操作。
- `backend/research`：保持 `waiting_login` 状态契约，并支持恢复前置检查。
- `frontend/agent-run`：增加二维码和恢复操作的交互状态。
- `tests`：覆盖 MCP 不可用、二维码错误和登录恢复路径。
- `docs`：同步 API 使用方式、模块现状和开发记录。

## 4. 风险与依赖

- MCP 二维码可能过期或接口不可用，前端需要显示可恢复错误并支持刷新。
- 登录状态不会自动授予任何写权限，仍受 `SafetyService` 只读白名单和写操作黑名单约束。
- 首版采用手动重新检查或有限轮询，避免产生过多 MCP 请求。
