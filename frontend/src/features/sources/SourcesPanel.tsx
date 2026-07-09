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

export function SourcesPanel() {
  return (
    <section className="panel">
      <h2>来源证据</h2>
      <div className="source-grid">
        {sourceTypes.map((source) => (
          <article className="source-card" key={source.title}>
            <h3>{source.title}</h3>
            <p className="muted">{source.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
