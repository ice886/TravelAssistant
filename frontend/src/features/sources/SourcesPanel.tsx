import { useEffect, useState } from "react";

import { AgentRun, getResearchSources, ResearchSource, Trip } from "../../api/client";
import { safeSourceUrl, sourceProviderLabel } from "./sourcePresentation";

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
    <section className="panel">
      <div className="panel-heading">
        <h2>来源证据</h2>
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
      {sources.length > 0 ? (
        <div className="source-results">
          {sources.map((source) => (
            <article className="source-result" key={source.id}>
              <div className="source-result-heading">
                <span className="pill">{sourceProviderLabel(source)}</span>
                {safeSourceUrl(source.url) ? (
                  <a
                    aria-label={`打开来源：${source.title}`}
                    href={safeSourceUrl(source.url) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >打开来源</a>
                ) : null}
              </div>
              <h3>{source.title}</h3>
              {source.snippet ? <p className="muted">{source.snippet}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
