"use client";

import { useTranslations } from "next-intl";

interface PerfectDayCrownProps {
  show: boolean;
}

export function PerfectDayCrown({ show }: PerfectDayCrownProps) {
  const t = useTranslations("routines");

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes crown-bob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-4px) rotate(3deg); }
        }
        @keyframes crown-glow-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(251,191,36,0.4), 0 0 16px rgba(245,158,11,0.2); }
          50% { box-shadow: 0 0 16px rgba(251,191,36,0.7), 0 0 32px rgba(245,158,11,0.4); }
        }
        .crown-bob {
          animation: crown-bob 2.4s ease-in-out infinite;
          display: inline-block;
        }
        .crown-glow {
          animation: crown-glow-pulse 2.4s ease-in-out infinite;
        }
      `}</style>

      <div
        className="crown-glow inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))",
          border: "1px solid rgba(251,191,36,0.35)",
        }}
      >
        <span className="crown-bob text-base leading-none" role="img" aria-label="crown">
          👑
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: "#fde68a" }}
        >
          {t("perfectDayCrown")}
        </span>
      </div>
    </>
  );
}
