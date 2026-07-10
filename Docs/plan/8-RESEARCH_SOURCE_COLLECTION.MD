# RESEARCH_SOURCE_COLLECTION

## 1. 任务类型

`plan`

本次任务将 research preflight 推进为真实来源研究闭环：调用小红书只读 MCP、高德地图和 Tavily，持久化统一来源，并在前端展示研究阶段与来源结果。

## 2. 执行步骤

1. 扩展 `ResearchService` 状态机，增加 `source_research` 阶段和失败处理。
2. 接入小红书只读检索，根据旅行计划生成搜索关键词并保存来源摘要。
3. 接入高德 POI 与 Tavily 网页搜索，将外部结果转换为统一 `research_sources` 记录。
4. 新增来源查询 API，支持按 provider 查询当前旅行计划的研究来源。
5. 更新前端 Agent 进度面板和来源面板，展示研究阶段、来源数量和部分失败提示。
6. 增加后端与前端测试，更新 README、项目知识缓存和 daily log。
7. 运行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。

## 3. 关键影响点

- `backend/research`：从预检扩展为来源采集与持久化。
- `backend/mcp`：复用只读工具白名单，不增加发布、评论、点赞、收藏或删除 cookies 能力。
- `backend/providers`：首次进入真实业务调用，统一处理外部错误和降级。
- `backend/database`：扩展 `research_sources` 查询和来源字段映射。
- `frontend/agent-run`、`frontend/sources`：展示真实研究进度和来源结果。
- `docs`：同步来源契约、状态模型、运行方式和开发记录。

## 4. 风险与边界

- 小红书 MCP 返回格式可能变化，需采用宽松解析并保留安全摘要。
- 单个 provider 超时或无结果时，研究任务尽量保留其他 provider 结果，并明确标注降级状态。
- 本次不生成最终行程、不调用 LLM 生成 itinerary；行程生成另行设计。
- 研究任务首版仍在 API 进程内执行，后续若耗时明显再拆分后台队列或 worker。
