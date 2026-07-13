# RESEARCH RUN EXECUTION

## 1. 设计目标

Research 模块将旅行需求转换为可追踪的证据来源：创建 run 后立即返回，由 API 进程内执行受约束的 ReAct 循环；LLM 只能选择服务端注册的只读工具。研究进度、工具安全摘要和降级原因持久化到 PostgreSQL，前端通过最新 run API 轮询。

当前执行不依赖外部队列。API 进程正常运行时任务会持续推进；进程重启后的自动恢复属于后续能力。

## 2. 模块职责

`backend/src/modules/agent-core/`、`backend/src/modules/agents/`、`backend/src/modules/workflows/` 与 `backend/src/modules/persistence/`：

- `research.workflow.ts`：创建 run、后台启动、配置预检、Agent 执行和终态处理。
- `agent-runner.service.ts`：执行通用 Agent 的最多 8 轮决策 → 工具 → 观察循环，处理重复调用、工具失败降级、进度回调和 finish/轮次上限。
- `research.agent.ts`：实现 Research prompt、决策 Schema、领域校验和来源 artifacts 清洗去重；不保存模型 Thought、prompt 或原始响应。
- `research-agent.validator.ts`：校验 decision 联合类型、工具白名单和每类工具参数，拒绝额外字段。
- `agents/research/tools/*.tool.ts`：将 `xhs_search`、`web_search`、`poi_search`、`get_weather`、`get_route` 分别映射到 MCP/provider。
- `agents/research/research-tool.registrar.ts`：在模块初始化时将 Research 工具注册到 `ToolRegistry`。
- `persistence/agent-run.repository.ts`、`research-source.repository.ts`：负责 run/source SQL 和行映射。
- `research.types.ts`、`research-agent.types.ts`：API、持久化、工具与进度类型。

## 3. 工具契约与安全边界

允许工具：

| 工具 | 输入 | 实现 |
|---|---|---|
| `xhs_search` | `{ query }` | 小红书 MCP `search_feeds`，仍经过 Safety 白名单 |
| `web_search` | `{ query }` | Tavily advanced search |
| `poi_search` | `{ keyword, city? }` | 高德 POI 文本搜索 |
| `get_weather` | `{ city }` | 城市名解析为 adcode 后调用高德实时天气 + 预报 |
| `get_route` | `{ origin, destination, mode, city? }` | 先地理编码，再查询步行/驾车/公交路线 |

模型返回 `call_tool` 或 `finish`。JSON parse 成功不代表可信，服务端仍会执行严格运行时校验；不可用工具、非法枚举、空字符串和额外字段都会被拒绝。第三方标题与摘要只以截断后的不可信数据形式进入下一轮 prompt，不执行其中的指令。

每个工具最多持久化 5 条来源。标题限制 300 字符，摘要限制 2000 字符；XHS `xsecToken`、provider raw response、API key、prompt 和 Thought 均不写入数据库或前端。

通用 `AgentResult.artifacts` 不携带领域假设；Research 将其解释为 `ResearchSourceDraft[]`，并在 `ResearchAgentContext` 中维护本轮来源去重键。

## 4. 执行与降级

`POST /api/trips/:id/research` 完成 trip 校验和 run 插入后立即返回 `running/created`。进程内任务按以下顺序执行：

1. 清理该 trip 的超龄 running run；已有有效 running run 时直接返回，数据库部分唯一索引保证单 trip 单活。
2. 每次新 run 都检查 LLM、Amap、Tavily 配置并读取 XHS 状态，不读取历史研究缓存。
3. LLM key 或 model 缺失时进入 `blocked_config`；Amap、Tavily、XHS 属于来源工具，只要至少一类可用即可继续。
4. XHS 未配置、未登录、状态未知、未暴露允许的 `search_feeds` 或不可用时移除 `xhs_search` 并记录降级，不再进入 `waiting_login` 阻塞新 run；旧状态值保留作 API 兼容。
5. 每轮调用一个工具，将安全观察和新来源写入 run；重复的相同调用跳过。持久化回调失败会向上终止 run，不会被误判成工具降级。
6. 工具运行失败后从本 run 可用集合移除，继续选择备用工具。
7. 有来源且模型 `finish`，或达到轮次上限时完成；没有任何来源时失败。

后台任务的未预期异常会尝试把 run 写为 `failed`；若数据库本身不可用，错误会写入服务日志。

## 5. 数据模型

`agent_runs` 在原字段上增加：

- `progress jsonb`：`currentRound`、`maxRounds`、`degraded`、`degradationReasons` 和 `toolCalls`。
- `toolCalls` 仅包含轮次、工具名、状态、输入摘要、观察摘要和新增来源数，不含模型推理。

`research_sources` 保存当前 run 直接采集并物化的来源；每次 run 都拥有自己的来源记录。

## 6. API 与前端

- `POST /api/trips/:id/research`：返回新建的 running run。
- `GET /api/trips/:id/research-runs/latest`：返回最新 run、来源数、检查和 `progress`。
- `GET /api/trips/:id/research-sources`：返回最新 run 当前已物化的来源。

前端把当前 run 提升到 `App`，Agent 面板在 running 时每 3 秒轮询；展示轮次与工具摘要和黄色降级提示。Sources 面板跟随 run ID 清空旧结果，仅在 running 时持续轮询，终态再读取一次。

Planner 查询最新“已完成且存在来源”的 run，避免刚创建的空 running run 遮蔽上一份可用证据。

## 7. 配置

- `RESEARCH_MAX_ROUNDS`：正整数，默认并上限为 8。
- `XHS_MCP_TIMEOUT_MS`：正数毫秒，默认 15000。
- `RESEARCH_STALE_AFTER_SECONDS`：同 trip running run 的超龄阈值，默认 3600；再次启动时将超龄 run 标为 failed。

## 8. 验证范围

测试覆盖决策校验、正常循环、重复调用、轮次上限、工具失败降级、无来源失败、XHS 安全归一化、后台终态、高德天气与公交路线，以及前端 Research API 与展示状态。
