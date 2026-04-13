"use client";

import { useTranslations } from "next-intl";
import { Pin } from "lucide-react";

export interface PinboardMessage {
  id: string;
  content: string;
  color: string;
  createdAt: string;
  expiresAt?: string | null;
  author: { id: string; name: string; color: string };
}

interface PinboardWidgetProps {
  messages: PinboardMessage[];
  onTap: () => void;
}

const PINBOARD_COLOR = "#34d399";

function getRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return -4 + (Math.abs(hash) % 9); // -4 to +4 degrees
}

export function PinboardWidget({ messages, onTap }: PinboardWidgetProps) {
  const t = useTranslations("pinboard");

  const preview = messages.slice(0, 4);

  return (
    <button
      onClick={onTap}
      className="glass glass-hover w-full text-left p-5 overflow-hidden animate-slide-up cursor-pointer"
      style={{ borderRadius: "var(--border-radius)", animationDelay: "100ms" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${PINBOARD_COLOR}20, ${PINBOARD_COLOR}10)`,
            border: `1px solid ${PINBOARD_COLOR}30`,
            boxShadow: `0 0 20px ${PINBOARD_COLOR}15`,
            color: PINBOARD_COLOR,
          }}
        >
          <Pin size={20} strokeWidth={1.8} />
        </div>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.15em]"
          style={{ color: PINBOARD_COLOR }}
        >
          {t("title")}
        </span>
      </div>

      {/* Post-it notes preview */}
      {preview.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {t("empty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {preview.map((msg) => {
            const rotation = getRotation(msg.id);
            return (
              <div
                key={msg.id}
                className="postit-note"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  ["--postit-rotation" as string]: `${rotation}deg`,
                  ["--postit-hover-rotation" as string]: `${rotation * 0.5}deg`,
                  backgroundColor: msg.color,
                  borderRadius: "2px",
                  padding: "8px",
                  minHeight: "56px",
                  boxShadow: "2px 3px 8px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.15)",
                }}
              >
                <p
                  className="leading-tight line-clamp-2"
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: "14px",
                    color: "#1a1a1a",
                  }}
                >
                  {msg.content}
                </p>
                <p
                  className="mt-1 text-right"
                  style={{ fontSize: "10px", color: "#1a1a1a", opacity: 0.5 }}
                >
                  —{msg.author.name}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
