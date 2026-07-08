const sourceTypes = [
  {
    title: "Xiaohongshu notes",
    body: "Read-only inspiration and real trip evidence."
  },
  {
    title: "Map places",
    body: "POI, coordinates, addresses, and transit estimates."
  },
  {
    title: "Web facts",
    body: "Opening hours, tickets, reservations, and seasonal notes."
  }
];

export function SourcesPanel() {
  return (
    <section className="panel">
      <h2>Evidence sources</h2>
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
