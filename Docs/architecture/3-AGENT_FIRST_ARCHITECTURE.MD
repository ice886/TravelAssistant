# 后端架构设计：Agent-First

## 设计理念

以 Agent 为中心组织后端。所有需要 LLM 参与的业务逻辑封装为 Agent，Workflow 编排 Agent 生命周期，Repository 负责持久化，Controller 是 HTTP 薄壳。

---

## 目录结构

```
backend/src/
├── main.ts
├── app.module.ts
└── modules/
    ├── agent-core/                    # Agent 框架层（运行时引擎）
    │   ├── agent-core.module.ts
    │   ├── agent-core.types.ts        # AgentContext, AgentResult, AgentDecision, AgentProgress
    │   ├── agent-core.errors.ts       # AgentExecutionError, ToolExecutionError
    │   ├── interfaces/
    │   │   └── tool.interface.ts      # BaseTool 接口
    │   ├── base-agent.ts              # BaseAgent 抽象类
    │   ├── agent-runner.service.ts    # ReAct 循环 + 单次生成模式
    │   ├── tool-registry.service.ts   # 声明式工具注册中心
    │   └── orchestrator.service.ts    # 多 Agent 流水线协调
    │
    ├── agents/                        # 所有 Agent 实现
    │   ├── agents.module.ts
    │   ├── research/
    │   │   ├── research.agent.ts
    │   │   ├── research.agent.types.ts
    │   │   ├── research.agent.validator.ts
    │   │   └── tools/
    │   │       ├── xhs-search.tool.ts
    │   │       ├── web-search.tool.ts
    │   │       ├── poi-search.tool.ts
    │   │       ├── get-weather.tool.ts
    │   │       └── get-route.tool.ts
    │   └── planner/
    │       ├── planner.agent.ts
    │       ├── planner.agent.types.ts
    │       └── planner.agent.validator.ts
    │
    ├── workflows/                     # 业务工作流编排
    │   ├── workflows.module.ts
    │   ├── research.workflow.ts       # 预检 → ResearchAgent → 持久化
    │   └── plan.workflow.ts           # Research → Planner 一键流水线
    │
    ├── persistence/                   # 数据访问层（一表一 Repository）
    │   ├── persistence.module.ts
    │   ├── trip.repository.ts
    │   ├── agent-run.repository.ts
    │   ├── research-source.repository.ts
    │   └── itinerary.repository.ts
    │
    ├── api/                           # HTTP 薄壳（Controller 只做参数解析+转发）
    │   ├── api.module.ts
    │   ├── trips.controller.ts
    │   ├── research.controller.ts
    │   ├── planner.controller.ts
    │   ├── health.controller.ts
    │   └── mcp.controller.ts
    │
    ├── infrastructure/                # 基础设施
    │   ├── infrastructure.module.ts
    │   ├── database/
    │   │   ├── database.module.ts
    │   │   └── database.service.ts
    │   ├── config/
    │   │   ├── app-config.module.ts
    │   │   └── app-config.service.ts
    │   └── providers/                 # 外部 API 客户端
    │       ├── providers.module.ts
    │       ├── llm.service.ts
    │       ├── amap.service.ts
    │       ├── tavily.service.ts
    │       ├── provider.types.ts
    │       └── provider-utils.ts
    │
    └── mcp/                           # 小红书 MCP 集成
        ├── mcp.module.ts
        ├── mcp.service.ts
        ├── mcp.types.ts
        ├── mcp-http-client.ts
        └── safety.service.ts
```

---

## 层次职责

| 层 | 职责 | 不做什么 |
|---|------|---------|
| **agent-core** | 提供 Agent 运行时：循环引擎、工具注册、编排器 | 不含业务逻辑 |
| **agents** | 实现具体 Agent：prompt、schema、validator、tools | 不调 DB，不管生命周期 |
| **workflows** | 编排 Agent 执行：预检、构建 context、触发 runner、处理结果 | 不写 SQL，不构建 prompt |
| **persistence** | 数据读写：CRUD、查询、事务 | 不含业务判断 |
| **api** | HTTP 适配：路由、参数校验、响应格式化 | 不含业务逻辑 |
| **infrastructure** | 基础设施：DB 连接、配置、外部 API 客户端 | 不含业务语义 |
| **mcp** | 小红书 MCP 协议封装 | 独立于 Agent 体系 |

