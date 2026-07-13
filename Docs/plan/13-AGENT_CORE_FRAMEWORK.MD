# AGENT-FIRST BACKEND REFACTOR

## 1. 任务类型

`plan`

基于 `Docs/architecture/3-AGENT_FIRST_ARCHITECTURE.MD`，将后端从按功能模块组织重构为 `agent-core → agents → workflows → persistence → api → infrastructure → mcp` 的 Agent-First 分层架构。

## 2. 兼容边界

- 保持所有 API 路径、请求/响应格式和前端代码不变。
- 保持 `trips`、`agent_runs`、`research_sources`、`itinerary_versions` 数据库 schema 不变。
- 保持 Research 的预检、异步执行、单活 run、工具降级、来源去重、强制继续和进度持久化语义。
- 不引入新的外部依赖，不改变 Provider 的外部接口。

## 3. 执行步骤

1. 整理基础设施：迁移 config/database/providers 到 `infrastructure`，合并 safety 到 `mcp`，建立聚合模块并统一导出。
2. 创建 persistence 层：拆出 `TripRepository`、`AgentRunRepository`、`ResearchSourceRepository`、`ItineraryRepository`，迁移 SQL 和行映射。
3. 创建 agents 层：迁移 Research Agent/Tools，新增 `PlannerAgent`；扩展 `AgentRunner` 支持 `mode: "generate"` 单次结构化生成。
4. 创建 workflows 层：将 ResearchService 拆为 `ResearchWorkflow`，将 PlannerService 拆为 `PlanWorkflow`，保留业务生命周期和校验语义。
5. 创建 api 层：迁移所有 Controller，使其仅负责 HTTP 路由、参数接收和业务转发。
6. 重组 NestJS modules、清理旧目录、更新全部 import 路径和测试。
7. 更新架构/指南/技术文档与 daily log，运行 lint、typecheck、test、build，并完成 API 契约检查。

## 4. 关键影响点

- `agent-core`：增加 Agent `mode`，Runner 增加 generate 分支。
- `agents`：Research 领域逻辑集中到 Agent；Planner 的 LLM prompt、Schema、validator 迁移到 PlannerAgent。
- `workflows`：负责预检、Agent 生命周期、异步执行、进度回调和结果持久化。
- `persistence`：只负责数据库访问、SQL、CRUD 和行映射，不承载业务判断。
- `api`：集中所有 Controller，保持现有 endpoint 行为。
- `infrastructure`：集中配置、数据库和 Provider 基础设施。
- `mcp`：合并小红书安全白名单逻辑。

## 5. 风险与验证

- 大规模路径迁移需要避免循环依赖，并确保 NestJS provider 正确导出。
- Planner 的 generate 模式必须保持现有 itinerary Schema 校验、sourceId 过滤和错误行为。
- Research 拆分后必须保持单活 run、异步终态、进度持久化和工具失败降级。
- 保留并迁移现有测试，补充 Runner generate、Repository 映射和 Workflow 编排测试。
- 最终运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`；不执行真实外部 API 写操作。
