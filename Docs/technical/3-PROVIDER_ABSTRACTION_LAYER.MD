# PROVIDER_ABSTRACTION_LAYER

## 1. 设计目标

本次新增高德、Tavily 和 LLM provider 抽象层：
- 后续 Agent/research 模块通过内部 service 调用外部能力。
- API Key 只在后端读取，前端只看到 configured/missing 状态。
- 外部服务响应先归一化为内部 DTO，避免编排逻辑耦合第三方原始结构。
- 未配置、请求失败、超时和响应格式异常统一抛出 `ProviderError`。

## 2. 模块位置

`backend/src/modules/providers/`
- `providers.module.ts`：导出三个 provider service。
- `provider.types.ts`：定义内部 DTO 与 `ProviderError`。
- `provider-utils.ts`：封装 `fetch` JSON 请求、超时、配置断言和基础类型守卫。
- `amap.service.ts`：高德 provider。
- `tavily.service.ts`：Tavily provider。
- `llm.service.ts`：OpenAI-compatible LLM provider。

`backend/src/app.module.ts`
- 注册 `ProvidersModule`，供后续模块注入。

## 3. 配置项

高德：
- `AMAP_API_KEY`
- `AMAP_BASE_URL`，默认 `https://restapi.amap.com/v3`
- `AMAP_TIMEOUT_MS`，默认 `10000`

Tavily：
- `TAVILY_API_KEY`
- `TAVILY_BASE_URL`，默认 `https://api.tavily.com`
- `TAVILY_TIMEOUT_MS`，默认 `15000`

LLM：
- `LLM_PROVIDER`，默认 `openai-compatible`
- `LLM_BASE_URL`，默认 `https://api.openai.com/v1`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_TIMEOUT_MS`，默认 `30000`

## 4. Provider 契约

`AmapProviderService`
- `searchPlaces({ keywords, city, limit })`
- `geocode({ address, city })`
- `estimateRoute({ origin, destination, strategy })`
- 返回 `AmapPlace` 或 `AmapRouteEstimate`，坐标统一为 `{ longitude, latitude }`。

`TavilyProviderService`
- `search({ query, maxResults, searchDepth, includeAnswer })`
- 返回 `TavilySearchResponse`，包含 `answer` 和归一化后的 `results`。

`LlmProviderService`
- `chat({ messages, model, temperature, maxTokens })`
- `completeJson({ messages, schemaName, schema })`
- `completeJson` 会向模型追加 JSON-only 指令，并解析 `content`；非 JSON 内容抛出 `ProviderError("llm", "invalid_response", ...)`。

## 5. 错误边界

`ProviderError`
- `provider`: `amap | tavily | llm`
- `code`: `not_configured | request_failed | invalid_response`
- `message`: 安全摘要，不包含 API Key。
- `statusCode`: 外部 HTTP 状态码，可选。

后续 controller 或 Agent run 应捕获该错误并转成业务状态，例如 `provider_missing`、`source_unavailable` 或 `blocked_config`。

## 6. 验证

已通过：
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
