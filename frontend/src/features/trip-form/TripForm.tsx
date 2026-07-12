import { FormEvent, useState } from "react";

import { createTrip, Trip } from "../../api/client";
import { budgetOptions, interestOptions, travelerOptions } from "./tripDefaults";

interface TripFormProps {
  onTripCreated?: (trip: Trip) => void;
}

export function TripForm({ onTripCreated }: TripFormProps) {
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
      onTripCreated?.(trip);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "创建旅行计划失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel panel--form" aria-labelledby="trip-form-title">
      <div className="section-intro">
        <span className="section-index" aria-hidden="true">01</span>
        <div>
          <p className="eyebrow">旅行画像</p>
          <h2 id="trip-form-title">这次想去哪里？</h2>
          <p className="muted">先给一个大致方向，稍后仍可继续调整。</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          目的地
          <input autoComplete="off" name="destination" placeholder="例如：杭州、京都或冰岛南岸" required />
        </label>
        <label>
          天数
          <input inputMode="numeric" min="1" name="days" placeholder="3" required type="number" />
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
        <button className="primary-button form-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "正在整理你的旅行…" : "开始规划旅程"}
        </button>
        {createdTrip ? (
          <p className="success-text" role="status">{createdTrip.destination} 已准备好，下一步可以收集旅行证据。</p>
        ) : null}
        {error ? <p className="error-text" role="alert">没能创建计划。{error}，请检查后再试一次。</p> : null}
      </form>
    </section>
  );
}
