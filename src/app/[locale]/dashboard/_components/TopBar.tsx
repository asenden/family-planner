"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Sun, Settings } from "lucide-react";
import type { CurrentWeather } from "@/lib/weather";

interface TopBarProps {
  onSettingsClick?: () => void;
  weather?: CurrentWeather | null;
  onWeatherClick?: () => void;
}

export function TopBar({ onSettingsClick, weather, onWeatherClick }: TopBarProps) {
  const locale = useLocale();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const weekday = now.toLocaleDateString(locale, { weekday: "long" });
  const dateStr = now.toLocaleDateString(locale, { day: "numeric", month: "long" });

  return (
    <div
      className="glass flex items-center justify-between px-8 py-4 relative z-10 animate-slide-up"
      style={{ borderRadius: "var(--border-radius)", boxShadow: "var(--shadow-topbar)" }}
      data-testid="topbar"
    >
      <div
        data-testid="topbar-weather"
        className="flex items-center gap-3"
        onClick={onWeatherClick}
        style={{ cursor: onWeatherClick ? "pointer" : "default" }}
      >
        {weather ? (
          <>
            <span className="text-2xl leading-none">{weather.icon}</span>
            <span className="text-lg font-medium" style={{ color: "var(--color-text-muted)" }}>
              {weather.temperature}°C
            </span>
          </>
        ) : (
          <>
            <Sun size={24} strokeWidth={1.5} style={{ color: "var(--color-accent)" }} />
            <span className="text-lg font-medium" style={{ color: "var(--color-text-muted)" }}>--°C</span>
          </>
        )}
      </div>

      <div data-testid="topbar-date" className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
          {weekday}
        </div>
        <div className="text-lg font-bold">{dateStr}</div>
      </div>

      <div className="flex items-center gap-4">
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="glass-hover p-2 rounded-xl cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Settings size={20} strokeWidth={1.5} />
          </button>
        )}
        <div data-testid="topbar-time" className="text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: "var(--color-text)" }}>
          {time}
        </div>
      </div>
    </div>
  );
}
