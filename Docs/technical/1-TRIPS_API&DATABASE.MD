# TRIPS_API&DATABASE

## 1. 设计目标

本次实现旅行计划的最小持久化闭环：
- 前端可以创建本地 draft trip。
- 后端提供 trip 创建、列表和详情 API。
- Postgres 保存旅行计划基础输入。
- 创建 trip 不依赖 `xiaohongshu-mcp`，外部研究能力留给后续 research 阶段。

## 2. 后端模块

`DatabaseModule`
- 文件位置：`backend/src/modules/database/`
- 使用 `pg` 连接 `DATABASE_URL`。
- 应用启动时执行 `CREATE TABLE IF NOT EXISTS trips`。
- 对业务模块暴露参数化 `query()`，避免业务层直接持有连接池。

`TripsModule`
- 文件位置：`backend/src/modules/trips/`
- Controller 路径：`/api/trips`
- Service 负责输入归一化、最小校验、Postgres 写入和行响应转换。

`main.ts`
- 按 `WEB_ORIGIN` 启用 CORS，支持本地 Vite 开发服务器直接请求后端 API。

## 3. trips 表

字段：
- `id uuid PRIMARY KEY`
- `destination text NOT NULL`
- `start_date date`
- `end_date date`
- `days integer`
- `interests jsonb NOT NULL DEFAULT '[]'::jsonb`
- `budget_level text NOT NULL`
- `traveler_type text NOT NULL`
- `traveler_count integer NOT NULL DEFAULT 1`
- `status text NOT NULL DEFAULT 'draft'`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

## 4. API 契约

`POST /api/trips`

请求字段：
- `destination`: string，必填。
- `days`: number，可选；若未提供 `startDate` 则必填。
- `startDate`: `YYYY-MM-DD`，可选。
- `endDate`: `YYYY-MM-DD`，可选。
- `interests`: string[]，至少一个。
- `budgetLevel`: string，必填。
- `travelerType`: string，必填。
- `travelerCount`: number，可选，默认 1。

响应：
- 返回创建后的 `Trip`，状态为 `draft`。

`GET /api/trips`
- 返回本地 trips，按 `created_at DESC` 排序。

`GET /api/trips/:id`
- `id` 必须是 UUID。
- 不存在时返回 404。

## 5. 前端接入

`frontend/src/api/client.ts`
- 定义 `HealthResponse`、`CreateTripPayload`、`Trip`。
- 提供 `getHealth()` 和 `createTrip()`。

`frontend/src/app/App.tsx`
- 启动后调用 `/api/health`。
- 状态栏展示 API、Postgres 和 XHS 配置状态。

`frontend/src/features/trip-form/TripForm.tsx`
- 表单提交调用 `createTrip()`。
- 成功时展示 draft 创建结果。
- 失败时展示后端错误消息。

## 6. 验证

已通过：
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