---

## 数据流

### 研究流程
```
Controller.startResearch(tripId)
  → ResearchWorkflow.start(trip)
    → AgentRunRepository.create(run)
    → 异步: ResearchWorkflow.execute(runId, trip)
      → 配置预检（config + MCP 状态）
      → 确定 availableTools
      → AgentRunner.run(researchAgent, context)
        → LLM 决策 → Tool 执行 → 循环
        → onProgress 回调:
          → ResearchSourceRepository.insert(sources)
          → AgentRunRepository.updateProgress(progress)
      → AgentRunRepository.complete(result)
```

### 规划流程
```
Controller.generate(tripId)
  → PlanWorkflow.generate(trip)
    → ResearchSourceRepository.getLatest(tripId)
    → AgentRunner.run(plannerAgent, context)  // mode: "generate"
      → 单次 LLM 调用 → 生成行程
    → ItineraryRepository.insert(itinerary)
```

### 研究+规划 一键流水线
```
Controller.researchAndPlan(tripId)
  → PlanWorkflow.researchAndPlan(trip)
    → AgentOrchestrator.execute([
        { researchAgent, context },
        { plannerAgent, context(prev) }
      ])
    → 持久化结果
```

---

## Agent 模式

### ReAct 模式（Research Agent）
- `mode: "react"`
- 多轮循环：LLM 决策 → Tool 调用 → 观察 → 再决策
- 支持降级、去重、强制继续

### Generate 模式（Planner Agent）
- `mode: "generate"`
- 单次 LLM 调用：输入 context → 输出结构化结果
- AgentRunner 对 generate 模式只执行一次 completeJson

---

## Module 依赖图

```
AppModule
├── InfrastructureModule (Global: Config, Database, Providers)
├── McpModule
├── AgentCoreModule (ToolRegistry, AgentRunner, Orchestrator)
├── AgentsModule (Research/Planner Agent + Tools)
│   └── imports: AgentCoreModule, InfrastructureModule, McpModule
├── PersistenceModule (All Repositories)
│   └── imports: InfrastructureModule
├── WorkflowsModule
│   └── imports: AgentsModule, PersistenceModule, AgentCoreModule, McpModule
└── ApiModule (All Controllers)
    └── imports: WorkflowsModule, PersistenceModule
```

---

## 迁移来源

| 新文件 | 来源 |
|--------|------|
| `agents/research/research.agent.ts` | 现有 `research/research.agent.ts` |
| `agents/research/tools/*` | 现有 `research/tools/*` |
| `agents/planner/planner.agent.ts` | 从 `planner/planner.service.ts` 的 `generateContent()` 提取 |
| `workflows/research.workflow.ts` | 从 `research/research.service.ts` 提取执行逻辑 |
| `workflows/plan.workflow.ts` | 新增 |
| `persistence/agent-run.repository.ts` | 从 `research/research.service.ts` 提取 DB 操作 |
| `persistence/research-source.repository.ts` | 从 `research/research.service.ts` 提取 |
| `persistence/itinerary.repository.ts` | 从 `planner/planner.service.ts` 提取 DB 操作 |
| `persistence/trip.repository.ts` | 现有 `trips/trips.service.ts` 重命名 |
| `api/*.controller.ts` | 现有各 controller 移入 |
| `infrastructure/*` | 现有 config/database/providers 移入 |
| `mcp/*` | 现有 mcp/ + safety/ 合并 |

---

## API 契约

所有现有 API 端点保持不变：

```
GET    /api/health
GET    /api/xhs/status
GET    /api/xhs/login-qrcode
GET    /api/xhs/login-qrcode/image
POST   /api/trips
GET    /api/trips
GET    /api/trips/:id
POST   /api/trips/:tripId/research
GET    /api/trips/:tripId/research-runs/latest
GET    /api/trips/:tripId/research-sources
POST   /api/trips/:tripId/itineraries/generate
GET    /api/trips/:tripId/itineraries/latest
POST   /api/trips/:tripId/itineraries
```

请求/响应格式完全不变，前端无需修改。
