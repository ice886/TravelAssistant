# XHS_STATUS_REFRESH_AFTER_LOGIN

## 1. 现象

小红书扫码登录成功后，Agent 面板可以重新检查并恢复 research run，但页面右上角的小红书状态仍显示“未登录”，需要刷新整个页面才会更新。

## 2. 根因

`App` 只在首次挂载时调用一次 `GET /api/xhs/status`。登录恢复流程由 `AgentRunPanel` 内部执行，重新获取到的状态没有回传给 `App`，因此顶部状态栏仍使用旧状态。

## 3. 修复动作

- 为 `AgentRunPanel` 增加 `onXhsStatusChange` 回调。
- 获取二维码或重新检查登录状态后，将最新状态同步给 `App`。
- `App` 接收到状态后更新右上角小红书状态并清除旧错误。
- 保持现有 MCP 只读能力和 API 契约不变。

## 4. 验证结果

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `git diff --check`
