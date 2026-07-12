# ITINERARY_GENERATION

## 1. 任务类型

`plan`

本次任务在真实来源采集闭环之上生成首版可编辑行程：使用最新 research run 的小红书、高德和 Tavily 来源，通过 LLM JSON completion 生成结构化每日计划，持久化行程版本，并在前端提供查询、展示和编辑保存能力。

## 2. 执行步骤

1. 定义 itinerary 领域模型与严格 JSON Schema，覆盖每日安排、地点、交通、预算、提示和来源引用。
2. 新增 `itinerary_versions` 持久化表及 planner service，读取 trip 与最新 research sources，调用 LLM 生成并校验行程。
3. 新增生成、获取最新版本和保存编辑版本 API，保存时创建递增版本而非覆盖历史记录。
4. 将前端行程占位区替换为真实行程面板，支持生成、刷新、字段编辑和保存新版本。
5. 增加后端与前端测试，覆盖模型输出校验、无来源阻断、版本读写和 API 客户端行为。
6. 更新 README、architecture/guide/technical 知识缓存与 daily log。
7. 运行 `npm run lint`、`npm run typecheck`、`npm run test` 和 `npm run build`。

## 3. 关键影响点

- `backend/planner`：新增行程生成编排、Schema 校验和版本 API。
- `backend/providers`：复用 `LlmProviderService.completeJson()`，不暴露第三方原始响应。
- `backend/database`：新增 `itinerary_versions`，行程内容使用受校验的 JSONB 保存。
- `backend/research`：以最新已采集来源作为生成证据，不重复调用来源 provider。
- `frontend/itinerary-editor`：展示生成状态、每日安排、预算、来源引用并支持编辑保存。
- `tests/docs`：同步接口契约、数据模型、使用方式和验证结果。

## 4. API 与版本边界

- `POST /api/trips/:id/itineraries/generate`：基于最新研究来源生成新版本。
- `GET /api/trips/:id/itineraries/latest`：读取最新行程版本。
- `POST /api/trips/:id/itineraries`：保存用户编辑后的内容并创建新版本。
- 每次生成或保存均创建不可变版本；最新版本按 `version` 降序读取。
- 来源引用保存 `research_sources.id`，避免只依赖易变化的标题或 URL。

# 5. 风险与依赖

- LLM 可能返回缺字段或类型错误；后端必须做运行时校验，失败时返回明确错误，不写入数据库。
- 生成依赖最新 research run 至少存在一条来源；无来源时阻止调用 LLM。
- 首版路线和预算是模型辅助草稿，不宣称实时价格或最优路线；前端保留可编辑能力和提示。
- 为控制 prompt 大小，每条来源只传递受限标题、摘要、provider 与必要元数据。
- 本次不实现地图路径矩阵、后台队列、协同编辑或行程版本回滚 UI。
