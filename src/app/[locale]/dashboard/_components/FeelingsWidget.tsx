"use client";

import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { FeelingFace } from "./FeelingFace";

const FEELINGS_COLOR = "#c084fc";

interface FeelingCheckin {
  id: string;
  date: string;
  feeling: "happy" | "neutral" | "sad" | "angry" | "excited";
  note?: string | null;
  member: { id: string; name: string; color: string };
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

interface FeelingsWidgetProps {
  members: FamilyMember[];
  todayFeelings: FeelingCheckin[];
  onTap: () => void;
}

export function FeelingsWidget({ members, todayFeelings, onTap }: FeelingsWidgetProps) {
  const t = useTranslations("feelings");

  // Build a lookup: memberId -> today's feeling
  const feelingByMember: Record<string, FeelingCheckin> = {};
  for (const f of todayFeelings) {
    feelingByMember[f.member.id] = f;
  }

  return (
    <button
      onClick={onTap}
      className="glass glass-hover w-full text-left p-5 cursor-pointer animate-slide-up"
      style={{ borderRadius: "var(--border-radius)", animationDelay: "250ms" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${FEELINGS_COLOR}20, ${FEELINGS_COLOR}10)`,
            border: `1px solid ${FEELINGS_COLOR}30`,
            boxShadow: `0 0 20px ${FEELINGS_COLOR}15`,
            color: FEELINGS_COLOR,
          }}
        >
          <Heart size={20} strokeWidth={1.8} />
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.15em]"
          style={{ color: FEELINGS_COLOR }}
        >
          {t("title")}
        </span>
      </div>

      {/* Member rows */}
      <div className="flex flex-col gap-2">
        {members.slice(0, 4).map((member) => {
          const checkin = feelingByMember[member.id];
          const checked = !!checkin;

          return (
            <div key={member.id} className="flex items-center gap-2.5">
              <FeelingFace feeling={checked ? checkin.feeling : "none"} size={24} />
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: member.color }}
              />
              <span
                className="text-sm font-medium leading-none"
                style={{
                  color: checked ? "var(--color-text)" : "var(--color-text-muted)",
                }}
              >
                {member.name}
              </span>
              {!checked && (
                <span
                  className="text-xs ml-auto"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("notCheckedIn")}
                </span>
              )}
            </div>
          );
        })}
        {members.length > 4 && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            +{members.length - 4} more
          </span>
        )}
      </div>
    </button>
  );
}
