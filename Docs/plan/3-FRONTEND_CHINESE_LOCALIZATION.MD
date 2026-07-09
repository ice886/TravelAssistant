# FRONTEND_CHINESE_LOCALIZATION

## 1. 任务类型

`plan`

本次任务是将前端用户可见文案中文化，保持后端 API 字段名、内部类型和数据库结构不变。

## 2. 执行步骤

1. 扫描前端用户可见英文文案，确认影响组件范围。
2. 将工作台标题、状态栏、旅行计划表单、按钮和提示文案改为中文。
3. 将 Agent 进度、来源证据、行程编辑占位内容改为中文。
4. 将表单选项中文化，并同步调整相关测试。
5. 检查中文文案在现有布局内是否仍然合理展示。
6. 更新 daily log，记录本次前端本地化影响范围。
7. 运行 `npm run lint`、`npm run typecheck`、`npm run test` 和 `npm run build`。

## 3. 关键影响点

- `frontend/src/app/App.tsx`
- `frontend/src/features/trip-form/`
- `frontend/src/features/agent-run/`
- `frontend/src/features/sources/`
- `frontend/src/features/itinerary-editor/`
- `Docs/dailylog/2026_07_09.MD`

## 4. 风险与约束

- 本次只改用户可见文案，不改 API 字段名和后端契约。
- 新建 trip 会保存中文枚举值；当前本地产品可以接受，后续若需要固定枚举，可再拆分 display label 与 persisted value。
