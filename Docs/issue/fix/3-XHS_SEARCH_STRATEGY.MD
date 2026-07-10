# XHS_SEARCH_STRATEGY

## 1. 现象

research run 使用“目的地 + 兴趣 + 旅行”作为唯一小红书搜索词。对于“大理 本地生活 旅行”等组合词，小红书 MCP 返回空结果，导致 `research_sources` 中没有 `xiaohongshu` provider。

## 2. 根因

- 搜索词过度约束，未采用目的地优先和逐级降级策略。
- 小红书搜索结果实际使用 `noteCard.displayTitle`、`noteCard.desc` 和 `noteCard.user` 字段，原解析器只读取顶层字段。
- MCP 返回空结果时没有继续尝试备用关键词。
- 当前 Docker 运行参数未按官方配置 `COOKIES_PATH`，Cookie 实际落在容器内 `/app/cookies.json`，没有持久化到挂载的数据目录。
- MCP 客户端没有识别工具结果的 `isError`，会把官方搜索错误静默当成空结果。
- 官方浏览器搜索偶发返回空结果，需要请求级重试后再切换关键词。

## 3. 修复动作

- 按目的地、目的地+旅行、目的地+兴趣生成去重后的搜索词，并按顺序尝试，首次有结果即停止。
- 增加常见英文目的地别名归一化，覆盖 `DaLi` 到 `大理` 等当前输入场景。
- 兼容小红书 `feeds[].noteCard` 返回结构，保存标题、作者、正文摘要、笔记 ID、xsec token 和来源 URL。
- 所有候选词均无结果时，记录小红书 provider 的明确失败摘要，不影响高德和 Tavily 继续执行。
- 按官方 Docker Compose 补齐 Cookie 和浏览器运行目录环境变量，并启用 init/tty 运行选项。
- MCP 客户端遇到 `isError: true` 时抛出错误，让 research run 保留真实失败原因。
- 每个候选关键词最多请求两次，间隔 1 秒；两次仍无结果后才进入下一个候选关键词。

## 4. 验证

- 增加 research service fallback 与小红书结果解析测试。
- 运行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。
- 使用官方 Cookie 路径重建 MCP 后，真实 run `e773b39c-027a-4b15-97c9-53fdcb485aee` 成功保存 11 条来源，其中 `xiaohongshu: 5`、`amap: 1`、`tavily: 5`。
