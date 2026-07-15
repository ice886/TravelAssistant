# ITINERARY_GENERATION

## 1. 模块职责

`backend/src/modules/planner/` 负责将旅行需求与最新 research run 的来源转换为结构化行程，并维护不可变版本。planner 只依赖内部 `TripsService`、`DatabaseService` 和 `LlmProviderService`，不直接访问第三方 API。

## 2. 数据模型

`itinerary_versions`：

- `id`：版本 UUID。
- `trip_id`：所属旅行计划。
- `research_run_id`：生成版本使用的研究任务；手动编辑版本允许为空。
- `version`：同一 trip 内递增版本号，与 `trip_id` 组成唯一约束。
- `source`：`generated` 或 `edited`。
- `content`：通过运行时校验后的 JSONB 行程。

行程内容包含标题、摘要、币种、总预算、逐日活动和旅行提示。活动包含时间、地点、交通、预算、说明和 `research_sources.id` 引用。

## 3. 生成链路

1. 校验 trip 存在。
2. 读取最新 `completed` 且存在来源的 agent run 对应 `research_sources`；无来源时返回 400。新的 running run 不会遮蔽上一份已完成证据。
3. 将受限来源摘要与 trip 输入传给 `completeJson()`，同时提供完整的嵌套 JSON Schema；Schema 明确逐日和活动的必填字段。
4. 服务端再次校验必填字段、数值、数组及来源 ID 白名单；缺失的非事实字段会安全归一化（`date: null`、`notes: []`、`transport: ""`、`sourceIds: []`），模型生成的未知来源 ID 会被剔除，禁止伪造引用入库且不阻断其余有效行程。
5. 请求错误、JSON 解析错误或运行时结构校验失败均共享最多两次生成尝试；第二次会追加严格补全 Schema 必填字段的纠正指令。两次均失败时不落库。
6. 校验成功后写入新版本；失败不会落库。

## 4. API

- `POST /api/trips/:id/itineraries/generate`
- `GET /api/trips/:id/itineraries/latest`
- `POST /api/trips/:id/itineraries`

保存编辑内容不会覆盖旧版本，而是创建新的 `edited` 版本。

Planner 只引用当前 Research run 已物化的 `research_sources.id`；Research run 不复用历史缓存来源。

## 5. 前端空状态与代理时限

- `GET /api/trips/:id/itineraries/latest` 在 trip 存在但尚无版本时返回 HTTP 200 和 `null`；前端 API client 同时兼容旧版 404，第三步展示“尚未生成”空状态，而不是读取错误。
- `POST /api/trips/:id/itineraries/generate` 当前是同步长请求。生产 Nginx 只对该动态路由设置 `proxy_read_timeout 620s`，覆盖 AgentRunner 最多两次、单次默认 300 秒的 LLM 请求及少量持久化开销。
- 若后续修改 LLM 单次时限或生成重试次数，必须同步核对该代理时限；若生成耗时继续增长，应将 Planner 升级为异步 run + 状态轮询，而不是无限延长代理连接。
