# REACT RESEARCH & CACHE

## 1. 任务类型

`plan`

本次任务将现有固定顺序的来源采集升级为受约束的 ReAct Research Agent，并增加 PostgreSQL 研究结果缓存。Agent 在严格工具白名单、轮次上限和运行时校验内自主选择小红书、Tavily、高德 POI、天气与路线工具；小红书不可用时自动降级，不阻塞其余来源研究。

## 2. 执行步骤

1. 定义 Research Agent 工具契约、轮次记录、结构化决策 Schema、最终来源格式与降级规则。
2. 扩展高德 Provider 的天气与路线能力，并将 XHS、Tavily、高德统一封装为受控 Agent 工具。
3. 重构 `ResearchService`，实现最多 8 轮的 Thought → Action → Observation 循环、终止条件和非法输出防护。
4. 新增 `research_cache` 表，实现规范化 cache key、7 天 TTL、命中读取、过期忽略与成功结果回写。
5. 扩展 Research API 和前端进度/来源面板，展示轮次、工具、缓存命中与小红书降级信息。
6. 增加测试，覆盖正常循环、最大轮次、非法 LLM 输出、Provider 失败、XHS 降级与缓存命中。
7. 更新 README、architecture、guide、technical 与 daily log，并运行 lint、typecheck、test 和 build。

## 3. 关键影响点

- `backend/research`：由固定 provider 顺序升级为受约束的 ReAct 编排。
- `backend/providers`：补齐天气和路线接口，保持外部错误归一化。
- `backend/mcp`、`backend/safety`：仅复用小红书只读工具，Agent 无权扩大工具白名单。
- `backend/database`：新增 research cache 持久化和查询能力。
- `frontend/agent-run`、`frontend/sources`：展示 Agent 轮次、缓存与降级状态。
- `config/tests/docs`：增加可配置轮次与缓存 TTL，并同步契约和验证结果。

## 4. 风险与边界

- LLM 决策必须通过运行时校验，只能调用服务端注册的工具和受限参数。
- Agent 循环设置轮次、请求超时和结果数量上限，避免无限调用与 prompt 无界增长。
- 小红书不可用时记录降级原因并移出可用工具集，以 Tavily 与高德继续完成研究。
- 缓存键只由规范化旅行需求生成，不包含密钥或第三方原始敏感数据。
- 本次不实现地图 UI、PDF 导出、后台队列或 Planner 路线注入；这些在本阶段稳定后继续推进。
