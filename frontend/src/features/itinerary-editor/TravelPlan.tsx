import { useEffect, useState } from "react";

import {
  generateItinerary,
  getLatestItinerary,
  ItineraryActivity,
  ItineraryVersion,
  Trip
} from "../../api/client";

interface TravelPlanProps {
  trip: Trip | null;
}

export function TravelPlan({ trip }: TravelPlanProps) {
  const [itinerary, setItinerary] = useState<ItineraryVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItinerary(null);
    setError(null);

    if (!trip) {
      return;
    }

    getLatestItinerary(trip.id)
      .then(setItinerary)
      .catch(() => setError("暂时无法读取已生成的旅行计划。"));
  }, [trip]);

  async function handleGenerate(): Promise<void> {
    if (!trip) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      setItinerary(await generateItinerary(trip.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "旅行计划生成失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--itinerary" aria-labelledby="itinerary-title">
      <div className="panel-heading">
        <div>
          <h2 id="itinerary-title">旅行计划</h2>
        </div>
        <button
          className="primary-button"
          disabled={!trip || busy}
          type="button"
          onClick={() => void handleGenerate()}
        >
          {busy ? "正在生成…" : itinerary ? "重新生成" : "生成旅行计划"}
        </button>
      </div>

      {!trip ? <p className="empty-hint">先描述想去的地方，再完成来源研究。</p> : null}
      {trip && !itinerary && !error ? <p className="empty-hint">研究完成后，旅行计划会在这里生成。</p> : null}
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {itinerary ? <ReadOnlyPlan itinerary={itinerary} /> : null}
    </section>
  );
}

function ReadOnlyPlan({ itinerary }: { itinerary: ItineraryVersion }) {
  return (
    <div className="travel-plan">
      <div className="travel-plan-summary">
        <h3>{itinerary.content.title}</h3>
        <p className="muted">{itinerary.content.summary}</p>
        <p className="travel-plan-total">
          预计总预算：{formatCost(itinerary.content.currency, itinerary.content.totalEstimatedCost)}
        </p>
      </div>
      <div className="day-plan-list">
        {itinerary.content.days.map((day) => (
          <section className="day-plan" key={day.day} aria-labelledby={`day-plan-${day.day}`}>
            <div className="day-plan-heading">
              <span className="day-number">DAY {String(day.day).padStart(2, "0")}</span>
              <h3 id={`day-plan-${day.day}`}>{day.title}</h3>
            </div>
            <div className="activity-card-list">
              {day.activities.map((activity, activityIndex) => (
                <ActivityCard
                  activity={activity}
                  currency={itinerary.content.currency}
                  key={`${activity.time}-${activity.title}-${activityIndex}`}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ activity, currency }: { activity: ItineraryActivity; currency: string }) {
  const icon = getActivityIcon(activity);
  const isTransport = icon === "train" || icon === "car" || icon === "walk";

  return (
    <article className="activity-card">
      <span className={`activity-card-icon activity-card-icon--${icon}`} aria-hidden="true">
        <ActivityIcon type={icon} />
      </span>
      <div className="activity-card-body">
        <div className="activity-card-title">
          <h4>{activity.title}</h4>
          {!isTransport ? <span className="activity-tag">必去</span> : null}
        </div>
        <p className="activity-card-description">{activity.description}</p>
        <p className="activity-card-location">
          {activity.location}{activity.transport ? ` · ${activity.transport}` : ""}
        </p>
      </div>
      <div className="activity-card-meta">
        <time>{activity.time}</time>
        {activity.estimatedCost > 0 ? <span>{formatCost(currency, activity.estimatedCost)}</span> : null}
      </div>
    </article>
  );
}

type ActivityIconType = "train" | "car" | "camera" | "leaf" | "landmark" | "food" | "walk";

export function getActivityIcon(activity: ItineraryActivity): ActivityIconType {
  const primaryText = `${activity.title} ${activity.location}`.toLowerCase();
  const contentText = `${primaryText} ${activity.description}`;
  const transportText = activity.transport.toLowerCase();

  // 路线型活动优先使用汽车图标，即使描述中提到“拍摄”或“摄影”。
  if (
    containsAny(transportText, ["驾车", "自驾", "开车", "car", "drive"]) &&
    containsAny(primaryText, ["出发", "前往", "至", "返程", "返回", "还车", "公路", "路线", "驾车", "自驾", "drive"])
  ) {
    return "car";
  }

  // 非路线型活动再依据内容判断：例如“蒙餐馆 · 自驾”仍然显示餐饮图标。
  if (containsAny(contentText, ["餐", "吃", "restaurant", "food"])) {
    return "food";
  }

  if (containsAny(contentText, ["摄影", "拍照", "拍摄", "照片", "相机", "photo", "photography"])) {
    return "camera";
  }

  if (containsAny(contentText, ["公园", "花园", "湖", "自然", "森林", "park"])) {
    return "leaf";
  }

  if (containsAny(contentText, ["馆", "博物", "美术", "艺术", "museum"])) {
    return "camera";
  }

  if (containsAny(contentText, ["广场", "教堂", "寺", "宫", "城", "地标", "landmark"])) {
    return "landmark";
  }

  if (containsAny(transportText, ["机场", "火车", "车站", "train"])) {
    return "train";
  }

  if (containsAny(transportText, ["驾车", "自驾", "开车", "car", "drive"])) {
    return "car";
  }

  if (containsAny(transportText, ["步行", "walk"])) {
    return "walk";
  }

  return "landmark";
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function ActivityIcon({ type }: { type: ActivityIconType }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8
  };

  return (
    <svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24" {...commonProps}>
      {type === "train" ? <>
        <rect height="12" rx="2" width="13" x="5.5" y="4" />
        <path d="M8 19h8M9 16h.01M15 16h.01M8 8h8M12 4V2" />
      </> : null}
      {type === "car" ? <>
        <path d="M5 16.5h14l-1.2-6H6.2L5 16.5Z" />
        <path d="m7.5 10.5 1.2-3h6.6l1.2 3M4 16.5v2h2M20 16.5v2h-2" />
        <circle cx="7.5" cy="16.5" r="1" />
        <circle cx="16.5" cy="16.5" r="1" />
      </> : null}
      {type === "camera" ? <>
        <path d="M4 8.5h16v10H4zM8 8.5l1.5-3h5l1.5 3" />
        <circle cx="12" cy="13.5" r="3" />
      </> : null}
      {type === "leaf" ? <path d="M19.5 4.5C11 4.5 5 8 5 14.5c0 2.8 2.2 4.5 5 4.5 6.5 0 9.5-6 9.5-14.5ZM5 21c1.5-4 4.4-6.7 8.5-8.5" /> : null}
      {type === "landmark" ? <>
        <path d="M4 9h16M5.5 9v8M9.5 9v8M14.5 9v8M18.5 9v8M3.5 19h17M4 6l8-3 8 3" />
      </> : null}
      {type === "food" ? <>
        <path d="M6 3v7M4 3v4a2 2 0 0 0 4 0V3M6 10v11M16 3v18M16 3c2 2 2 5 0 7" />
      </> : null}
      {type === "walk" ? <path d="M13 5.5a2 2 0 1 0-2-2 2 2 0 0 0 2 2ZM10 21l1-6 2-3 2 2 2 1M11 15l-3 3-2 3M13 12l-1-3-3 1" /> : null}
    </svg>
  );
}

function formatCost(currency: string, amount: number): string {
  const symbols: Record<string, string> = { CNY: "¥", USD: "$", EUR: "€", GBP: "£" };
  return `${symbols[currency] ?? currency} ${amount}`;
}
