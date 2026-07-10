# RESEARCH_RUN_EXECUTION

## 1. 任务类型

`plan`

本次任务实现旅行研究阶段的最小执行入口与状态模型，把现有 Trips、MCP 状态、安全边界和 provider 抽象层串成可启动、可查询、可失败降级的 Agent run 骨架。

## 2. 执行步骤

1. 梳理现有 `trips`、`database`、`mcp`、`providers` 与前端 Agent 进度面板契约，确认 research run 的最小状态字段。
2. 新增后端 research run 模块与数据表，至少包含 `agent_runs` 与 `research_sources` 的创建、查询和状态更新能力。
3. 实现 `POST /api/trips/:id/research`，基于 trip 创建 research run，并执行配置检查、MCP 登录状态检查和 provider 可用性预检。
4. 实现 run 查询接口，供前端获取最新 run 的阶段、状态、错误摘要和来源数量。
5. 前端 Agent 进度面板接入真实 API，支持创建 trip 后启动研究并轮询展示状态。
6. 增加后端与前端测试，覆盖 trip 不存在、provider 未配置、MCP 未登录和 run 状态展示等关键路径。
7. 更新 README、`Docs/guide/`、`Docs/technical/`、dailylog，并在实现影响架构边界时同步 `Docs/architecture/`。

## 3. 关键影响点

- `backend/database`：新增 research run 和 source 数据表初始化。
- `backend/research`：新增研究阶段执行入口、状态机和 API 契约。
- `backend/providers`：首次进入真实业务链路，错误需转为业务状态。
- `backend/mcp`：复用小红书 MCP 状态与登录检查，不执行写操作。
- `frontend/agent-run`：从静态占位变成真实启动与轮询 UI。
- `docs/tests`：补充状态模型、接口契约和验证覆盖。

## 4. 风险与依赖

- 本地可能缺少高德、Tavily 或 LLM API Key，首版必须优雅降级为 `blocked_config`，不能阻断后端启动。
- 小红书 MCP 可能未启动或未登录，run 应进入 `waiting_login` 或记录可恢复错误，而不是暴露底层异常。
- 本次不追求完整行程生成，重点是打通 research run 的持久化、状态可见性和失败边界。
