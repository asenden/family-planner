"use client";

import { useTranslations, useLocale } from "next-intl";
import { X } from "lucide-react";
import type { WeatherData } from "@/lib/weather";

interface WeatherModalProps {
  weather: WeatherData;
  city?: string | null;
  onClose: () => void;
}

const DAY_NAMES: Record<string, { en: string; de: string }> = {
  Mon: { en: "Mon", de: "Mo" },
  Tue: { en: "Tue", de: "Di" },
  Wed: { en: "Wed", de: "Mi" },
  Thu: { en: "Thu", de: "Do" },
  Fri: { en: "Fri", de: "Fr" },
  Sat: { en: "Sat", de: "Sa" },
  Sun: { en: "Sun", de: "So" },
};

function getDayLabel(dateStr: string, locale: string, index: number, t: ReturnType<typeof useTranslations>): string {
  if (index === 0) return t("today");
  const date = new Date(dateStr + "T12:00:00");
  const enDay = date.toLocaleDateString("en-US", { weekday: "short" });
  const entry = DAY_NAMES[enDay];
  if (!entry) return enDay;
  return locale === "de" ? entry.de : entry.en;
}

export function WeatherModal({ weather, city, onClose }: WeatherModalProps) {
  const t = useTranslations("weather");
  const locale = useLocale();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-lg mx-4 flex flex-col overflow-hidden"
        style={{ borderRadius: "var(--border-radius)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
            {t("title")}
            {city && (
              <span className="ml-2 text-base font-normal" style={{ color: "var(--color-text-muted)" }}>
                — {city}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="glass-hover p-2 rounded-xl cursor-pointer transition-all"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Current weather */}
        <div className="flex items-center justify-center gap-6 px-6 py-8">
          <span className="text-7xl leading-none">{weather.current.icon}</span>
          <div>
            <div
              className="text-6xl font-extrabold tabular-nums leading-none"
              style={{ color: "var(--color-text)" }}
            >
              {weather.current.temperature}°C
            </div>
            <div className="text-base mt-1" style={{ color: "var(--color-text-muted)" }}>
              {weather.current.description}
            </div>
          </div>
        </div>

        {/* 7-day forecast */}
        <div className="px-6 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
            {t("forecast")}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {weather.daily.map((day, i) => (
              <div
                key={day.date}
                className="flex flex-col items-center gap-1 py-3 px-1"
                style={{
                  backgroundColor: i === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  borderRadius: "calc(var(--border-radius) / 2)",
                  border: i === 0 ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                }}
              >
                <span className="text-xs font-semibold" style={{ color: i === 0 ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {getDayLabel(day.date, locale, i, t)}
                </span>
                <span className="text-xl leading-none">{day.icon}</span>
                <span className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                  {t("high")}{day.tempMax}°
                </span>
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {t("low")}{day.tempMin}°
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
