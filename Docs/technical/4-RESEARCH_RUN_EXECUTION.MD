# RESEARCH RUN EXECUTION

## 1. 设计目标

Research 模块将旅行需求转换为可追踪的证据来源：创建 run 后立即返回，由 API 进程内执行受约束的 ReAct 循环；LLM 只能选择服务端注册的只读工具。研究进度、工具安全摘要、缓存命中和降级原因持久化到 PostgreSQL，前端通过最新 run API 轮询。

当前执行不依赖外部队列。API 进程正常运行时任务会持续推进；进程重启后的自动恢复属于后续能力。

## 2. 模块职责

`backend/src/modules/research/`：

- `research.service.ts`：创建 run、后台启动、配置预检、来源持久化和终态处理。
- `research-agent.service.ts`：执行最多 8 轮的决策 → 工具 → 观察循环；去重调用和来源；不保存模型 Thought、prompt 或原始响应。
- `research-agent.validator.ts`：校验 decision 联合类型、工具白名单和每类工具参数，拒绝额外字段。
- `research-tools.service.ts`：将 `xhs_search`、`web_search`、`poi_search`、`get_weather`、`get_route` 映射到 MCP/provider。
- `research-cache.service.ts`：构建 SHA-256 cache key，读取有效缓存并 upsert 成功结果。
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

## 4. 执行与降级

`POST /api/trips/:id/research` 完成 trip 校验和 run 插入后立即返回 `running/created`。进程内任务按以下顺序执行：

1. 清理该 trip 的超龄 running run；已有有效 running run 时直接返回，数据库部分唯一索引保证单 trip 单活。
2. 计算 cache key 并查询未过期缓存。
3. 缓存命中时跳过所有配置、LLM、MCP 和 provider 调用，以单条 CTE 原子地物化新 source UUID 并完成当前 run。
4. 未命中时检查 LLM、Amap、Tavily 配置并读取 XHS 状态。
5. LLM key 或 model 缺失时进入 `blocked_config`；Amap、Tavily、XHS 属于来源工具，只要至少一类可用即可继续。
6. XHS 未配置、未登录、状态未知、未暴露允许的 `search_feeds` 或不可用时移除 `xhs_search` 并记录降级，不再进入 `waiting_login` 阻塞新 run；旧状态值保留作 API 兼容。
7. 每轮调用一个工具，将安全观察和新来源写入 run；重复的相同调用跳过。持久化回调失败会向上终止 run，不会被误判成工具降级。
8. 工具运行失败后从本 run 可用集合移除，继续选择备用工具。
9. 有来源且模型 `finish`，或达到轮次上限时完成；没有任何来源时失败。
10. 运行时工具失败或“已配置但 XHS 当前不可用”的降级结果不写缓存；配置层缺少可选 provider 的结果可缓存，并保存覆盖范围与降级摘要。

后台任务的未预期异常会尝试把 run 写为 `failed`；若数据库本身不可用，错误会写入服务日志。

## 5. 数据模型

`agent_runs` 在原字段上增加：

- `progress jsonb`：`currentRound`、`maxRounds`、`cacheHit`、`degraded`、`degradationReasons` 和 `toolCalls`。
- `toolCalls` 仅包含轮次、工具名、状态、输入摘要、观察摘要和新增来源数，不含模型推理。

`research_sources` 继续保存当前 run 的物化来源。缓存命中也会创建新 source ID，确保来源 API 和 Planner 的 `research_sources.id` 引用保持一致。

`research_cache`：

- `cache_key`：规范化目的地、去重排序兴趣、天数/日期、预算、旅客类型/人数、LLM 标识和 provider 配置 profile 组成的 v2 JSON 的 SHA-256。
- `sources`：缓存 envelope，包含不含 `id`、`runId` 和 raw response 的 source drafts，以及 `degraded`/`degradationReasons` 覆盖信息。
- `expires_at`：由 `RESEARCH_CACHE_TTL_SECONDS` 控制，默认 604800 秒（7 天）。

## 6. API 与前端

- `POST /api/trips/:id/research`：返回新建的 running run。
- `GET /api/trips/:id/research-runs/latest`：返回最新 run、来源数、检查和 `progress`。
- `GET /api/trips/:id/research-sources`：返回最新 run 当前已物化的来源。

前端把当前 run 提升到 `App`，Agent 面板在 running 时每 3 秒轮询；展示轮次与工具摘要、缓存命中和黄色降级提示。Sources 面板跟随 run ID 清空旧结果，仅在 running 时持续轮询，终态再读取一次。

Planner 查询最新“已完成且存在来源”的 run，避免刚创建的空 running run 遮蔽上一份可用证据。

## 7. 配置

- `RESEARCH_MAX_ROUNDS`：正整数，默认并上限为 8。
- `RESEARCH_CACHE_TTL_SECONDS`：正整数，默认 604800。
- `XHS_MCP_TIMEOUT_MS`：正数毫秒，默认 15000。
- `RESEARCH_STALE_AFTER_SECONDS`：同 trip running run 的超龄阈值，默认 3600；再次启动时将超龄 run 标为 failed。

## 8. 验证范围

测试覆盖决策校验、正常循环、重复调用、轮次上限、工具失败降级、无来源失败、XHS 安全归一化、缓存 key/读取/upsert、缓存物化、后台终态、高德天气与公交路线，以及前端 Research API 与展示标签。
