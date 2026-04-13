"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { FeelingFace, FEELING_COLORS } from "./FeelingFace";

const FEELINGS = ["happy", "neutral", "sad", "angry", "excited"] as const;
type Feeling = (typeof FEELINGS)[number];

interface FeelingCheckin {
  id: string;
  date: string;
  feeling: Feeling;
  note?: string | null;
  member: { id: string; name: string; color: string };
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

interface FeelingsFullViewProps {
  familyId: string;
  members: FamilyMember[];
  initialFeelings: FeelingCheckin[];
  onBack: () => void;
}

// Get date string YYYY-MM-DD from a Date
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Get last 7 days as date strings, oldest first
function getLast7Days(): Date[] {
  const today = new Date();
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push(d);
  }
  return days;
}

// Short weekday labels
const DAY_LABELS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
function getDayLabel(d: Date): string {
  // getDay() returns 0=Sun…6=Sat, remap to 0=Mon…6=Sun
  const idx = (d.getDay() + 6) % 7;
  return DAY_LABELS_DE[idx];
}

const MAX_NOTE = 100;

export function FeelingsFullView({
  familyId,
  members,
  initialFeelings,
  onBack,
}: FeelingsFullViewProps) {
  const t = useTranslations("feelings");
  const router = useRouter();
  const dirty = useRef(false);

  // All feelings state (includes history for weekly grid)
  const [feelings, setFeelings] = useState<FeelingCheckin[]>(initialFeelings);

  // Step: "who" → "feeling"
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedFeeling, setSelectedFeeling] = useState<Feeling | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [justBounced, setJustBounced] = useState<Feeling | null>(null);

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;

  const last7Days = getLast7Days();
  const todayStr = toDateStr(new Date());

  // Build lookup: memberId + dateStr → feeling
  const feelingMap: Record<string, Feeling> = {};
  for (const f of feelings) {
    // f.date may be "YYYY-MM-DD" or ISO string — normalize to local date string
    const dateStr = f.date.length === 10 ? f.date : toDateStr(new Date(f.date));
    const key = `${f.member.id}__${dateStr}`;
    feelingMap[key] = f.feeling;
  }

  const handleSelectMember = (id: string) => {
    setSelectedMemberId(id);
    setSelectedFeeling(null);
    setNote("");
    setSaved(false);
  };

  const handleSelectFeeling = (f: Feeling) => {
    setSelectedFeeling(f);
    setJustBounced(f);
    setTimeout(() => setJustBounced(null), 450);
  };

  const handleSave = useCallback(async () => {
    if (!selectedMemberId || !selectedFeeling) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/families/${familyId}/feelings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberId,
          feeling: selectedFeeling,
          note: note.trim() || null,
        }),
      });
      if (res.ok) {
        const { checkin } = await res.json();
        dirty.current = true;
        // Normalize the date to YYYY-MM-DD local format
        const normalizedCheckin = {
          ...checkin,
          date: toDateStr(new Date(checkin.date)),
        };
        // Update local feelings state with the full checkin (includes member relation)
        setFeelings((prev) => {
          const filtered = prev.filter(
            (f) => {
              const fDate = f.date.length === 10 ? f.date : toDateStr(new Date(f.date));
              return !(f.member.id === selectedMemberId && fDate === normalizedCheckin.date);
            }
          );
          return [...filtered, normalizedCheckin];
        });
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          setSelectedFeeling(null);
          setNote("");
          setSelectedMemberId(null);
        }, 1500);
      }
    } finally {
      setSaving(false);
    }
  }, [selectedMemberId, selectedFeeling, note, familyId]);

  return (
    <div className="min-h-screen p-5 flex flex-col gap-6">
      {/* Back button */}
      <div className="flex items-center">
        <button
          onClick={() => { if (dirty.current) router.refresh(); onBack(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-white/10 active:bg-white/5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">{t("title")}</span>
        </button>
      </div>

      {/* Check-in section */}
      <div className="glass rounded-3xl p-6 flex flex-col gap-5">
        {/* Who are you? */}
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.15em] mb-3"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("whoAreYou")}
          </p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectMember(m.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background:
                    selectedMemberId === m.id ? `${m.color}25` : "rgba(255,255,255,0.07)",
                  color:
                    selectedMemberId === m.id ? m.color : "var(--color-text-muted)",
                  border:
                    selectedMemberId === m.id
                      ? `1.5px solid ${m.color}60`
                      : "1.5px solid transparent",
                  boxShadow:
                    selectedMemberId === m.id ? `0 0 16px ${m.color}20` : "none",
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* How do you feel? */}
        {selectedMember && (
          <>
            <div>
              <p
                className="text-xs font-bold uppercase tracking-[0.15em] mb-4"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("howAreYou")}
              </p>
              <div className="flex justify-between gap-2">
                {FEELINGS.map((f) => {
                  const isSelected = selectedFeeling === f;
                  const fColor = FEELING_COLORS[f];
                  return (
                    <button
                      key={f}
                      onClick={() => handleSelectFeeling(f)}
                      className="flex flex-col items-center gap-2 flex-1 py-3 rounded-2xl transition-all active:scale-95"
                      style={{
                        background: isSelected ? `${fColor}20` : "rgba(255,255,255,0.05)",
                        border: isSelected
                          ? `1.5px solid ${fColor}60`
                          : "1.5px solid transparent",
                        boxShadow: isSelected ? `0 0 20px ${fColor}35` : "none",
                      }}
                    >
                      <div
                        className={
                          justBounced === f ? "feeling-selected" : undefined
                        }
                      >
                        <FeelingFace feeling={f} size={48} />
                      </div>
                      <span
                        className="text-[11px] font-semibold"
                        style={{
                          color: isSelected ? fColor : "var(--color-text-muted)",
                        }}
                      >
                        {t(f)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note */}
            {selectedFeeling && !saved && (
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-[0.15em] mb-2"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("note")}
                </p>
                <div className="relative">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                    placeholder={t("notePlaceholder")}
                    rows={2}
                    className="w-full rounded-2xl px-4 py-3 text-sm resize-none"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "var(--color-text)",
                      outline: "none",
                    }}
                  />
                  <span
                    className="absolute bottom-3 right-4 text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {MAX_NOTE - note.length}
                  </span>
                </div>
              </div>
            )}

            {/* Save / Saved */}
            {selectedFeeling && (
              <button
                onClick={saved ? undefined : handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: saved
                    ? "linear-gradient(135deg, #34d399, #10b981)"
                    : `linear-gradient(135deg, ${FEELING_COLORS[selectedFeeling]}dd, ${FEELING_COLORS[selectedFeeling]}99)`,
                  color: "#fff",
                  boxShadow: saved
                    ? "0 4px 16px rgba(52,211,153,0.4)"
                    : `0 4px 16px ${FEELING_COLORS[selectedFeeling]}35`,
                }}
              >
                {saved ? (
                  <>
                    <Check size={16} strokeWidth={2.5} />
                    {t("saved")}
                  </>
                ) : saving ? (
                  "..."
                ) : (
                  t("save")
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Weekly overview */}
      <div className="glass rounded-3xl p-5">
        <p
          className="text-xs font-bold uppercase tracking-[0.15em] mb-4"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("thisWeek")}
        </p>

        {/* Column headers (days) */}
        <div
          className="grid mb-3"
          style={{ gridTemplateColumns: `120px repeat(7, 1fr)`, gap: "4px" }}
        >
          <div />
          {last7Days.map((d) => {
            const isToday = toDateStr(d) === todayStr;
            return (
              <div
                key={toDateStr(d)}
                className="flex flex-col items-center gap-0.5"
              >
                <span
                  className="text-[10px] font-semibold"
                  style={{
                    color: isToday ? "var(--color-primary)" : "var(--color-text-muted)",
                  }}
                >
                  {getDayLabel(d)}
                </span>
                {isToday && (
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Member rows */}
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="grid items-center"
              style={{ gridTemplateColumns: `120px repeat(7, 1fr)`, gap: "4px" }}
            >
              {/* Member name */}
              <div className="flex items-center gap-2 pr-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: member.color }}
                />
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {member.name}
                </span>
              </div>

              {/* Day cells */}
              {last7Days.map((d) => {
                const dateStr = toDateStr(d);
                const isToday = dateStr === todayStr;
                const key = `${member.id}__${dateStr}`;
                const feeling = feelingMap[key];

                return (
                  <div
                    key={dateStr}
                    className="flex items-center justify-center py-1 rounded-xl"
                    style={{
                      background: isToday
                        ? "rgba(167,139,250,0.08)"
                        : "transparent",
                    }}
                  >
                    <FeelingFace
                      feeling={feeling ?? "none"}
                      size={20}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
