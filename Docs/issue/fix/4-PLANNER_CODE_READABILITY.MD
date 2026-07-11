# PLANNER_CODE_READABILITY

## 1. 现象

首版 Planner 功能通过 lint、类型检查、测试和构建，但实现存在明显可读性问题：Controller 和辅助函数被压缩为单行，JSON Schema 与业务编排混放，Service 同时承担来源查询、Prompt 构造、校验和持久化，前端组件包含深层内联不可变更新与密集 JSX。

## 2. 影响范围

- `backend/src/modules/planner/`
- `frontend/src/features/itinerary-editor/`
- Planner 相关测试与开发文档

API 路径、数据库结构和行程 JSON 契约保持不变。

## 3. 修复目标

1. Controller 仅保留清晰的路由转发，并声明返回类型。
2. 将行程 JSON Schema、运行时校验和 Planner Service 分离。
3. 将来源读取、Prompt 构造与版本持久化拆为具名方法。
4. 将前端编辑器拆为职责明确的小组件和不可变更新函数。
5. 补充 PlannerService 生成、无来源和版本保存测试。

## 4. 验证结果

- Controller 已展开路由方法并增加显式 `Promise<ItineraryVersion>` 返回类型。
- JSON Schema 和运行时校验分别迁移到 `itinerary.schema.ts`、`itinerary.validator.ts`。
- Planner Service 已拆分来源查询、前置条件、模型生成、版本写入和行转换方法。
- 前端已拆分 `ActivityEditor`、`ItineraryDayCard` 和纯函数 `updateActivity`，移除 JSX 内深层 `map` 更新。
- 新增 PlannerService 正常生成、缺少来源和编辑保存测试。
- `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 和 `git diff --check` 全部通过。
