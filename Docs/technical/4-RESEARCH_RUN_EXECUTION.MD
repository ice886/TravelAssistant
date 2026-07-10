# RESEARCH_RUN_EXECUTION

## 1. 设计目标

本次实现研究阶段的最小 Agent run 闭环：
- 用户创建 trip 后，可以从前端启动 research run。
- 后端持久化 run 状态，并提供最新 run 查询接口。
- 首版只执行安全预检：provider 配置检查与小红书 MCP 登录状态检查。
- 未配置外部 provider 或 MCP 未登录时，run 进入可解释的暂停状态，不触发真实外部检索。

## 2. 后端模块

`backend/src/modules/research/`
- `research.module.ts`：组合 `DatabaseModule`、`TripsModule`、`AppConfigModule` 和 `McpModule`。
- `research.controller.ts`：暴露 trip 下的 research run API。
- `research.service.ts`：创建 run、执行预检、更新状态、查询最新 run。
- `research.types.ts`：定义 run 状态、阶段、检查结果和行转换类型。

`TripsModule`
- 导出 `TripsService`，供 research 模块复用 trip UUID 和 404 校验。

`DatabaseService`
- 应用启动时确保 `agent_runs` 和 `research_sources` 表存在。

## 3. 数据表

`agent_runs`
- `id uuid PRIMARY KEY`
- `trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE`
- `status text NOT NULL`
- `stage text NOT NULL`
- `summary text`
- `error_message text`
- `checks jsonb NOT NULL DEFAULT '{}'::jsonb`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `completed_at timestamptz`

`research_sources`
- `id uuid PRIMARY KEY`
- `run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE`
- `provider text NOT NULL`
- `title text NOT NULL`
- `url text`
- `snippet text`
- `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`
- `created_at timestamptz NOT NULL DEFAULT now()`

## 4. 状态模型

`AgentRunStatus`
- `running`：run 已创建并正在执行。
- `completed`：预检完成。
- `blocked_config`：缺少 LLM、高德或 Tavily 必要配置。
- `waiting_login`：小红书 MCP 未登录或暂不可用，需要用户处理。
- `failed`：预留给后续不可恢复异常。

`AgentRunStage`
- `created`
- `config_check`
- `xhs_login`
- `source_research`
- `completed`

`checks`
- `llm`
- `amap`
- `tavily`
- `xiaohongshu`

每个 check 包含：
- `status`: `passed | missing | waiting | unavailable | skipped`
- `message`: 面向前端展示的安全摘要，不包含密钥。

## 5. API 契约

`POST /api/trips/:id/research`
- 校验 trip 是否存在。
- 创建 `agent_runs` 记录。
- 检查 `LLM_API_KEY`、`AMAP_API_KEY`、`TAVILY_API_KEY` 是否配置。
- 配置缺失时返回 `blocked_config`。
- 配置完整时调用 `McpService.getXhsStatus()`。
- MCP 已连接但未登录，或服务不可用时返回 `waiting_login`。
- 预检通过时返回 `completed`。

`GET /api/trips/:id/research-runs/latest`
- 校验 trip 是否存在。
- 返回该 trip 最新 run。
- 同时返回 `research_sources` 聚合后的 `sourceCount`。
- 无 run 时返回 404。

## 6. 前端接入

`frontend/src/api/client.ts`
- 新增 `AgentRun` 类型。
- 新增 `startResearch(tripId)`。
- 新增 `getLatestResearchRun(tripId)`。

`frontend/src/app/App.tsx`
- 持有当前创建成功的 trip。
- 将 trip 传给 Agent run 面板。

`frontend/src/features/trip-form/TripForm.tsx`
- 成功创建 trip 后通过 `onTripCreated` 回传。

`frontend/src/features/agent-run/AgentRunPanel.tsx`
- 有当前 trip 后允许启动研究。
- 展示 run 状态、summary、errorMessage、check 明细和 source count。
- `running` 状态下轮询最新 run。

## 7. 验证

已通过：
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
