# LLM_REQUEST_TIMEOUT

## 1. 现象

Planner 调用 LLM 生成结构化行程时，请求先后超过 30 秒和 120 秒后被 `AbortController` 终止，并抛出 `ProviderError: llm request timed out.`。复杂行程生成的模型响应可能合理地超过该窗口。

## 2. 根因

`LLM_TIMEOUT_MS` 已支持通过环境变量配置，但初始回退值和 `.env.example` 均为 `30000` 毫秒。首次调整到 120 秒后再次复现。诊断确认当前 DeepSeek 端点和 `deepseek-v4-pro` 模型可用：模型列表请求约 366ms，最小对话约 1.1s；失败集中在包含完整 JSON Schema、15 条研究来源（约 8.4KB 来源文本）并一次性生成完整行程的 Planner 请求，因此属于生成耗时超过请求窗口，而非配置未生效或基础网络不通。

## 3. 修复动作

- 将 `LLM_TIMEOUT_MS` 默认值从 `30000` 延长至 `300000` 毫秒。
- 同步更新 `.env.example` 和 Provider 技术文档。
- 增加配置测试，覆盖默认值和环境变量覆盖行为。
- 超时异常增加实际阈值，例如 `llm request timed out after 300000ms.`，便于确认运行时配置。

## 4. 验证结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm run test`：通过，共 8 个测试文件、25 项测试。
- `npm run build`：通过。
- `git diff --check`：通过。

## 5. 后续生成校验问题

延长超时后，模型成功返回行程，但个别活动生成了不在当前 research run 白名单内的 `sourceIds`，导致校验器以 `Itinerary referenced an unknown research source.` 拒绝整份行程。

根因是生成内容属于不可信输入，而原校验策略对任意未知 ID 采取整体失败。修复后，Prompt 会显式提供 `allowedSourceIds`；服务端仍以白名单作为安全边界，过滤并去重未知引用，只保存真实来源 ID，同时保留其余有效行程内容。
