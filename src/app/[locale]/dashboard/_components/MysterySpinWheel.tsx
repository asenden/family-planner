"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MYSTERY_SPIN_OUTCOMES } from "@/lib/gamification-constants";
import { useGamification } from "./GamificationProvider";

type Phase = "spinning" | "reveal";

export function MysterySpinWheel() {
  const { mysterySpin, clearCelebration } = useGamification();
  const t = useTranslations("routines");

  const [phase, setPhase] = useState<Phase>("spinning");
  const [displayIndex, setDisplayIndex] = useState(0);

  useEffect(() => {
    if (!mysterySpin) {
      setPhase("spinning");
      return;
    }

    setPhase("spinning");

    // Spin animation: start fast, gradually slow down
    let interval = 80;
    let elapsed = 0;
    const totalDuration = 2400;
    let timeoutId: ReturnType<typeof setTimeout>;

    const spin = () => {
      setDisplayIndex((prev) => (prev + 1) % MYSTERY_SPIN_OUTCOMES.length);
      elapsed += interval;

      if (elapsed < totalDuration) {
        // Gradually increase interval to slow down
        const progress = elapsed / totalDuration;
        interval = 80 + progress * progress * 320;
        timeoutId = setTimeout(spin, interval);
      } else {
        // Settle on the actual outcome
        setDisplayIndex(mysterySpin.outcomeIndex);
        setPhase("reveal");
      }
    };

    timeoutId = setTimeout(spin, interval);
    return () => clearTimeout(timeoutId);
  }, [mysterySpin]);

  if (!mysterySpin) return null;

  const displayOutcome = MYSTERY_SPIN_OUTCOMES[displayIndex];
  const revealOutcome = MYSTERY_SPIN_OUTCOMES[mysterySpin.outcomeIndex];
  const currentOutcome = phase === "reveal" ? revealOutcome : displayOutcome;

  return (
    <>
      <style>{`
        @keyframes spin-wheel-in {
          0% { opacity: 0; transform: scale(0.7) translateY(30px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin-reveal-bounce {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.15); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes spin-icon-cycle {
          0%, 100% { transform: scale(1); opacity: 1; }
          40% { transform: scale(0.85); opacity: 0.7; }
          60% { transform: scale(1.1); opacity: 1; }
        }
        .spin-wheel-container {
          animation: spin-wheel-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .spin-reveal-bounce {
          animation: spin-reveal-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .spin-icon-cycle {
          animation: spin-icon-cycle 0.16s ease-in-out infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: "rgba(26, 22, 37, 0.75)", backdropFilter: "blur(8px)" }}
      >
        <div
          className="spin-wheel-container glass flex flex-col items-center gap-6 p-8 mx-4"
          style={{
            borderRadius: "24px",
            maxWidth: "340px",
            width: "100%",
            boxShadow: `0 0 60px ${currentOutcome.color}30, 0 24px 64px rgba(0,0,0,0.5)`,
            border: `1px solid ${phase === "reveal" ? currentOutcome.color + "60" : "rgba(255,255,255,0.1)"}`,
            transition: "border-color 0.4s ease, box-shadow 0.4s ease",
          }}
        >
          {/* Title */}
          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {phase === "spinning" ? t("mysteryBonusSpinning") : t("mysteryBonus")}
          </p>

          {/* Spinning circle */}
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle, ${currentOutcome.color}20, transparent 70%)`,
              border: `3px solid ${currentOutcome.color}${phase === "reveal" ? "cc" : "60"}`,
              boxShadow: `0 0 30px ${currentOutcome.color}${phase === "reveal" ? "50" : "20"}`,
              transition: "border-color 0.3s ease, box-shadow 0.3s ease",
            }}
          >
            <span
              className={`text-5xl leading-none ${phase === "spinning" ? "spin-icon-cycle" : "spin-reveal-bounce"}`}
              role="img"
              aria-label={currentOutcome.label}
            >
              {currentOutcome.icon}
            </span>
          </div>

          {/* Points display */}
          {phase === "reveal" && (
            <div className="flex flex-col items-center gap-1 spin-reveal-bounce">
              <p
                className="text-4xl font-black tabular-nums"
                style={{
                  color: revealOutcome.color,
                  textShadow: `0 0 20px ${revealOutcome.color}80`,
                }}
              >
                +{mysterySpin.points}
              </p>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("mysteryBonusResult", { points: mysterySpin.points })}
              </p>
            </div>
          )}

          {phase === "spinning" && (
            <div className="h-14 flex items-center">
              <div
                className="flex gap-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="text-xl"
                    style={{
                      animation: `spin-icon-cycle 0.6s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  >
                    •
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Collect button — only show when revealed */}
          {phase === "reveal" && (
            <button
              onClick={() => clearCelebration("mysterySpin")}
              className="px-8 py-3 rounded-full font-bold text-sm transition-all"
              style={{
                background: `linear-gradient(135deg, ${revealOutcome.color}30, ${revealOutcome.color}15)`,
                border: `1px solid ${revealOutcome.color}60`,
                color: revealOutcome.color,
                boxShadow: `0 0 16px ${revealOutcome.color}20`,
              }}
            >
              {t("tasksComplete")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
