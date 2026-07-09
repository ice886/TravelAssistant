# PROVIDER_ABSTRACTION_LAYER

## 1. 任务类型

`plan`

本次任务先实现高德、Tavily 和 LLM provider 抽象层，为后续旅行研究阶段 `POST /api/trips/:id/research` 提供稳定外部能力边界。

## 2. 执行步骤

1. 梳理现有配置入口，确认 `.env.example`、`AppConfigService`、README 中已有的高德、Tavily、LLM 环境变量命名与暴露边界。
2. 新增 Provider 模块边界，优先放在 `backend/src/modules/providers/` 下，并按 `amap`、`tavily`、`llm` 拆分 service 与类型。
3. 定义稳定接口契约：高德地点搜索/地理编码/路线距离估算、Tavily 通用搜索、OpenAI-compatible LLM chat/JSON completion。
4. 实现配置与安全边界：API Key 仅后端读取，健康检查只暴露是否配置；未配置、超时和外部错误统一归一化。
5. 增加最小验证入口，优先通过 service 单元测试覆盖配置缺失、请求构造和错误归一化，不急于暴露用户可见 API。
6. 更新 `.env.example`、README、`Docs/architecture/`、`Docs/guide/`、`Docs/technical/` 和 daily log。
7. 运行 `npm run lint`、`npm run typecheck`、`npm run test` 和 `npm run build`。

## 3. 关键影响点

- `backend/config`：新增 provider 所需 URL、模型、超时等配置读取。
- `backend/providers`：新增外部服务抽象层，后续 Agent 只依赖内部 DTO。
- `docs`：同步 provider 边界、配置项和后续 research run 接入入口。
- `security`：继续保持前端不接触 API Key，错误信息不包含密钥。

## 4. 风险与依赖

- 高德、Tavily 和 LLM 响应格式不同，首版应把第三方原始响应压缩成内部稳定 DTO。
- 外部服务暂未必有真实 API Key，测试应 mock `fetch`，不能依赖公网服务可用性。
- LLM JSON completion 需要防御模型返回非 JSON 文本的情况。
