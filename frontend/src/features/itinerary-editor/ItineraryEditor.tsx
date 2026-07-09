const days = [
  {
    title: "第 1 天",
    body: "研究完成后，这里会展示路线草稿。"
  },
  {
    title: "第 2 天",
    body: "美食、交通、预算和来源链接都可以继续编辑。"
  }
];

export function ItineraryEditor() {
  return (
    <section className="panel">
      <h2>行程编辑</h2>
      <div className="day-grid">
        {days.map((day) => (
          <article className="day-card" key={day.title}>
            <h3>{day.title}</h3>
            <p className="muted">{day.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
