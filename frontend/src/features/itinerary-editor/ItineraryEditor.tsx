const days = [
  {
    title: "Day 1",
    body: "Route draft will appear here after research."
  },
  {
    title: "Day 2",
    body: "Food, transit, budget, and source links stay editable."
  }
];

export function ItineraryEditor() {
  return (
    <section className="panel">
      <h2>Itinerary editor</h2>
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
