# REMOVE RESEARCH CACHE

> 日期：2026-07-12  
> 类型：Plan  
> 状态：已确认，进入开发

## 1. 目标

删除 Research 结果缓存机制，使每次 Research run 都重新执行 Agent 和所需的外部 Provider 调用，不再读取或回写 `research_cache`。

本次保留 Research 的同一 trip 单活保护、重复启动复用和 stale run 清理逻辑。

## 2. 执行步骤

1. 清理 Research 缓存服务、cache key/envelope、命中读取、回写和来源物化逻辑。
2. 停止创建 `research_cache` 表及索引，并删除现有缓存表及其数据。
3. 移除 `RESEARCH_CACHE_TTL_SECONDS` 配置、环境变量示例、Compose 透传和运行时配置读取。
4. 调整 Research API、前端类型和界面，移除 `cacheHit`、缓存状态和相关文案，保留运行、降级、失败和轮次反馈。
5. 删除缓存测试，增加每次 Research 都重新执行 Agent/Provider 的验证；保留单活和 stale run 测试。
6. 同步更新 architecture、guide、technical、feature、README 和 daily log 中的缓存描述。
7. 运行 lint、typecheck、test、build，并验证旧数据库的兼容升级路径。

## 3. 关键影响点

- `backend/src/modules/research/`：移除缓存依赖和缓存分支。
- `backend/src/modules/database/`：移除缓存表初始化和索引。
- `backend/src/modules/config/`：移除缓存 TTL 配置。
- `frontend/src/api/`、`frontend/src/features/agent-run/`：移除缓存字段和展示状态。
- 测试、环境变量、Compose、README 与项目知识缓存文档同步更新。

## 4. 保留边界

- `agent_runs(trip_id) WHERE status='running'` 部分唯一索引继续保证同一 trip 单活。
- `RESEARCH_STALE_AFTER_SECONDS` 继续处理 API 进程重启后遗留的 running run。
- XHS 降级、Provider 错误归一化和 Research 轮次限制不变。

## 5. 风险

- 每次 Research 都会重新调用 LLM 和外部 Provider，可能增加响应时间、API 调用量和费用。
- 删除现有 `research_cache` 表会清除历史缓存数据，不影响 trip、research run、research sources 和 itinerary versions。
- 旧数据库升级必须允许已有 `research_cache` 表存在，并在升级后完成清理。

## 6. 验证

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

另外验证：数据库启动不再创建缓存表；连续两次启动 Research 时不会出现 cache hit，且单活与 stale run 行为仍然正常。
