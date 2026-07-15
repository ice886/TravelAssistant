# ITINERARY GENERATION GATEWAY TIMEOUT

## 1. 现象

- 前端从第二步进入第三步时直接显示错误。
- 调用 `POST /api/trips/:tripId/itineraries/generate` 时返回 `504 Gateway Time-out`，计划生成失败。
- 浏览器控制台同时出现 `content.js:1 Uncaught (in promise) The message port closed before a response was received.`。
- 首轮修复后，生成接口不再超时，但模型输出在运行时校验阶段报 `Invalid itinerary day at index 0.` 并返回 400。

## 2. 影响范围

- 前端阶段切换与行程生成状态展示。
- Planner 同步生成接口经过 Web/API 网关的超时边界。
- 前后端对超时及非 JSON 错误响应的处理。

## 3. 排查计划

1. 核对第二步到第三步的前端切换和自动生成链路。
2. 核对 Web 代理、API Server 与 LLM Provider 的超时配置。
3. 定位 504 的实际产生层，并实施最小、可恢复的修复。
4. 补充相关测试并运行 lint、类型检查、测试和构建。
5. 回写根因、修复动作与验证结果。

## 4. 根因

存在两个独立问题：

1. 第三步挂载后会立即读取最新行程。尚未生成任何版本时后端按契约返回 404，但前端将所有非 2xx 响应都当成读取失败，因此用户一进入第三步就看到错误。
2. Planner 生成接口是同步长请求，LLM 单次时限为 300 秒，`AgentRunner` 最多尝试两次；生产 Nginx 未配置该路由的读取时限，使用约 60 秒默认值。运行日志明确记录 `upstream timed out while reading response header from upstream`，随后返回 504，而 API 此时仍在等待 LLM。
3. Planner 提供给模型的 JSON Schema 只约束了顶层字段，`days.items` 仅声明为任意对象；运行时校验却严格要求逐日和活动的全部字段。模型省略 `date`、`notes` 等字段时，输出符合提示 Schema 却被服务端拒绝。原生成重试只覆盖 LLM 请求/解析错误，不覆盖后续运行时校验失败。
4. 前端虽然已将最新行程 404 归一化为空状态，但浏览器仍会记录失败资源。对于“trip 存在但版本集合为空”，200 和 `null` 能更准确表达正常空状态。

`content.js` 的 message port 异常来自浏览器扩展注入脚本，不属于应用 bundle 或请求链路，与上述 404/504 无因果关系。

## 5. 修复动作

- `getLatestItinerary()` 将 404 归一化为 `null`，保留其他错误的异常语义，使第三步正确显示尚未生成的空状态。
- 为 Nginx 中的动态行程生成路由增加专用 `proxy_read_timeout 620s`，覆盖默认最多两次、单次 300 秒的 LLM 调用和少量持久化开销；不扩大其他 API 的长连接时限。
- 增加前端 API 测试，覆盖最新行程 404 空状态。
- 将最新行程正常空状态改为 `200 + null`，并保留前端对旧版 404 的兼容。
- 补全行程、逐日和活动的嵌套 JSON Schema，在 Prompt 中明确 `date`、`notes`、`transport`、`estimatedCost` 和 `sourceIds` 规则。
- 对缺失的非事实字段执行安全归一化：`date: null`、`notes: []`、`transport: ""`、`sourceIds: []`；核心字段缺失仍拒绝入库。
- 将 generate 模式的两次尝试扩展到结构校验阶段，首次模型结构不合格时追加纠正指令后重新生成，同时保持最多两次 LLM 调用的上限。
- 增加 AgentRunner 结构失败重试、Planner validator 归一化、Repository 空状态及前端新旧空状态契约测试。
- 同步更新架构、项目结构、行程生成技术文档和 daily log。

## 6. 验证结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm run test`：通过，后端 34 项、前端 17 项，共 51 项测试。
- `npm run build`：通过。
- `git diff --check`：通过。
- 重建 `web`/`api` Compose 服务后，运行中 Web 容器的 `nginx -t` 通过，配置展开确认生成路由已加载 `proxy_read_timeout 620s`。
- 通过 Web 反向代理请求 `GET /api/health` 返回 HTTP 200。
- 使用复现问题的 trip `e5f9961f-4d01-49fc-b3f1-c0651248aae8` 执行真实回归：生成前最新行程返回 `200 + null`，计划生成返回 HTTP 201 并保存版本 1（3 天，第一天 5 个活动且逐日字段完整），生成后最新行程返回 HTTP 200。
