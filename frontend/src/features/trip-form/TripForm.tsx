import { budgetOptions, interestOptions, travelerOptions } from "./tripDefaults";

export function TripForm() {
  return (
    <section className="panel">
      <h2>Create trip</h2>
      <form className="form-grid">
        <label>
          Destination
          <input name="destination" placeholder="Hangzhou" />
        </label>
        <label>
          Days
          <input min="1" name="days" placeholder="3" type="number" />
        </label>
        <label>
          Interest
          <select name="interest">
            {interestOptions.map((interest) => (
              <option key={interest}>{interest}</option>
            ))}
          </select>
        </label>
        <label>
          Budget
          <select name="budget">
            {budgetOptions.map((budget) => (
              <option key={budget}>{budget}</option>
            ))}
          </select>
        </label>
        <label>
          Travelers
          <select name="travelerType">
            {travelerOptions.map((traveler) => (
              <option key={traveler}>{traveler}</option>
            ))}
          </select>
        </label>
        <button type="button">Start research</button>
      </form>
    </section>
  );
}
