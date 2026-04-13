"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, Plus, X, Trash2 } from "lucide-react";
import type { PinboardMessage } from "./PinboardWidget";

interface FamilyMember {
  id: string;
  name: string;
  color: string;
  role?: string;
}

interface PinboardFullViewProps {
  familyId: string;
  initialMessages: PinboardMessage[];
  members: FamilyMember[];
  onBack: () => void;
}

const POSTIT_COLORS = [
  { bg: "#fef08a", label: "yellow" },
  { bg: "#fda4af", label: "pink" },
  { bg: "#86efac", label: "green" },
  { bg: "#93c5fd", label: "blue" },
  { bg: "#d8b4fe", label: "purple" },
];

function getRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return -4 + (Math.abs(hash) % 9);
}

function getExpiryDate(option: string): string | null {
  const now = new Date();
  if (option === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }
  if (option === "tomorrow") {
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }
  if (option === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }
  return null; // "never"
}

function isExpired(msg: PinboardMessage): boolean {
  if (!msg.expiresAt) return false;
  return new Date(msg.expiresAt) < new Date();
}

export function PinboardFullView({
  familyId,
  initialMessages,
  members,
  onBack,
}: PinboardFullViewProps) {
  const t = useTranslations("pinboard");

  const [messages, setMessages] = useState<PinboardMessage[]>(initialMessages);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<PinboardMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form state
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(POSTIT_COLORS[0].bg);
  const [expiry, setExpiry] = useState("never");
  const [selectedAuthorId, setSelectedAuthorId] = useState(members[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/families/${familyId}/pinboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          color: selectedColor,
          expiresAt: getExpiryDate(expiry),
          authorId: selectedAuthorId,
        }),
      });
      if (res.ok) {
        const { message } = await res.json();
        setMessages((prev) => [message, ...prev]);
        setContent("");
        setSelectedColor(POSTIT_COLORS[0].bg);
        setExpiry("never");
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  }, [content, selectedColor, expiry, selectedAuthorId, familyId]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/families/${familyId}/pinboard/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setSelectedMsg(null);
      }
    } finally {
      setDeletingId(null);
    }
  }, [familyId]);

  const MAX_CHARS = 150;

  return (
    <div className="min-h-screen p-5 flex flex-col gap-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-white/10 active:bg-white/5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">{t("title")}</span>
        </button>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #34d399, #10b981)",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(52,211,153,0.35)",
          }}
        >
          <Plus size={16} />
          {t("addNote")}
        </button>
      </div>

      {/* Post-its scattered grid */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg" style={{ color: "var(--color-text-muted)" }}>
            {t("empty")}
          </p>
        </div>
      ) : (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            alignItems: "start",
          }}
        >
          {messages.map((msg) => {
            const rotation = getRotation(msg.id);
            const expired = isExpired(msg);
            return (
              <button
                key={msg.id}
                onClick={() => setSelectedMsg(msg)}
                className="postit-note text-left"
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: "18px",
                  color: "#1a1a1a",
                  padding: "16px",
                  minHeight: "120px",
                  borderRadius: "2px",
                  backgroundColor: msg.color,
                  boxShadow: "2px 3px 12px rgba(0,0,0,0.3), 0 0 1px rgba(0,0,0,0.1)",
                  transform: `rotate(${rotation}deg)`,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  opacity: expired ? 0.45 : 1,
                  animation: "postit-fly-in 0.35s cubic-bezier(0.34,1.56,0.64,1) backwards",
                  cursor: "pointer",
                  display: "block",
                  width: "100%",
                }}
              >
                <div className="text-base mb-1">📌</div>
                <p className="leading-snug whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className="mt-2 text-right"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: "11px",
                    color: "rgba(26,26,26,0.6)",
                  }}
                >
                  — {msg.author.name}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedMsg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelectedMsg(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: selectedMsg.color,
              borderRadius: "2px",
              padding: "28px",
              maxWidth: "360px",
              width: "100%",
              boxShadow: "4px 6px 24px rgba(0,0,0,0.5)",
              transform: `rotate(${getRotation(selectedMsg.id)}deg)`,
            }}
          >
            <div className="text-xl mb-2">📌</div>
            <p
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "22px",
                color: "#1a1a1a",
                lineHeight: 1.35,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {selectedMsg.content}
            </p>
            <p
              className="mt-3 text-right"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "12px",
                color: "rgba(26,26,26,0.6)",
              }}
            >
              — {selectedMsg.author.name}
            </p>
            <div className="mt-5 flex justify-between items-center">
              <button
                onClick={() => setSelectedMsg(null)}
                className="text-sm px-4 py-2 rounded-xl"
                style={{
                  background: "rgba(0,0,0,0.12)",
                  color: "#1a1a1a",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => handleDelete(selectedMsg.id)}
                disabled={deletingId === selectedMsg.id}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl"
                style={{
                  background: "rgba(239,68,68,0.85)",
                  color: "#fff",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                <Trash2 size={14} />
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-6 sm:items-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowAdd(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-md rounded-3xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2
                className="font-bold text-base"
                style={{ color: "var(--color-text)" }}
              >
                {t("addNote")}
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                placeholder={t("placeholder")}
                rows={4}
                className="w-full rounded-2xl p-4 resize-none text-[18px]"
                style={{
                  fontFamily: "'Caveat', cursive",
                  backgroundColor: selectedColor,
                  color: "#1a1a1a",
                  border: "none",
                  outline: "none",
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.1)",
                }}
              />
              <span
                className="absolute bottom-3 right-4 text-xs"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  color: "rgba(26,26,26,0.5)",
                }}
              >
                {t("charsLeft", { count: MAX_CHARS - content.length })}
              </span>
            </div>

            {/* Color picker */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                {t("color")}
              </p>
              <div className="flex gap-2">
                {POSTIT_COLORS.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setSelectedColor(c.bg)}
                    className="w-9 h-9 rounded-lg transition-transform active:scale-90"
                    style={{
                      backgroundColor: c.bg,
                      boxShadow: selectedColor === c.bg
                        ? `0 0 0 3px rgba(255,255,255,0.8), 0 0 0 5px ${c.bg}`
                        : "0 2px 6px rgba(0,0,0,0.2)",
                      transform: selectedColor === c.bg ? "scale(1.1)" : "scale(1)",
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Expiry picker */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                {t("expires")}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "never", label: t("expiresNever") },
                  { value: "today", label: t("expiresToday") },
                  { value: "tomorrow", label: t("expiresTomorrow") },
                  { value: "week", label: t("expiresWeek") },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setExpiry(opt.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: expiry === opt.value ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)",
                      color: expiry === opt.value ? "var(--color-text)" : "var(--color-text-muted)",
                      border: expiry === opt.value ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Author selector (if multiple members) */}
            {members.length > 1 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                  Von
                </p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedAuthorId(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: selectedAuthorId === m.id ? `${m.color}30` : "rgba(255,255,255,0.07)",
                        color: selectedAuthorId === m.id ? m.color : "var(--color-text-muted)",
                        border: selectedAuthorId === m.id ? `1px solid ${m.color}50` : "1px solid transparent",
                      }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pin button */}
            <button
              onClick={handleAdd}
              disabled={!content.trim() || saving}
              className="w-full py-3 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #34d399, #10b981)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(52,211,153,0.35)",
              }}
            >
              📌 {saving ? "..." : t("pin")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
