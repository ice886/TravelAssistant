import { useEffect, useState } from "react";

import { getResearchSources, ResearchSource, Trip } from "../../api/client";

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

const providerLabels: Record<ResearchSource["provider"], string> = {
  xiaohongshu: "小红书",
  amap: "高德地图",
  tavily: "网页"
};

export function SourcesPanel({ trip }: { trip: Trip | null }) {
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSources([]);
    setError(null);
    if (!trip) return;
    let active = true;
    const loadSources = () => {
      getResearchSources(trip.id)
        .then((nextSources) => {
          if (active) setSources(nextSources);
        })
        .catch((sourceError: unknown) => {
          if (active && !String(sourceError).includes("404")) {
            setError(sourceError instanceof Error ? sourceError.message : "来源请求失败");
          }
        });
    };
    loadSources();
    const interval = window.setInterval(loadSources, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [trip]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>来源证据</h2>
        <span className="pill">{sources.length} 条</span>
      </div>
      <div className="source-grid">
        {sourceTypes.map((source) => (
          <article className="source-card" key={source.title}>
            <h3>{source.title}</h3>
            <p className="muted">{source.body}</p>
          </article>
        ))}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {sources.length > 0 ? (
        <div className="source-results">
          {sources.map((source) => (
            <article className="source-result" key={source.id}>
              <div className="source-result-heading">
                <span className="pill">{providerLabels[source.provider]}</span>
                {source.url ? <a href={source.url} target="_blank" rel="noreferrer">打开来源</a> : null}
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
