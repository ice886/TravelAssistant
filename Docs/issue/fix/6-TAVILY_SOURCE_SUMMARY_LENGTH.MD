# TAVILY SOURCE SUMMARY LENGTH

> 日期：2026-07-12  
> 状态：已完成

## 1. 现象

Research 来源面板已经将结果简化为标题与摘要，但 Tavily 网页搜索返回的摘要仍然较长，导致列表信息密度过高，影响快速浏览。

## 2. 修复目标

- `provider === "tavily"` 的网页搜索来源只显示标题与“查看原始来源”链接。
- 小红书与高德来源继续展示标题、简体摘要和原始来源链接。
- 不修改后端来源数据、Research API 或数据库内容。

## 3. 影响范围

- `frontend/src/features/sources/`
- 来源展示测试
- 前端功能说明与 daily log

## 4. 根因、修复动作与验证结果

### 根因

来源列表对所有 provider 使用相同的标题加摘要展示规则。Tavily 的 `snippet` 通常包含较长的网页摘录，即使整体列表已经简化，仍会造成单条结果过高。

### 修复动作

- 新增 `shouldDisplaySourceSummary()` 展示规则，明确 Tavily 不展示摘要，小红书和高德继续展示。
- `SourceResult` 根据规则决定是否渲染摘要，同时始终保留安全过滤后的原始来源链接。
- 增加三类 provider 的展示规则测试。

### 验证结果

- `npm run lint -w frontend`：通过。
- `npm run typecheck -w frontend`：通过。
- `npm run test -w frontend`：通过，4 个测试文件、11 项测试。
- `npm run build -w frontend`：通过。
