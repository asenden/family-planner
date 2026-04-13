"use client";

import { useEffect, useRef } from "react";

interface ThermometerBarProps {
  current: number;   // current points
  cost: number;      // points needed
  color?: string;    // accent color, defaults to amber
  height?: number;   // bar height in px, defaults to 120
  label?: string;    // optional label below
}

export function ThermometerBar({
  current,
  cost,
  color = "#f59e0b",
  height = 120,
  label,
}: ThermometerBarProps) {
  const pct = Math.min(100, cost > 0 ? Math.round((current / cost) * 100) : 0);
  const complete = pct >= 100;
  const prevPctRef = useRef(pct);

  // Trigger a CSS animation class when completion is first reached
  const celebrateRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!complete || prevPctRef.current >= 100) return;
    prevPctRef.current = pct;
    const el = celebrateRef.current;
    if (!el) return;
    el.classList.remove("thermometer-celebrate");
    // Force reflow
    void el.offsetWidth;
    el.classList.add("thermometer-celebrate");
  }, [complete, pct]);

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: 32 }}>
      {/* Bulb top label */}
      <span
        className="text-[10px] font-bold tabular-nums leading-none"
        style={{ color: complete ? color : "var(--color-text-muted)" }}
      >
        {pct}%
      </span>

      {/* Tube */}
      <div
        ref={celebrateRef}
        className="relative rounded-full overflow-hidden"
        style={{
          width: 14,
          height,
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: complete ? `0 0 16px ${color}60` : undefined,
        }}
      >
        {/* Fill — grows from bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700 ease-out"
          style={{
            height: `${pct}%`,
            background: complete
              ? `linear-gradient(to top, ${color}, #fde68a)`
              : `linear-gradient(to top, ${color}cc, ${color}66)`,
            boxShadow: complete ? `0 0 8px ${color}80` : undefined,
          }}
        />

        {/* Shimmer overlay when complete */}
        {complete && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 60%)",
              animation: "thermometer-shimmer 2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Bulb */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: 20,
          height: 20,
          background: complete
            ? `radial-gradient(circle, ${color}, ${color}aa)`
            : `radial-gradient(circle, ${color}66, ${color}33)`,
          border: `2px solid ${color}44`,
          boxShadow: complete ? `0 0 12px ${color}80` : undefined,
          transition: "all 0.5s ease",
        }}
      />

      {/* Optional label */}
      {label && (
        <span
          className="text-[9px] font-semibold text-center leading-tight"
          style={{
            color: "var(--color-text-muted)",
            maxWidth: 40,
            wordBreak: "break-word",
          }}
        >
          {label}
        </span>
      )}

      <style>{`
        @keyframes thermometer-shimmer {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .thermometer-celebrate {
          animation: thermometer-pop 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        @keyframes thermometer-pop {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.25); }
          60%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
