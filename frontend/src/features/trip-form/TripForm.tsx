import { FormEvent, useState } from "react";

import { createTrip, Trip } from "../../api/client";
import { budgetOptions, interestOptions, travelerOptions } from "./tripDefaults";

export function TripForm() {
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const destination = String(formData.get("destination") ?? "").trim();
    const daysValue = String(formData.get("days") ?? "").trim();
    const travelerCountValue = String(formData.get("travelerCount") ?? "").trim();

    setIsSubmitting(true);
    setCreatedTrip(null);
    setError(null);

    try {
      const trip = await createTrip({
        destination,
        days: daysValue ? Number(daysValue) : undefined,
        interests: [String(formData.get("interest") ?? "")],
        budgetLevel: String(formData.get("budget") ?? ""),
        travelerType: String(formData.get("travelerType") ?? ""),
        travelerCount: travelerCountValue ? Number(travelerCountValue) : 1
      });

      setCreatedTrip(trip);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "创建旅行计划失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <h2>创建旅行计划</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          目的地
          <input name="destination" placeholder="杭州" required />
        </label>
        <label>
          天数
          <input min="1" name="days" placeholder="3" required type="number" />
        </label>
        <label>
          兴趣偏好
          <select name="interest">
            {interestOptions.map((interest) => (
              <option key={interest}>{interest}</option>
            ))}
          </select>
        </label>
        <label>
          预算档位
          <select name="budget">
            {budgetOptions.map((budget) => (
              <option key={budget}>{budget}</option>
            ))}
          </select>
        </label>
        <label>
          同行人
          <select name="travelerType">
            {travelerOptions.map((traveler) => (
              <option key={traveler}>{traveler}</option>
            ))}
          </select>
        </label>
        <label>
          人数
          <input defaultValue="1" min="1" name="travelerCount" type="number" />
        </label>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "创建中..." : "创建计划"}
        </button>
        {createdTrip ? (
          <p className="success-text">已创建 {createdTrip.destination} 旅行计划，当前为草稿状态。</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </section>
  );
}
