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
3. 将受限来源摘要与 trip 输入传给 `completeJson()`，同时提供 JSON Schema。
4. 服务端再次校验必填字段、数值、数组及来源 ID 白名单；模型生成的未知来源 ID 会被剔除，禁止伪造引用入库且不阻断其余有效行程。
5. 校验成功后写入新版本；失败不会落库。

## 4. API

- `POST /api/trips/:id/itineraries/generate`
- `GET /api/trips/:id/itineraries/latest`
- `POST /api/trips/:id/itineraries`

保存编辑内容不会覆盖旧版本，而是创建新的 `edited` 版本。

Planner 只引用当前 Research run 已物化的 `research_sources.id`；Research run 不复用历史缓存来源。
