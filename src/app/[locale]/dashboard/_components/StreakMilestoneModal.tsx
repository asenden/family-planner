"use client";

import { useTranslations } from "next-intl";
import { STREAK_TIERS } from "@/lib/gamification-constants";
import { useGamification } from "./GamificationProvider";

function getTierForStreak(days: number): (typeof STREAK_TIERS)[number] {
  let tier: (typeof STREAK_TIERS)[number] = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) {
    if (days >= t.minDays) tier = t;
  }
  return tier;
}

export function StreakMilestoneModal() {
  const { streakMilestone, clearCelebration } = useGamification();
  const t = useTranslations("routines");

  if (!streakMilestone) return null;

  const tier = getTierForStreak(streakMilestone.milestone);

  const tierLabelKey = (
    {
      starter: "tierStarter",
      warming_up: "tierWarmingUp",
      on_fire: "tierOnFire",
      blazing: "tierBlazing",
      legendary: "tierLegendary",
      mythic: "tierMythic",
    } as const
  )[tier.label];

  return (
    <>
      <style>{`
        @keyframes milestone-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes milestone-pop-in {
          0% { opacity: 0; transform: scale(0.75) translateY(24px); }
          70% { transform: scale(1.04) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes milestone-flame-bounce {
          0%, 100% { transform: scale(1) rotate(-4deg); }
          50% { transform: scale(1.2) rotate(4deg); }
        }
        @keyframes milestone-number-glow {
          0%, 100% { text-shadow: 0 0 20px ${tier.flameFrom}80, 0 0 40px ${tier.flameTo}40; }
          50% { text-shadow: 0 0 40px ${tier.flameFrom}cc, 0 0 80px ${tier.flameTo}80; }
        }
        .milestone-backdrop {
          animation: milestone-backdrop-in 0.3s ease forwards;
        }
        .milestone-card {
          animation: milestone-pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .milestone-flame {
          animation: milestone-flame-bounce 1.6s ease-in-out infinite;
          display: inline-block;
        }
        .milestone-number {
          animation: milestone-number-glow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="milestone-backdrop fixed inset-0 z-[9995] flex items-center justify-center px-4"
        style={{
          background: "rgba(26, 22, 37, 0.80)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        onClick={() => clearCelebration("streakMilestone")}
      >
        {/* Card */}
        <div
          className="milestone-card glass flex flex-col items-center gap-5 p-8 text-center"
          onClick={(e) => e.stopPropagation()}
          style={{
            borderRadius: "28px",
            maxWidth: "360px",
            width: "100%",
            border: `1px solid ${tier.flameFrom}50`,
            boxShadow: `0 0 60px ${tier.flameFrom}25, 0 24px 64px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Tier icon */}
          <span
            className="milestone-flame text-6xl leading-none"
            role="img"
            aria-label={tier.label}
          >
            {tier.icon}
          </span>

          {/* Milestone number */}
          <p
            className="milestone-number text-7xl font-black tabular-nums leading-none"
            style={{
              background: `linear-gradient(135deg, ${tier.flameFrom}, ${tier.flameTo})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {streakMilestone.milestone}
          </p>

          {/* Milestone label */}
          <div className="flex flex-col items-center gap-1">
            <p
              className="text-xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {t("streakMilestone", { count: streakMilestone.milestone })}
            </p>
            <p
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("streakMilestoneMsg")}
            </p>
          </div>

          {/* Tier + multiplier info */}
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${tier.flameFrom}15, ${tier.flameTo}10)`,
              border: `1px solid ${tier.flameFrom}30`,
            }}
          >
            <span className="text-sm font-semibold" style={{ color: tier.flameTo }}>
              {tierLabelKey ? t(tierLabelKey) : tier.label}
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `${tier.flameFrom}25`,
                color: tier.flameFrom,
              }}
            >
              {t("multiplier", { value: tier.multiplier })}
            </span>
          </div>

          {/* Continue button */}
          <button
            onClick={() => clearCelebration("streakMilestone")}
            className="w-full py-3 rounded-full font-bold text-sm transition-all"
            style={{
              background: `linear-gradient(135deg, ${tier.flameFrom}30, ${tier.flameTo}20)`,
              border: `1px solid ${tier.flameFrom}50`,
              color: tier.flameTo,
              boxShadow: `0 0 16px ${tier.flameFrom}20`,
            }}
          >
            {t("tasksComplete")}
          </button>
        </div>
      </div>
    </>
  );
}
