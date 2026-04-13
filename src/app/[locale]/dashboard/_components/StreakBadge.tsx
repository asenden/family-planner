"use client";

interface StreakBadgeProps {
  current: number;
  tier: string;
  multiplier: number;
  tierIcon: string;
  flameFrom: string;
  flameTo: string;
  compact?: boolean;
}

export function StreakBadge({
  current,
  tier,
  multiplier,
  tierIcon,
  flameFrom,
  flameTo,
  compact = false,
}: StreakBadgeProps) {
  const shouldFlicker = current >= 7;
  const iconSize = compact ? "text-base" : "text-xl";
  const countSize = compact ? "text-sm" : "text-lg";
  const padding = compact ? "px-2 py-1 gap-1" : "px-3 py-1.5 gap-2";

  return (
    <>
      <style>{`
        @keyframes streak-flicker {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.15) rotate(-5deg); }
          50% { transform: scale(1.05) rotate(3deg); }
          75% { transform: scale(1.12) rotate(-2deg); }
        }
        .streak-flicker {
          animation: streak-flicker 1.8s ease-in-out infinite;
        }
      `}</style>

      <div
        className={`inline-flex items-center ${padding} rounded-full`}
        style={{
          background: "rgba(255,255,255,0.07)",
          border: `1px solid ${flameFrom}40`,
          boxShadow: `0 0 12px ${flameFrom}20`,
        }}
      >
        {/* Flame icon */}
        <span
          className={`${iconSize} leading-none ${shouldFlicker ? "streak-flicker" : ""}`}
          role="img"
          aria-label="streak"
        >
          {tierIcon}
        </span>

        {/* Streak count with gradient text */}
        <span
          className={`${countSize} font-bold tabular-nums leading-none`}
          style={{
            background: `linear-gradient(90deg, ${flameFrom}, ${flameTo})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {current}
        </span>

        {/* Multiplier badge */}
        {multiplier > 1 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
            style={{
              background: `linear-gradient(135deg, ${flameFrom}30, ${flameTo}30)`,
              border: `1px solid ${flameFrom}50`,
              color: flameTo,
            }}
          >
            {multiplier}x
          </span>
        )}
      </div>
    </>
  );
}
