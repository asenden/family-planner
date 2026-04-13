"use client";

import { useTranslations } from "next-intl";
import { useGamification } from "./GamificationProvider";

export function CriticalHitFlash() {
  const { criticalHit } = useGamification();
  const t = useTranslations("routines");

  if (!criticalHit) return null;

  return (
    <>
      <style>{`
        @keyframes critical-hit-expand {
          0% { opacity: 0; transform: scale(0.8); }
          15% { opacity: 1; transform: scale(1); }
          70% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.1); }
        }
        @keyframes critical-hit-text {
          0% { opacity: 0; transform: translateY(8px) scale(0.9); }
          20% { opacity: 1; transform: translateY(0) scale(1.05); }
          60% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        .critical-hit-overlay {
          animation: critical-hit-expand 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .critical-hit-text {
          animation: critical-hit-text 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>

      <div
        className="critical-hit-overlay fixed inset-0 flex flex-col items-center justify-center z-[9999] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.12) 40%, transparent 70%)",
        }}
      >
        <div className="critical-hit-text flex flex-col items-center gap-2">
          <p
            className="text-3xl font-black uppercase tracking-widest"
            style={{
              color: "#fbbf24",
              textShadow: "0 0 20px rgba(251,191,36,0.9), 0 0 40px rgba(245,158,11,0.6), 0 0 80px rgba(234,179,8,0.4)",
            }}
          >
            ⚡ {t("criticalHit")} ⚡
          </p>
          <p
            className="text-lg font-bold"
            style={{
              color: "#fde68a",
              textShadow: "0 0 12px rgba(251,191,36,0.7)",
            }}
          >
            {t("criticalHitDesc", { points: criticalHit.bonusPoints })}
          </p>
        </div>
      </div>
    </>
  );
}
