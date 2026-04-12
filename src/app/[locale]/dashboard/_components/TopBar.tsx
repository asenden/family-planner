"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

export function TopBar() {
  const locale = useLocale();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex items-center justify-between px-6 py-3" style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--border-radius)" }}>
      <div data-testid="topbar-weather" className="flex items-center gap-2 text-lg">
        <span>☀️</span>
        <span>--°C</span>
      </div>
      <div data-testid="topbar-date" className="text-lg font-semibold">{date}</div>
      <div data-testid="topbar-time" className="text-lg font-bold">{time}</div>
    </div>
  );
}
