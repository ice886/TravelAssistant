import { useEffect, useState } from "react";

import { AgentRun, getResearchSources, ResearchSource, Trip } from "../../api/client";
import {
  safeSourceUrl,
  shouldDisplaySourceSummary,
  simplifyChinese
} from "./sourcePresentation";

const sourceTypes = [
  {
    title: "小红书笔记",
    body: "只读获取真实旅行灵感和经验依据。"
  },
  {
    title: "地图地点",
    body: "补全 POI、坐标、地址和通勤估算。"
  },
  {
    title: "网页信息",
    body: "补充开放时间、门票、预约和季节提醒。"
  }
];

export function SourcesPanel({ trip, run }: { trip: Trip | null; run: AgentRun | null }) {
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSources([]);
    setError(null);
  }, [run?.id, trip?.id]);

  useEffect(() => {
    const tripId = trip?.id;
    const runId = run?.id;
    if (!tripId || !runId || run.tripId !== tripId) return;
    let active = true;
    let timeoutId: number | null = null;
    const loadSources = async () => {
      try {
        const nextSources = await getResearchSources(tripId);
        if (active) {
          setSources(nextSources.filter((source) => source.runId === runId));
          setError(null);
        }
      } catch (sourceError) {
        if (active && !String(sourceError).includes("404")) {
          setError(sourceError instanceof Error ? sourceError.message : "来源请求失败");
        }
      } finally {
        if (active && run.status === "running") {
          timeoutId = window.setTimeout(loadSources, 3000);
        }
      }
    };
    void loadSources();
    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [run?.id, run?.status, run?.tripId, trip?.id]);

  return (
    <section className="panel panel--sources" aria-labelledby="sources-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">研究资料库</p>
          <h2 id="sources-title">每条建议，都有迹可循</h2>
          <p className="muted">融合旅行者经验、地点数据与公开网页信息。</p>
        </div>
        <div className="button-row">
          {run?.progress.cacheHit ? <span className="pill status-good">缓存来源</span> : null}
          <span className="pill">{sources.length} 条</span>
        </div>
      </div>
      <div className="source-grid">
        {sourceTypes.map((source) => (
          <article className="source-card" key={source.title}>
            <h3>{source.title}</h3>
            <p className="muted">{source.body}</p>
          </article>
        ))}
      </div>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {!run ? <p className="empty-hint">完成旅行画像并启动研究后，证据会陆续出现在这里。</p> : null}
      {run?.status === "running" && sources.length === 0 ? <p className="loading-hint" role="status">Agent 正在沿途寻找第一批线索…</p> : null}
      {sources.length > 0 ? (
        <div className="source-results">
          {sources.map((source) => (
            <SourceResult key={source.id} source={source} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SourceResult({ source }: { source: ResearchSource }) {
  const title = simplifyChinese(source.title);
  const summary = simplifyChinese(source.snippet) || "该来源暂未提供摘要。";
  const url = safeSourceUrl(source.url);
  const showSummary = shouldDisplaySourceSummary(source);

  return (
    <article className="source-result">
      <div className="source-result-heading">
        <h3>{title}</h3>
        {url ? (
          <a
            aria-label={`查看原始来源：${title}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >查看原始来源 <span aria-hidden="true">↗</span></a>
        ) : null}
      </div>
      {showSummary ? <p className="source-summary">{summary}</p> : null}
    </article>
  );
}
